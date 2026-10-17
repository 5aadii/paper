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


def test_photo_lead_is_promoted():
    from edition_builder import promote_photo_lead
    cands = {"c1": {"image_url": None, "is_explore": False}, "c2": {"image_url": "https://x/p.jpg", "is_explore": False}}
    stories = [{"id": "c1", "layout_role": "lead"}, {"id": "c2", "layout_role": "feature"}]
    promote_photo_lead(stories, cands)
    assert stories[0]["layout_role"] == "feature" and stories[1]["layout_role"] == "lead"


def test_thin_headline_only_items_rank_lower():
    from ranking import score_article
    rich = art("https://a.com/1", "A long enough headline about something")
    rich["snippet"] = "A real paragraph from the publisher with enough detail to summarise the story properly."
    thin = art("https://b.com/2", "Another long enough headline about something")
    thin["snippet"] = ""
    w = {"technology": 1.0}
    assert score_article(rich, NOW, w, {}, []) > score_article(thin, NOW, w, {}, [])


def test_pakistan_region_still_fetches_publisher_feeds():
    from edition_builder import build_feed_specs
    from sources import TOPICS
    specs = build_feed_specs([{"topic": "world", "weight": 1.0}], "pakistan")
    urls = {s["url"] for s in specs if not s["is_explore"]}
    assert set(TOPICS["world"]["feeds"]) <= urls
    assert any("gl=PK" in u for u in urls) and not any("gl=US" in u for u in urls)


def test_photos_fill_lead_and_features():
    from edition_builder import promote_photo_lead
    cands = {f"c{i}": {"image_url": ("https://x/p.jpg" if i >= 4 else None), "is_explore": False} for i in range(1, 7)}
    stories = [{"id": "c1", "layout_role": "lead"}, {"id": "c2", "layout_role": "feature"},
               {"id": "c3", "layout_role": "feature"}, {"id": "c4", "layout_role": "standard"},
               {"id": "c5", "layout_role": "standard"}, {"id": "c6", "layout_role": "standard"}]
    promote_photo_lead(stories, cands)
    roles = {s["id"]: s["layout_role"] for s in stories}
    assert [roles[c] for c in ("c4", "c5", "c6")].count("standard") == 0
    assert sorted(roles.values()) == ["feature", "feature", "lead", "standard", "standard", "standard"]
