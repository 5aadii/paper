import asyncio

import article_reader
from article_reader import extract_article, is_google_news, read_articles

PAGE = """<html><head><title>Big news</title>
<meta property="og:image" content="https://cdn.example.com/lead.jpg">
<meta name="author" content="Jane Doe"></head><body><nav>Home | World | Sport</nav>
<article><h1>Big news</h1>
<p>The city council voted on Tuesday to rebuild the old harbour bridge, ending a decade of debate over its future.</p>
<p>Officials said construction would start next spring and take about three years, with a temporary ferry in the meantime.</p>
<p>Residents who had campaigned to save the bridge welcomed the decision but warned about the cost to local businesses.</p>
<p>The project is expected to cost far more than the original estimate, according to documents seen by reporters this week.</p>
</article><footer>Copyright 2026</footer></body></html>"""


def test_extracts_body_image_and_author():
    a = extract_article(PAGE, "https://example.com/story")
    assert a["body"].startswith("The city council voted")
    assert a["body"].count("\n\n") == 3
    assert "Home | World" not in a["body"] and "Copyright" not in a["body"]
    assert a["image_url"] == "https://cdn.example.com/lead.jpg"
    assert a["author"] == "Jane Doe"


def test_short_teaser_is_not_a_body():
    a = extract_article("<html><body><p>Subscribe to read the rest of this story today.</p></body></html>",
                        "https://example.com/x")
    assert a["body"] is None


def test_google_news_detection():
    assert is_google_news("https://news.google.com/rss/articles/CBMiabc?oc=5")
    assert not is_google_news("https://www.bbc.co.uk/news/world-1")


def test_read_articles_never_raises(monkeypatch):
    async def boom(*_a, **_k):
        raise RuntimeError("network down")
    monkeypatch.setattr(article_reader, "_read_one", boom)
    arts = [{"url": "https://example.com/a", "snippet": "x"}]
    asyncio.run(read_articles(arts))
    assert "body" not in arts[0]
