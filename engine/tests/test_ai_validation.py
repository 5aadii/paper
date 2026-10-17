"""AI output parsing + validation (SPEC 7.11). OpenRouter is always mocked: no credits spent."""
import json

import pytest

import ai_editor
from ai_editor import EditorError, extract_json, run_editor, validate_editor_output


def cands(n=12):
    return {f"c{i}": {"id": f"c{i}", "title": f"Candidate story number {i} about something", "snippet": f"Snippet {i}. More text.",
                      "topic": "technology", "source_name": "Src", "score": 1.0 / i, "is_explore": False, "url": f"https://x/{i}"}
            for i in range(1, n + 1)}


def story(i, role="standard", **kw):
    return {"id": f"c{i}", "section": "Technology", "layout_role": role, "headline": f"Headline {i}",
            "dek": "Dek", "summary": "Summary.", "key_points": [], "why_this": "Why", **kw}


def test_fenced_json_parses():
    assert extract_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert extract_json('Sure! {"a": 2} hope that helps') == {"a": 2}


def test_garbage_is_invalid_json():
    with pytest.raises(EditorError) as e:
        extract_json("this is not json at all")
    assert e.value.error_type == "invalid_json"


def test_unknown_ids_dropped():
    data = {"stories": [story(1, "lead")] + [story(i) for i in range(2, 8)] + [{**story(1), "id": "c99"}]}
    out = validate_editor_output(data, cands(), 11, "balanced")
    assert all(s["id"] != "c99" for s in out["stories"])


def test_zero_leads_fixed():
    out = validate_editor_output({"stories": [story(i) for i in range(1, 8)]}, cands(), 11, "balanced")
    leads = [s for s in out["stories"] if s["layout_role"] == "lead"]
    assert len(leads) == 1 and leads[0]["id"] == "c1"  # highest local score


def test_two_leads_fixed():
    data = {"stories": [story(1, "lead"), story(2, "lead")] + [story(i) for i in range(3, 8)]}
    out = validate_editor_output(data, cands(), 11, "balanced")
    assert [s["layout_role"] for s in out["stories"]].count("lead") == 1
    assert out["stories"][1]["layout_role"] == "feature"


def test_too_few_stories_filled():
    out = validate_editor_output({"stories": [story(1, "lead"), story(2)]}, cands(), 11, "balanced")
    assert len(out["stories"]) == 11
    assert len(out["three_things"]) == 3


def test_long_headline_truncated():
    data = {"stories": [story(1, "lead", headline="x" * 200)] + [story(i) for i in range(2, 8)]}
    out = validate_editor_output(data, cands(), 11, "balanced")
    assert len(out["stories"][0]["headline"]) <= 90


def test_bad_schema():
    with pytest.raises(EditorError) as e:
        validate_editor_output({"stories": "nope"}, cands(), 11, "balanced")
    assert e.value.error_type == "invalid_schema"


def test_missing_key_never_calls_network(monkeypatch):
    monkeypatch.setattr(ai_editor.config, "OPENROUTER_API_KEY", "")
    monkeypatch.setattr(ai_editor, "_post", lambda *a, **k: pytest.fail("network called"))
    r = run_editor({"name": "Saad", "reading_style": "balanced"}, list(cands().values()))
    assert r == {"success": False, "error_type": "missing_key", "message": "OpenRouter key or model not set"}


def test_mocked_success(monkeypatch):
    class Resp:
        status_code = 200
        text = ""
        def json(self):
            data = {"editors_note": "Hi", "stories": [story(1, "lead")] + [story(i) for i in range(2, 12)],
                    "three_things": [{"id": "c1", "text": "One."}]}
            return {"model": "test/model", "choices": [{"message": {"content": json.dumps(data)}}]}
    monkeypatch.setattr(ai_editor.config, "OPENROUTER_API_KEY", "test")
    monkeypatch.setattr(ai_editor.config, "OPENROUTER_MODEL", "test/model")
    monkeypatch.setattr(ai_editor, "_post", lambda payload: Resp())
    r = run_editor({"name": "Saad", "reading_style": "balanced"}, list(cands().values()))
    assert r["success"] and len(r["data"]["stories"]) == 11 and len(r["data"]["three_things"]) == 3
