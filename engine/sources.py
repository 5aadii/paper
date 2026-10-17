"""TOPICS catalogue: publisher feeds + Google News queries per topic (SPEC Section 7.2).

Every topic has a Google News query, so no topic can ever come back empty.
Publisher feeds are a bonus; run `python -m sources --verify` and delete any that FAIL.
"""
from __future__ import annotations

import sys
from urllib.parse import quote_plus

BBC = "https://feeds.bbci.co.uk/news"

TOPICS: dict[str, dict] = {
    "world": {
        "label": "World",
        "feeds": [f"{BBC}/world/rss.xml", "https://www.aljazeera.com/xml/rss/all.xml", "https://www.theguardian.com/world/rss"],
        "query": "world news",
        "pakistan_feeds": [],
        "pakistan_query": "world news Pakistan",
    },
    "pakistan": {
        "label": "Pakistan",
        "feeds": [],
        "query": "Pakistan",
        "pakistan_feeds": ["https://www.dawn.com/feeds/home"],
        "pakistan_query": "Pakistan",
    },
    "business": {
        "label": "Business & Markets",
        "feeds": [f"{BBC}/business/rss.xml", "https://www.theguardian.com/business/rss"],
        "query": "business markets economy",
        "pakistan_feeds": ["https://www.dawn.com/feeds/business"],
        "pakistan_query": "Pakistan economy business",
    },
    "technology": {
        "label": "Technology",
        "feeds": ["https://www.theverge.com/rss/index.xml", "https://feeds.arstechnica.com/arstechnica/index",
                  f"{BBC}/technology/rss.xml", "https://www.theguardian.com/technology/rss"],
        "query": "technology",
        "pakistan_feeds": [],
        "pakistan_query": "technology Pakistan",
    },
    "ai": {
        "label": "Artificial Intelligence",
        "feeds": ["https://techcrunch.com/category/artificial-intelligence/feed/", "https://www.theguardian.com/technology/artificialintelligenceai/rss"],
        "query": "artificial intelligence",
        "pakistan_feeds": [],
        "pakistan_query": "artificial intelligence Pakistan",
    },
    "startups": {
        "label": "Startups",
        "feeds": ["https://techcrunch.com/category/startups/feed/"],
        "query": "startup funding",
        "pakistan_feeds": [],
        "pakistan_query": "Pakistan startup",
    },
    "programming": {
        "label": "Programming & Dev",
        "feeds": ["https://hnrss.org/frontpage"],
        "query": "programming software developers",
        "pakistan_feeds": [],
        "pakistan_query": "software developers Pakistan",
    },
    "science": {
        "label": "Science",
        "feeds": [f"{BBC}/science_and_environment/rss.xml", "https://www.theguardian.com/science/rss"],
        "query": "science research discovery",
        "pakistan_feeds": [],
        "pakistan_query": "science Pakistan",
    },
    "space": {
        "label": "Space",
        "feeds": ["https://www.space.com/feeds/all", "https://www.theguardian.com/science/space/rss"],
        "query": "space NASA astronomy",
        "pakistan_feeds": [],
        "pakistan_query": "SUPARCO space Pakistan",
    },
    "health": {
        "label": "Health",
        "feeds": [f"{BBC}/health/rss.xml", "https://www.theguardian.com/society/health/rss"],
        "query": "health medicine",
        "pakistan_feeds": [],
        "pakistan_query": "health Pakistan",
    },
    "climate": {
        "label": "Climate & Environment",
        "feeds": ["https://www.theguardian.com/environment/rss"],
        "query": "climate change environment",
        "pakistan_feeds": [],
        "pakistan_query": "climate Pakistan",
    },
    "cricket": {
        "label": "Cricket",
        "feeds": ["https://www.espncricinfo.com/rss/content/story/feeds/0.xml", "https://www.theguardian.com/sport/cricket/rss"],
        "query": "cricket",
        "pakistan_feeds": ["https://www.dawn.com/feeds/sport"],
        "pakistan_query": "Pakistan cricket",
    },
    "football": {
        "label": "Football",
        "feeds": ["https://feeds.bbci.co.uk/sport/football/rss.xml", "https://www.theguardian.com/football/rss"],
        "query": "football Premier League Champions League",
        "pakistan_feeds": [],
        "pakistan_query": "football Pakistan",
    },
    "entertainment": {
        "label": "Film, TV & Culture",
        "feeds": [f"{BBC}/entertainment_and_arts/rss.xml", "https://www.theguardian.com/film/rss"],
        "query": "film TV culture",
        "pakistan_feeds": [],
        "pakistan_query": "Pakistani drama film",
    },
    "gaming": {
        "label": "Gaming",
        "feeds": ["https://www.theguardian.com/games/rss"],
        "query": "video games",
        "pakistan_feeds": [],
        "pakistan_query": "gaming Pakistan",
    },
}

EXPLORE_POOL = ["science", "space", "climate", "health", "business", "entertainment"]


def google_news_rss(query: str, region: str) -> str:
    """Google News RSS search URL. region 'pakistan' -> PK edition, otherwise US edition."""
    q = quote_plus(f"{query} when:2d")
    if region == "pakistan":
        return f"https://news.google.com/rss/search?q={q}&hl=en-PK&gl=PK&ceid=PK:en"
    return f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"


def topic_label(slug: str) -> str:
    if slug.startswith("custom:"):
        return slug[len("custom:"):].strip().title()
    return TOPICS.get(slug, {}).get("label", slug.title())


def _verify() -> int:
    import feedparser
    import httpx

    urls: list[tuple[str, str]] = []
    for slug, t in TOPICS.items():
        for u in t["feeds"] + t["pakistan_feeds"]:
            urls.append((slug, u))
        urls.append((slug, google_news_rss(t["query"], "global")))
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
    failed = 0
    with httpx.Client(timeout=8, follow_redirects=True, headers=headers) as c:
        for slug, u in urls:
            try:
                r = c.get(u)
                n = len(feedparser.parse(r.content).entries)
                ok = r.status_code == 200 and n > 0
            except Exception:
                n, ok = 0, False
            failed += 0 if ok else 1
            print(f"{'OK  ' if ok else 'FAIL'} {n:3d} items  {slug:14s} {u}")
    print(f"\n{len(urls) - failed}/{len(urls)} feeds OK")
    return 0


if __name__ == "__main__":
    if "--verify" in sys.argv:
        sys.exit(_verify())
    print("Usage: python -m sources --verify")
