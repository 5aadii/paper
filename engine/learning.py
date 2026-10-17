"""Topic weight recomputation from events with time decay (SPEC Section 7.5).

Pure functions with no DB calls, so they can be unit-tested.
"""
from __future__ import annotations

from datetime import datetime, timezone

from config import EVENT_HALF_LIFE_DAYS, WEIGHT_MAX, WEIGHT_MIN
from sources import TOPICS

EVENT_DELTAS = {
    "open": 0.10, "click_through": 0.15, "like": 0.30,
    "quiz_correct": 0.05, "skip": -0.15, "dislike": -0.35, "quiz_wrong": 0.0,
}


def read_time_delta(seconds: float) -> float:
    """Reading time is the strongest quiet signal of real interest."""
    if seconds < 5:
        return -0.05          # opened, then bounced straight back: headline was misleading or dull
    if seconds < 15:
        return 0.0            # skimmed
    return 0.05 + 0.25 * min(seconds, 120) / 120   # 15 s → ~0.08 ... 120 s+ → 0.30


def event_delta(e: dict) -> float:
    if e["event_type"] == "read_time":
        return read_time_delta(float(e.get("value") or 0))
    return EVENT_DELTAS.get(e["event_type"], 0.0)


def _parse_time(v) -> datetime:
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    s = str(v).replace("Z", "+00:00")
    d = datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _clamp(x: float) -> float:
    return max(WEIGHT_MIN, min(WEIGHT_MAX, x))


def recompute_weights(interests: list[dict], events: list[dict], now: datetime) -> list[dict]:
    """
    weight(topic) = clamp(base_weight + Σ delta(e) * 0.5 ** (age_days(e) / 14), 0.1, 3.0)
    delta(e) = read_time_delta(e.value) for read_time events, else EVENT_DELTAS[e.type]

    Returns one dict per interest: {topic, label, kind, base_weight, weight, previous_weight, is_new}.
    Positive events on a known topic the reader does not have create a 'learned' interest.
    """
    totals: dict[str, float] = {}
    for e in events:
        topic = e.get("topic")
        if not topic:
            continue
        age_days = max(0.0, (now - _parse_time(e["created_at"])).total_seconds() / 86400)
        totals[topic] = totals.get(topic, 0.0) + event_delta(e) * 0.5 ** (age_days / EVENT_HALF_LIFE_DAYS)

    out: list[dict] = []
    have = set()
    for it in interests:
        have.add(it["topic"])
        new_w = round(_clamp(float(it.get("base_weight", 1.0)) + totals.get(it["topic"], 0.0)), 3)
        out.append({
            "topic": it["topic"], "label": it["label"], "kind": it.get("kind", "topic"),
            "base_weight": float(it.get("base_weight", 1.0)),
            "previous_weight": it.get("weight"), "weight": new_w, "is_new": False,
        })
    for topic, total in totals.items():
        if topic in have or topic not in TOPICS or total <= 0:
            continue
        out.append({
            "topic": topic, "label": TOPICS[topic]["label"], "kind": "learned",
            "base_weight": 0.0, "previous_weight": None,
            "weight": round(_clamp(total), 3), "is_new": True,
        })
    return out


def source_affinity(events: list[dict]) -> dict[str, int]:
    """+1 for click_through/like or read_time ≥ 30 s, −1 for skip/dislike or read_time < 5 s."""
    aff: dict[str, int] = {}
    for e in events:
        src = e.get("source_name")
        if not src:
            continue
        t, v = e["event_type"], float(e.get("value") or 0)
        if t in ("click_through", "like") or (t == "read_time" and v >= 30):
            aff[src] = aff.get(src, 0) + 1
        elif t in ("skip", "dislike") or (t == "read_time" and v < 5):
            aff[src] = aff.get(src, 0) - 1
    return aff


def reading_summary(events: list[dict]) -> dict[str, dict]:
    """Per topic: opens, total active minutes, average seconds per story read."""
    s: dict[str, dict] = {}
    for e in events:
        topic = e.get("topic")
        if not topic:
            continue
        row = s.setdefault(topic, {"opens": 0, "seconds": 0.0, "reads": 0})
        if e["event_type"] == "open":
            row["opens"] += 1
        elif e["event_type"] == "read_time":
            row["seconds"] += float(e.get("value") or 0)
            row["reads"] += 1
    return {t: {"opens": r["opens"], "minutes": round(r["seconds"] / 60, 1),
                "avg_seconds": round(r["seconds"] / r["reads"]) if r["reads"] else 0}
            for t, r in s.items()}
