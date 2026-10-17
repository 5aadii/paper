"""OpenRouter call, JSON parsing and validation (SPEC Section 7.7).

Never put the API key, headers or the full raw response into logs, the DB or error messages.
"""
from __future__ import annotations

import json
import logging
import time

import httpx

import config
from config import AI_TIMEOUT_SECONDS, EDITION_SIZE, SUMMARY_MAX_CHARS
from prompts import EDITOR_SYSTEM, EDITOR_USER, SUMMARY_RULES
from ranking import fallback_story, first_sentence, section_label, truncate, why_template

log = logging.getLogger("engine.ai_editor")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
ROLES = {"lead", "feature", "standard", "brief"}


class EditorError(Exception):
    def __init__(self, error_type: str, message: str = ""):
        super().__init__(message or error_type)
        self.error_type = error_type
        self.message = message or error_type


# ---------------------------------------------------------------- parsing
def extract_json(text: str) -> dict:
    """Strip whitespace and code fences; fall back to first '{' .. last '}'.
    Raises EditorError('invalid_json')."""
    if text is None or not str(text).strip():
        raise EditorError("empty_response")
    t = str(text).strip()
    if t.startswith("```"):
        lines = [ln for ln in t.splitlines() if not ln.strip().startswith("```")]
        t = "\n".join(lines).strip()
    for attempt in (t, t[t.find("{"): t.rfind("}") + 1] if "{" in t and "}" in t else None):
        if not attempt:
            continue
        try:
            data = json.loads(attempt)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            continue
    raise EditorError("invalid_json", "model output was not valid JSON")


# ---------------------------------------------------------------- validation
def _str(v) -> str:
    return v.strip() if isinstance(v, str) else ""


def validate_editor_output(data: dict, candidate_ids: dict[str, dict], edition_size: int, style: str,
                           labels: dict[str, str] | None = None, reader_name: str = "") -> dict:
    """`candidate_ids` maps each candidate id (c1, c2, ...) to its candidate dict (title, snippet,
    topic, score, is_explore) so invalid fields can be repaired from the source.
    Raises EditorError('invalid_schema') if `stories` is not a list."""
    labels = labels or {}
    cands = candidate_ids
    if not isinstance(data, dict) or not isinstance(data.get("stories"), list):
        raise EditorError("invalid_schema", "stories missing or not a list")
    limit = SUMMARY_MAX_CHARS.get(style, 380)

    stories: list[dict] = []
    seen: set[str] = set()
    for s in data["stories"]:
        if not isinstance(s, dict):
            continue
        cid = s.get("id")
        if not isinstance(cid, str) or cid not in cands or cid in seen:
            continue
        seen.add(cid)
        c = cands[cid]
        role = s.get("layout_role") if s.get("layout_role") in ROLES else "standard"
        headline = _str(s.get("headline")) or c["title"]
        dek = _str(s.get("dek")) or first_sentence(c.get("snippet") or c["title"], 120)
        summary = s.get("summary") if isinstance(s.get("summary"), str) else (c.get("snippet") or c["title"])
        kp = s.get("key_points")
        key_points = ([truncate(p.strip(), 90) for p in kp if isinstance(p, str) and p.strip()][:3]
                      if isinstance(kp, list) else [])
        why = _str(s.get("why_this")) or why_template(c, labels)
        section = _str(s.get("section")) or section_label(c, labels)
        if c.get("is_explore") and section != "Explore":
            section = "Explore"
        if section == "Briefs":
            role = "brief"
        stories.append({
            "id": cid, "section": section, "layout_role": role,
            "headline": truncate(headline, 90), "dek": truncate(dek, 120),
            "summary": truncate(summary.strip() or c["title"], limit),
            "key_points": key_points, "why_this": truncate(why, 100),
        })

    # Too few valid stories -> fill from the local ranking up to edition size.
    if len(stories) < 5:
        extra = sorted([c for k, c in cands.items() if k not in seen and not c.get("is_explore")],
                       key=lambda c: c.get("score", 0), reverse=True)
        for c in extra[: max(0, edition_size - len(stories))]:
            role = "brief" if len(stories) >= edition_size - 3 else "standard"
            stories.append(fallback_story(c, role, style, labels))
            seen.add(c["id"])
    stories = stories[:edition_size] if len(stories) > edition_size else stories

    # Exactly one lead.
    leads = [s for s in stories if s["layout_role"] == "lead"]
    if not leads and stories:
        best = max(stories, key=lambda s: cands[s["id"]].get("score", 0) if not cands[s["id"]].get("is_explore") else -1)
        best["layout_role"] = "lead"
        if best["section"] in ("Briefs", "Explore"):
            best["section"] = section_label({**cands[best["id"]], "is_explore": False}, labels)
    elif len(leads) > 1:
        for s in leads[1:]:
            s["layout_role"] = "feature"

    note = _str(data.get("editors_note")) or (
        f"Good morning, {reader_name or 'reader'}. Here are today's {len(stories)} stories picked for you.")

    chosen = {s["id"] for s in stories}
    three: list[dict] = []
    tt = data.get("three_things")
    if isinstance(tt, list):
        for t in tt:
            if isinstance(t, dict) and t.get("id") in chosen and _str(t.get("text")):
                if t["id"] not in {x["id"] for x in three}:
                    three.append({"id": t["id"], "text": truncate(_str(t["text"]), 220)})
    for s in stories:
        if len(three) >= 3:
            break
        if s["id"] not in {x["id"] for x in three} and s["layout_role"] != "brief":
            three.append({"id": s["id"], "text": first_sentence(s["summary"], 220)})
    return {"editors_note": truncate(note, 400), "stories": stories, "three_things": three[:3]}


