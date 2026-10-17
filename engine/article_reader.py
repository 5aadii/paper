"""Reads the full article behind a feed link, so stories can be read on our own story page.

1. Google News RSS links (news.google.com/rss/articles/...) are resolved to the publisher's URL.
2. The publisher page is downloaded and its main text, lead photo and byline are extracted
   with trafilatura (a plain <p> extractor is used if trafilatura is not installed).

Every step is best effort: a failure leaves the article as it was (headline + snippet).
"""
from __future__ import annotations

import asyncio
import base64
import html as html_lib
import json
import logging
import re
from urllib.parse import quote, urlparse

import httpx

from fetcher import USER_AGENT, _ok_image, _upgrade, clean_text

log = logging.getLogger("engine.reader")

READ_TIMEOUT_SECONDS = 8
MAX_CONCURRENT = 16
MAX_BODY_CHARS = 20_000
MIN_BODY_CHARS = 400  # less than this is a teaser or a paywall stub, not an article

try:  # optional at import time so tests and the fallback path never break
    import trafilatura
except Exception:  # pragma: no cover
    trafilatura = None


# ---------------------------------------------------------------- Google News links
def is_google_news(url: str) -> bool:
    return urlparse(url).netloc.endswith("news.google.com")


def _gn_id(url: str) -> str | None:
    parts = [p for p in urlparse(url).path.split("/") if p]
    if len(parts) >= 2 and parts[-2] in ("articles", "read"):
        return parts[-1]
    return None


def _decode_old_style(gn_id: str) -> str | None:
    """Older Google News ids are base64 protobufs with the publisher URL inside."""
    try:
        raw = base64.urlsafe_b64decode(gn_id + "=" * (-len(gn_id) % 4))
    except Exception:
        return None
    m = re.search(rb"https?://[\x21-\x7e]+", raw)
    if not m:
        return None
    url = m.group(0).decode("ascii", errors="ignore")
    return url if "AU_yqL" not in url else None


_SG = re.compile(r'data-n-a-sg="([^"]+)"')
_TS = re.compile(r'data-n-a-ts="([^"]+)"')


async def resolve_google_news(client: httpx.AsyncClient, url: str) -> str | None:
    gn_id = _gn_id(url)
    if not gn_id:
        return None
    old = _decode_old_style(gn_id)
    if old:
        return old
    page = await client.get(f"https://news.google.com/rss/articles/{gn_id}")
    sg, ts = _SG.search(page.text), _TS.search(page.text)
    if not sg or not ts:
        return None
    inner = (
        '["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],'
        f'"X","X",1,[1,1,1],1,1,null,0,0,null,0],"{gn_id}",{ts.group(1)},"{sg.group(1)}"]'
    )
    body = "f.req=" + quote(json.dumps([[["Fbv4je", inner, None, "generic"]]]))
    r = await client.post(
        "https://news.google.com/_/DotsSplashUi/data/batchexecute",
        content=body,
        headers={"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
    )
    chunk = r.text.split("\n\n", 1)[1]
    rows = json.loads(chunk)[:-2]
    decoded = json.loads(rows[0][2])[1]
    return decoded if isinstance(decoded, str) and decoded.startswith("http") else None


# ---------------------------------------------------------------- page -> article
_P = re.compile(r"<p[^>]*>(.*?)</p>", re.I | re.S)
_OG_IMAGE = re.compile(
    r"""<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]+content=["']([^"']+)["']"""
    r"""|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']""",
    re.I,
)
_AUTHOR = re.compile(r"""<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']""", re.I)


def _paragraphs(text: str) -> list[str]:
    out = []
    for line in text.split("\n"):
        line = re.sub(r"\s+", " ", line).strip()
        if len(line) >= 25:  # drops captions, share buttons and stray labels
            out.append(line)
    return out


def extract_article(page_html: str, url: str) -> dict:
    """Returns {"body": str ("\\n\\n"-separated paragraphs) | None, "image_url", "author"}."""
    body, image, author = None, None, None
    if trafilatura is not None:
        try:
            raw = trafilatura.extract(page_html, url=url, output_format="json", with_metadata=True,
                                      include_comments=False, include_tables=False, favor_precision=True)
            data = json.loads(raw) if raw else {}
        except Exception:
            data = {}
        paras = _paragraphs(data.get("text") or "")
        if paras and paras[0].lower() == (data.get("title") or "").strip().lower():
            paras = paras[1:]
        body = "\n\n".join(paras) or None
        image = data.get("image")
        author = data.get("author")
    if not body:  # plain fallback: every reasonably long <p>
        paras = [clean_text(p) for p in _P.findall(page_html)]
        body = "\n\n".join(p for p in paras if len(p) >= 60) or None
    if not image:
        m = _OG_IMAGE.search(page_html)
        image = html_lib.unescape((m.group(1) or m.group(2)).strip()) if m else None
    if not author:
        m = _AUTHOR.search(page_html)
        author = html_lib.unescape(m.group(1)).strip() if m else None
    if body and len(body) < MIN_BODY_CHARS:
        body = None
    if body and len(body) > MAX_BODY_CHARS:
        body = body[:MAX_BODY_CHARS].rsplit("\n\n", 1)[0]
    if author and (len(author) > 80 or author.startswith("http")):
        author = None
    return {
        "body": body,
        "image_url": _upgrade(image) if _ok_image(image) else None,
        "author": author,
    }


async def _read_one(client: httpx.AsyncClient, sem: asyncio.Semaphore, a: dict) -> None:
    async with sem:
        url = a["url"]
        try:
            if is_google_news(url):
                real = await resolve_google_news(client, url)
                if not real:
                    return
                a["url"] = url = real
            r = await client.get(url)
            if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
                return
            art = extract_article(r.text, str(r.url))
        except Exception as e:
            log.info("read_failed host=%s reason=%s", urlparse(url).netloc, type(e).__name__)
            return
        if art["body"]:
            a["body"] = art["body"]
            a["word_count"] = len(art["body"].split())
            if not a.get("snippet") or len(a["snippet"]) < 120:
                a["snippet"] = clean_text(art["body"], 500)
        if art["author"]:
            a["author"] = art["author"]
        if art["image_url"] and not a.get("image_url"):
            a["image_url"] = art["image_url"]


async def read_articles(articles: list[dict], budget_seconds: float = 15) -> None:
    """Fill url (resolved), body, word_count, author and image_url in place. Never raises.
    Stops after `budget_seconds`; whatever was read by then is kept."""
    todo = [a for a in articles if not a.get("body")]
    if not todo:
        return
    sem = asyncio.Semaphore(MAX_CONCURRENT)
    async with httpx.AsyncClient(timeout=READ_TIMEOUT_SECONDS, follow_redirects=True,
                                 headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"}) as client:
        try:
            await asyncio.wait_for(
                asyncio.gather(*[_read_one(client, sem, a) for a in todo], return_exceptions=True),
                timeout=budget_seconds,
            )
        except (asyncio.TimeoutError, Exception):
            log.info("read_budget_reached read=%d of %d", sum(1 for a in todo if a.get("body")), len(todo))
