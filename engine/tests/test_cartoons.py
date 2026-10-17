import asyncio
from datetime import datetime, timezone
from email.utils import format_datetime

import httpx

import cartoons

NOW = format_datetime(datetime.now(timezone.utc))
FEED = f"""<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
<item><title>Ben Jennings on the budget</title><link>https://paper.test/c/1</link><pubDate>{NOW}</pubDate>
<media:content url="https://img.test/thumb.jpg" medium="image" width="140"/></item>
<item><title>Old one</title><link>https://paper.test/c/0</link><pubDate>Mon, 01 Jan 2001 00:00:00 GMT</pubDate></item>
</channel></rss>"""
PAGE = '<html><head><meta property="og:image" content="https://img.test/full.jpg"></head></html>'


def _client(handler):
    real = httpx.AsyncClient

    def make(**kw):
        return real(transport=httpx.MockTransport(handler), **kw)

    return make


def test_cartoons_take_page_image_and_skip_old(monkeypatch):
    def handler(req):
        if req.url.host == "paper.test":
            return httpx.Response(200, html=PAGE)
        return httpx.Response(200, content=FEED.encode(), headers={"content-type": "application/rss+xml"})

    monkeypatch.setattr(cartoons, "SOURCES", [{"paper": "The Guardian", "series": "Comment cartoon", "feed": "https://feed.test/rss"}])
    monkeypatch.setattr(cartoons.httpx, "AsyncClient", _client(handler))
    out = asyncio.run(cartoons.fetch_cartoons())
    assert len(out) == 1
    assert out[0]["image_url"] == "https://img.test/full.jpg"
    assert out[0]["paper"] == "The Guardian"


def test_failed_source_is_skipped(monkeypatch):
    def handler(req):
        if req.url.host == "down.test":
            return httpx.Response(500)
        if req.url.host == "paper.test":
            return httpx.Response(404)
        return httpx.Response(200, content=FEED.encode())

    monkeypatch.setattr(cartoons, "SOURCES", [
        {"paper": "Down", "series": "x", "feed": "https://down.test/rss"},
        {"paper": "Up", "series": "x", "feed": "https://feed.test/rss"},
    ])
    monkeypatch.setattr(cartoons.httpx, "AsyncClient", _client(handler))
    out = asyncio.run(cartoons.fetch_cartoons())
    assert [c["paper"] for c in out] == ["Up"]
    assert out[0]["image_url"] == "https://img.test/thumb.jpg"  # feed image when the page has none