# ---------------------------------------------------------------- the call
def _post(payload: dict) -> httpx.Response:
    return httpx.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {config.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": config.APP_PUBLIC_URL,
            "X-Title": "The Morning Edition",
        },
        json=payload,
        timeout=AI_TIMEOUT_SECONDS,
    )


def _call(system: str, user: str) -> tuple[str, str]:
    """Returns (content, model_id). Raises EditorError."""
    payload = {
        "model": config.OPENROUTER_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    retried = False
    dropped_format = False
    while True:
        try:
            r = _post(payload)
        except httpx.TimeoutException:
            # No retry: a second slow attempt would double the reader's wait. The local fallback takes over.
            raise EditorError("timeout", "OpenRouter timed out")
        except httpx.HTTPError:
            raise EditorError("http_error", "could not reach OpenRouter")

        if r.status_code == 400 and not dropped_format and "response_format" in r.text:
            dropped_format = True
            payload.pop("response_format", None)
            continue
        if r.status_code == 429 or r.status_code >= 500:
            if not retried:
                retried = True
                time.sleep(2)
                continue
            raise EditorError("rate_limited" if r.status_code == 429 else "http_error",
                              f"OpenRouter returned HTTP {r.status_code}")
        if r.status_code != 200:
            raise EditorError("http_error", f"OpenRouter returned HTTP {r.status_code}")
        try:
            body = r.json()
        except ValueError:
            raise EditorError("invalid_json", "OpenRouter body was not JSON")
        if isinstance(body, dict) and body.get("error"):
            raise EditorError("http_error", "OpenRouter returned an error object")
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise EditorError("empty_response", "no choices in response")
        if not content or not str(content).strip():
            raise EditorError("empty_response", "model returned empty content")
        return str(content), str(body.get("model") or config.OPENROUTER_MODEL)


def run_editor(profile: dict, candidates: list[dict], labels: dict[str, str] | None = None) -> dict:
    """Returns {"success": True, "data": validated_dict, "model_id": ...}
       or {"success": False, "error_type": "...", "message": "..."}"""
    if not config.OPENROUTER_API_KEY or not config.OPENROUTER_MODEL:
        return {"success": False, "error_type": "missing_key", "message": "OpenRouter key or model not set"}
    style = profile.get("reading_style", "balanced")
    size = EDITION_SIZE.get(style, 11)
    system = EDITOR_SYSTEM.format(edition_size=size, summary_rule=SUMMARY_RULES.get(style, SUMMARY_RULES["balanced"]))
    cand_json = [{"id": c["id"], "title": c["title"], "source": c["source_name"], "topic": c["topic"],
                  "explore": bool(c.get("is_explore")), "photo": bool(c.get("image_url")), "snippet": (c.get("snippet") or "")[:400]}
                 for c in candidates]
    user = EDITOR_USER.format(profile_json=json.dumps(profile, ensure_ascii=False),
                              candidates_json=json.dumps(cand_json, ensure_ascii=False))
    try:
        content, model_id = _call(system, user)
        data = extract_json(content)
        validated = validate_editor_output(data, {c["id"]: c for c in candidates}, size, style,
                                           labels=labels, reader_name=profile.get("name", ""))
        if not validated["stories"]:
            raise EditorError("invalid_schema", "no valid stories")
        return {"success": True, "data": validated, "model_id": model_id}
    except EditorError as e:
        log.warning("ai_editor_failed error_type=%s", e.error_type)
        return {"success": False, "error_type": e.error_type, "message": e.message}
    except Exception:
        log.warning("ai_editor_failed error_type=http_error (unexpected)")
        return {"success": False, "error_type": "http_error", "message": "unexpected editor error"}
