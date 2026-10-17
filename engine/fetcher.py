"""Parallel RSS fetching + normalising (SPEC Section 7.3).

A failed feed is logged as `feed_failed topic=<slug> host=<domain>` and skipped. Never crashes.
"""
from __future__ import annotations

import asyncio
import calendar
import html
import logging
import re
from datetime import datetime, timezone
from typing import TypedDict
from urllib.parse import urlparse

import feedparser
import httpx

from config import FEED_TIMEOUT_SECONDS

log = logging.getLogger("engine.fetcher")

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


class FeedSpec(TypedDict):
    url: str
    topic: str
    source_hint: str | None
    is_explore: bool


class RawArticle(TypedDict):
    url: str
    title: str
    source_name: str
    snippet: str
    image_url: str | None
    published_at: datetime | None
    topic: str
    is_explore: bool


_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def clean_text(text: str | None, max_len: int | None = None) -> str:
    if not text:
        return ""
    t = _TAG.sub(" ", text)
    t = html.unescape(t)
    t = _WS.sub(" ", t).strip()
    if max_len and len(t) > max_len:
        t = t[:max_len].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
    return t


def _domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


_IMG_SRC = re.compile(r"""<img[^>]+src=["']([^"']+)["']""", re.I)
_IMG_EXT = re.compile(r"\.(jpe?g|png|webp|gif)(\?|$)", re.I)


def _upgrade(url: str) -> str:
    """Ask image CDNs for a bigger version where the URL pattern allows it."""
    url = re.sub(r"/ace/(standard|ws)/\d+/", "/ace/standard/976/", url)  # BBC
    return url


def _ok_image(url: str | None) -> bool:
    if not url or not url.startswith("http"):
        return False
    low = url.lower()
    return not any(bad in low for bad in ("feedburner", "pixel", "1x1", "spacer", "gravatar", "/avatar"))


def _width(m: dict) -> int:
    try:
        return int(m.get("width") or 0)
    except (TypeError, ValueError):
        return 0


def _image(entry) -> str | None:
    candidates: list[tuple[int, str]] = []
    for key in ("media_content", "media_thumbnail"):
        for m in entry.get(key) or []:
            u = m.get("url")
            kind = str(m.get("medium") or m.get("type") or "")
            if _ok_image(u) and (not kind or "image" in kind or _IMG_EXT.search(u)):
                candidates.append((_width(m) or 1, u))
    if candidates:
        return _upgrade(max(candidates)[1])
    for link in list(entry.get("enclosures") or []) + list(entry.get("links") or []):
        href = link.get("href")
        if str(link.get("type", "")).startswith("image") and _ok_image(href):
            return _upgrade(href)
    html_parts = [c.get("value", "") for c in entry.get("content") or []]
    html_parts.append(entry.get("summary") or "")
    for h in html_parts:
        m = _IMG_SRC.search(h or "")
        if m and _ok_image(m.group(1)):
            return _upgrade(html.unescape(m.group(1)))
    return None


def _published(entry) -> datetime | None:
    for key in ("published_parsed", "updated_parsed"):
        st = entry.get(key)
        if st:
            try:
                return datetime.fromtimestamp(calendar.timegm(st), tz=timezone.utc)
            except Exception:
                return None
    return None


def parse_feed(content: bytes, spec: FeedSpec) -> list[RawArticle]:
    parsed = feedparser.parse(content)
    feed_title = clean_text(parsed.feed.get("title")) if parsed.get("feed") else ""
    is_google = "news.google.com" in spec["url"]
    out: list[RawArticle] = []
    for e in parsed.entries:
        url = e.get("link")
        title = clean_text(e.get("title"))
        if not url or not title:
            continue
        source = ""
        src = e.get("source")
        if isinstance(src, dict):
            source = clean_text(src.get("title"))
        if is_google and " - " in title:
            title, tail = title.rsplit(" - ", 1)
            source = source or tail.strip()
            title = title.strip()
        source = source or spec.get("source_hint") or feed_title or _domain(url)
        snippet = clean_text(e.get("summary") or e.get("description"), 500)
        # Google News snippets just repeat the headline + source; drop them.
        if is_google and snippet.lower().startswith(title.lower()[:30]):
            snippet = ""
        out.append(RawArticle(
            url=url, title=title, source_name=source, snippet=snippet,
            image_url=_image(e), published_at=_published(e),
            topic=spec["topic"], is_explore=spec["is_explore"],
        ))
    return out


async def _fetch_one(client: httpx.AsyncClient, spec: FeedSpec) -> list[RawArticle]:
    r = await client.get(spec["url"])
    r.raise_for_status()
    return parse_feed(r.content, spec)


_OG = re.compile(
    r"""<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]+content=["']([^"']+)["']"""
    r"""|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']""",
    re.I,
)


async def _og_image(client: httpx.AsyncClient, url: str) -> str | None:
    """Read only the page's preview-image meta tag (first ~150 KB). Never the article text."""
    async with client.stream("GET", url) as r:
        if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
            return None
        buf = b""
        async for chunk in r.aiter_bytes():
            buf += chunk
            if len(buf) > 150_000 or b"</head>" in buf:
                break
    m = _OG.search(buf.decode("utf-8", errors="ignore"))
    u = html.unescape((m.group(1) or m.group(2)).strip()) if m else None
    return _upgrade(u) if _ok_image(u) else None


async def enrich_images(articles: list[dict], limit: int = 16) -> None:
    """Fill image_url (in place) for the top articles that have none, from og:image.
    Skips Google News redirect links; 4 s timeout each; failures ignored."""
    todo = [a for a in articles if not a.get("image_url") and "news.google.com" not in a["url"]][:limit]
    if not todo:
        return
    async with httpx.AsyncClient(timeout=4, follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
        results = await asyncio.gather(*[_og_image(client, a["url"]) for a in todo], return_exceptions=True)
    for a, res in zip(todo, results):
        if isinstance(res, str):
            a["image_url"] = res


async def fetch_all(feed_specs: list[FeedSpec]) -> list[RawArticle]:
    async with httpx.AsyncClient(timeout=FEED_TIMEOUT_SECONDS, follow_redirects=True,
                                 headers={"User-Agent": USER_AGENT}) as client:
        results = await asyncio.gather(*[_fetch_one(client, s) for s in feed_specs],
                                       return_exceptions=True)
    articles: list[RawArticle] = []
    for spec, res in zip(feed_specs, results):
        if isinstance(res, BaseException):
            log.warning("feed_failed topic=%s host=%s", spec["topic"], _domain(spec["url"]))
            continue
        articles.extend(res)
    return articles
