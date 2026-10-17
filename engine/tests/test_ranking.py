"""Dedupe, filtering, per-topic cap, fallback layout (SPEC 7.11)."""
from datetime import datetime, timedelta, timezone

from ranking import build_fallback_layout, dedupe, filter_articles, select_candidates

NOW = datetime(2026, 10, 17, 6, tzinfo=timezone.utc)


def art(url, title, topic="technology", hours=2, explore=False, source="Src"):
    return {"url": url, "title": title, "source_name": source, "snippet": "A snippet. Second sentence.",
            "image_url": None, "published_at": NOW - timedelta(hours=hours), "topic": topic, "is_explore": explore}


def test_duplicate_url_removed():
    a = art("https://Site.com/story/?utm_source=x", "First headline about the same thing here")
    b = art("https://site.com/story", "Totally different headline words appear now")
    assert len(dedupe([a, b], {})) == 1


def test_near_duplicate_titles_removed():
    a = art("https://a.com/1", "Government announces new budget for schools in 2026")
    b = art("https://b.com/2", "Government announces new budget for schools in 2026!")
    assert len(dedupe([a, b], {})) == 1


def test_skipped_url_excluded():
    arts = [art(f"https://a.com/{i}", f"A sufficiently long headline number {i}") for i in range(25)]
    out = filter_articles(arts, NOW, {"https://a.com/3"})
    assert all(a["url"] != "https://a.com/3" for a in out) and len(out) == 24


def test_short_titles_and_old_articles_dropped():
    arts = [art(f"https://a.com/{i}", f"A sufficiently long headline number {i}") for i in range(25)]
    arts += [art("https://a.com/short", "Too short"), art("https://a.com/old", "A very old headline from last week", hours=200)]
    urls = {a["url"] for a in filter_articles(arts, NOW, set())}
    assert "https://a.com/short" not in urls and "https://a.com/old" not in urls


def test_per_topic_cap():
    arts = [art(f"https://a.com/{i}", f"Technology headline number {i} long enough") for i in range(20)]
    arts += [art(f"https://b.com/{i}", f"AI headline number {i} long enough", topic="ai") for i in range(3)]
    c = select_candidates(arts, NOW, {"technology": 3.0, "ai": 1.0}, {}, [])
    assert sum(1 for x in c if x["topic"] == "technology") == 8
    assert [x["id"] for x in c][:2] == ["c1", "c2"]


def test_fallback_layout_shape():
    arts = [art(f"https://a.com/{i}", f"Technology headline number {i} long enough") for i in range(8)]
    arts += [art(f"https://b.com/{i}", f"Artificial intelligence item {i} long enough", topic="ai") for i in range(8)]
    arts.append(art("https://e.com/1", "An explore headline that is long enough", topic="space", explore=True))
    c = select_candidates(arts, NOW, {"technology": 1.0, "ai": 1.0}, {}, [])
    lay = build_fallback_layout(c, "balanced", "Saad", {"technology": "Technology"})
    roles = [s["layout_role"] for s in lay["stories"]]
    assert len(lay["stories"]) == 11 and roles.count("lead") == 1 and roles.count("brief") == 3
    assert any(s["section"] == "Explore" for s in lay["stories"])
    assert len(lay["three_things"]) == 3 and lay["editors_note"].startswith("Good morning, Saad.")
