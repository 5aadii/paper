"""Today's editorial cartoons from several newspapers (the Cartoons page).

Each source is an RSS feed of a paper's cartoon series. For every recent item we take the
page's preview image (og:image, usually the full cartoon) and fall back to the image in the
feed. Google News sources are used for papers without a cartoon feed: their links are decoded
to the publisher page first. Results are cached for an hour. Every step is best effort.
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus

import feedparser
import httpx

from article_reader import is_google_news, resolve_google_news
from fetcher import USER_AGENT, _image, _og_image, _published, clean_text

log = logging.getLogger("engine.cartoons")

CACHE_SECONDS = 60 * 60
PER_SOURCE = 3
MAX_AGE_DAYS = 7
TIMEOUT_SECONDS = 8


def _gnews(query: str) -> str:
    return f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-PK&gl=PK&ceid=PK:en"


# paper, series name, feed, and (optional) a word the item title must contain
SOURCES: list[dict] = [
    {"paper": "The New Yorker", "series": "Daily Cartoon",
     "feed": "https://www.newyorker.com/feed/cartoons/daily-cartoon"},
    {"paper": "The Guardian", "series": "Comment cartoon",
     "feed": "https://www.theguardian.com/commentisfree/series/guardian-comment-cartoon/rss"},
    {"paper": "The Observer", "series": "Comment cartoon",
     "feed": "https://www.theguardian.com/commentisfree/series/observer-comment-cartoon/rss"},
    {"paper": "The Hindu", "series": "Cartoon",
     "feed": "https://www.thehindu.com/opinion/cartoon/feeder/default.rss"},
    {"paper": "Dawn", "series": "Cartoon",
     "feed": _gnews("cartoon site:dawn.com when:7d"), "must": "cartoon"},
    {"paper": "The Express Tribune", "series": "Cartoon",
     "feed": _gnews("cartoon site:tribune.com.pk when:7d"), "must": "cartoon"},
]

_cache: dict = {"at": 0.0, "data": None}


async def _source(client: httpx.AsyncClient, src: dict) -> list[dict]:
    r = await client.get(src["feed"])
    r.raise_for_status()
    parsed = feedparser.parse(r.content)
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    picked = []
    for e in parsed.entries:
        title = clean_text(e.get("title"))
        link = e.get("link")
        if not title or not link:
            continue
        if is_google_news(link) and " - " in title:
            title = title.rsplit(" - ", 1)[0].strip()
        if src.get("must") and src["must"] not in title.lower():
            continue
        published = _published(e)
        if published and published < cutoff:
            continue
        picked.append({"title": title, "link": link, "published": published, "feed_image": _image(e)})
        if len(picked) >= PER_SOURCE:
            break

    out = []
    for p in picked:
        url = p["link"]
        try:
            if is_google_news(url):
                url = await resolve_google_news(client, url) or url
            image = None if is_google_news(url) else await _og_image(client, url)
        except Exception:
            image = None
        image = image or p["feed_image"]
        if not image:
            continue
        out.append({
            "paper": src["paper"],
            "series": src["series"],
            "title": p["title"],
            "url": url,
            "image_url": image,
            "published_at": p["published"].isoformat() if p["published"] else None,
        })
    return out


async def fetch_cartoons() -> list[dict]:
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, follow_redirects=True,
                                 headers={"User-Agent": USER_AGENT}) as client:
        results = await asyncio.gather(*[_source(client, s) for s in SOURCES], return_exceptions=True)
    cartoons: list[dict] = []
    for src, res in zip(SOURCES, results):
        if isinstance(res, Exception):
            log.info("cartoon_source_failed paper=%s reason=%s", src["paper"], type(res).__name__)
            continue
        cartoons.extend(res)
    cartoons.sort(key=lambda c: c["published_at"] or "", reverse=True)
    return cartoons


def get_cartoons() -> list[dict]:
    """Cached for an hour; an empty result is not cached, so a network blip retries next time."""
    if _cache["data"] and time.time() - _cache["at"] < CACHE_SECONDS:
        return _cache["data"]
    data = asyncio.run(fetch_cartoons())
    if data:
        _cache.update(at=time.time(), data=data)
    return data
