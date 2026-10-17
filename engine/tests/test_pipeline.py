"""End-to-end pipeline run with the database, feeds, article reader and AI all faked."""
import asyncio
from datetime import datetime, timedelta, timezone

import edition_builder as eb

NOW = datetime.now(timezone.utc)


def _raw(i, topic):
    return {"url": f"https://news.google.com/rss/articles/x{i}", "title": f"Story number {i} about {topic} today",
            "source_name": "Src", "snippet": "A long enough snippet about the story to count as real content here.",
            "image_url": None, "published_at": NOW - timedelta(hours=i), "topic": topic, "is_explore": False}


def test_pipeline_reads_full_articles_and_saves_them(monkeypatch):
    saved = {}
    db = eb.db
    monkeypatch.setattr(db, "get_profile", lambda u: {"reading_style": "quick", "region": "both", "display_name": "Saad"})
    monkeypatch.setattr(db, "update_edition", lambda eid, **kw: saved.setdefault("updates", []).append(kw))
    monkeypatch.setattr(db, "get_interests", lambda u: [{"topic": "technology", "label": "Technology", "kind": "topic", "base_weight": 1.0,
                                                         "weight": 1.0, "previous_weight": None}])
    monkeypatch.setattr(db, "get_events_since", lambda u, s: [])
    monkeypatch.setattr(db, "save_weights", lambda u, rows: None)
    monkeypatch.setattr(db, "recent_edition_urls", lambda *a, **k: set())
    monkeypatch.setattr(db, "skipped_urls", lambda u: set())

    def upsert(arts):
        saved["articles"] = arts
        return {a["url"]: f"id-{n}" for n, a in enumerate(arts)}
    monkeypatch.setattr(db, "upsert_articles", upsert)
    monkeypatch.setattr(db, "insert_items", lambda rows: [{"id": f"item-{n}"} for n, _ in enumerate(rows)])

    async def fake_fetch(specs):
        return [_raw(i, "technology") for i in range(30)]
    monkeypatch.setattr(eb, "fetch_all", fake_fetch)

    async def fake_enrich(arts):
        return None
    monkeypatch.setattr(eb, "enrich_images", fake_enrich)

    async def fake_read(arts, **_kw):
        for a in arts:
            a["url"] = a["url"].replace("news.google.com/rss/articles", "publisher.example")
            a["body"] = "Full paragraph one.\n\nFull paragraph two."
            a["image_url"] = "https://publisher.example/photo.jpg"
    monkeypatch.setattr(eb, "read_articles", fake_read)
    monkeypatch.setattr(eb, "run_editor", lambda *a, **k: {"success": False, "error_type": "no_key"})

    asyncio.run(eb.run_pipeline("ed-1", "user-1"))

    final = saved["updates"][-1]
    assert final.get("status") == "ready", saved["updates"]
    picked = [a for a in saved["articles"] if a.get("body")]
    assert picked and all(a["url"].startswith("https://publisher.example") for a in picked)
    assert all(a["image_url"] for a in picked)


def test_reading_runs_while_the_editor_works(monkeypatch):
    """The editor call and article reading overlap, so the total wait is the slower of the two, not the sum."""
    import time

    calls = []

    async def slow_read(arts, **_kw):
        calls.append(("read_start", time.monotonic()))
        await asyncio.sleep(0.3)

    def slow_editor(*_a, **_k):
        calls.append(("editor_start", time.monotonic()))
        time.sleep(0.3)
        return {"success": False, "error_type": "no_key"}

    db = eb.db
    for name, fn in {
        "get_profile": lambda u: {"reading_style": "quick", "region": "both"},
        "update_edition": lambda eid, **kw: None,
        "get_interests": lambda u: [{"topic": "technology", "label": "Technology", "kind": "topic",
                                     "base_weight": 1.0, "weight": 1.0, "previous_weight": None}],
        "get_events_since": lambda u, s: [],
        "save_weights": lambda u, rows: None,
        "recent_edition_urls": lambda *a, **k: set(),
        "skipped_urls": lambda u: set(),
        "upsert_articles": lambda arts: {a["url"]: f"id-{n}" for n, a in enumerate(arts)},
        "insert_items": lambda rows: [{"id": f"item-{n}"} for n, _ in enumerate(rows)],
    }.items():
        monkeypatch.setattr(db, name, fn)

    async def fake_fetch(specs):
        return [_raw(i, "technology") for i in range(30)]

    async def no_enrich(arts):
        return None
    monkeypatch.setattr(eb, "fetch_all", fake_fetch)
    monkeypatch.setattr(eb, "enrich_images", no_enrich)
    monkeypatch.setattr(eb, "read_articles", slow_read)
    monkeypatch.setattr(eb, "run_editor", slow_editor)

    start = time.monotonic()
    asyncio.run(eb.run_pipeline("ed-2", "user-1"))
    first_two = sorted(t for _, t in calls[:2])
    assert first_two[1] - first_two[0] < 0.2  # started together
    assert time.monotonic() - start < 1.0     # 0.3 + 0.3 (overlapped) + 0.3 (picked stories), not more
