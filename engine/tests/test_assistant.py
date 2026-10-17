"""News Assistant query parsing + no-invention guarantees. Network and OpenRouter are mocked."""
from datetime import datetime, timezone

import assistant
from assistant import google_url, parse_query

NOW = datetime(2026, 10, 17, tzinfo=timezone.utc)


def test_year_query_sets_date_range_and_region():
    p = parse_query("Show me news about the 2018 elections in Pakistan", NOW)
    assert p["after"] == "2018-01-01" and p["before"] == "2018-12-31" and p["historical"]
    assert p["region"] == "pakistan" and "elections" in p["keywords"] and "2018" not in p["keywords"]
    assert "after%3A2018-01-01" in google_url(p) and "gl=PK" in google_url(p)


def test_relative_dates():
    assert parse_query("What are today's major technology stories?", NOW)["when"] == "1d"
    assert parse_query("news about Tesla from the last week", NOW)["when"] == "7d"
    assert parse_query("Find recent news about Pakistan's economy", NOW)["region"] == "pakistan"


def test_no_results_returns_no_answer(monkeypatch):
    monkeypatch.setattr(assistant, "search_google", lambda p: [])
    monkeypatch.setattr(assistant, "search_archive", lambda p: [])
    r = assistant.answer("something with no coverage")
    assert r["answer"] is None and r["ai_status"] == "no_results" and r["results"] == []


def test_invalid_citations_are_stripped(monkeypatch):
    art = {"url": "https://x.com/a", "title": "Real headline about a thing", "source_name": "Dawn",
           "snippet": "Snippet.", "published_at": NOW, "origin": "Google News search"}
    monkeypatch.setattr(assistant, "search_google", lambda p: [art])
    monkeypatch.setattr(assistant, "search_archive", lambda p: [])
    monkeypatch.setattr(assistant.config, "OPENROUTER_API_KEY", "k")
    monkeypatch.setattr(assistant.config, "OPENROUTER_MODEL", "m")
    monkeypatch.setattr(assistant, "_call", lambda s, u: ('{"answer": "It happened [1]. Also [7].", "used": [1]}', "m"))
    r = assistant.answer("what happened")
    assert r["ai_status"] == "success" and "[1]" in r["answer"] and "[7]" not in r["answer"] and r["cited"] == [1]
