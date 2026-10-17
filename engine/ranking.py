"""De-duplication, filtering, local scoring, candidate selection and the local
fallback edition (SPEC Section 7.4). Pure functions: no DB or network calls.
"""
from __future__ import annotations

import difflib
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from config import (EDITION_SIZE, EXPLORE_CANDIDATES, MAX_ARTICLE_AGE_HOURS, MAX_CANDIDATES,
                    SUMMARY_MAX_CHARS)
from sources import topic_label

MAX_PER_TOPIC = 8
EXPLORE_WEIGHT = 0.6
IMAGE_BOOST = 1.5
THIN_PENALTY = 0.7


# ---------------------------------------------------------------- text helpers
def truncate(text: str, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0].rstrip(",.;:—-")
    return (cut or text[: limit - 1]) + "…"


_SENT = re.compile(r"(?<=[.!?])\s+")


def first_sentence(text: str, limit: int = 120) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    return truncate(_SENT.split(text, 1)[0], limit)


# ---------------------------------------------------------------- dedupe
def normalize_url(url: str) -> str:
    p = urlparse(url.strip())
    query = urlencode([(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
                       if not k.lower().startswith("utm_")])
    path = p.path.rstrip("/")
    return urlunparse((p.scheme.lower(), p.netloc.lower(), path, p.params, query, ""))


def _ts(a: dict) -> float:
    d = a.get("published_at")
    return d.timestamp() if isinstance(d, datetime) else 0.0


def dedupe(articles: list[dict], topic_weights: dict[str, float]) -> list[dict]:
    """Exact URL dedupe, then near-duplicate titles (ratio > 0.82)."""
    def rank_key(a: dict):
        return (topic_weights.get(a["topic"], 0.0), _ts(a))

    by_url: dict[str, dict] = {}
    for a in articles:
        key = normalize_url(a["url"])
        cur = by_url.get(key)
        if cur is None or rank_key(a) > rank_key(cur):
            by_url[key] = a
    kept: list[dict] = []
    for a in sorted(by_url.values(), key=rank_key, reverse=True):
        t = a["title"].lower()
        if any(difflib.SequenceMatcher(None, t, k["title"].lower()).ratio() > 0.82 for k in kept):
            continue
        kept.append(a)
    return kept


# ---------------------------------------------------------------- filtering
def filter_articles(articles: list[dict], now: datetime, exclude_urls: set[str]) -> list[dict]:
    excl = {normalize_url(u) for u in exclude_urls}

    def ok(a: dict, max_hours: int) -> bool:
        if len(a["title"]) < 20 or normalize_url(a["url"]) in excl:
            return False
        d = a.get("published_at")
        if isinstance(d, datetime) and now - d > timedelta(hours=max_hours):
            return False
        return True

    out = [a for a in articles if ok(a, MAX_ARTICLE_AGE_HOURS)]
    if len([a for a in out if not a["is_explore"]]) < 20:
        out = [a for a in articles if ok(a, 72)]
    return out


# ---------------------------------------------------------------- scoring
def score_article(a: dict, now: datetime, weights: dict[str, float],
                  source_affinity: dict[str, int], custom_phrases: list[str]) -> float:
    d = a.get("published_at")
    if isinstance(d, datetime):
        hours_old = max(0.0, (now - d).total_seconds() / 3600)
        recency = 0.5 ** (hours_old / 18)
    else:
        recency = 0.5
    topic_weight = EXPLORE_WEIGHT if a["is_explore"] else weights.get(a["topic"], 0.5)
    aff = max(-4, min(4, source_affinity.get(a["source_name"], 0)))
    source_factor = 1 + 0.05 * aff
    hay = f'{a["title"]} {a.get("snippet", "")}'.lower()
    keyword_hits = sum(1 for p in custom_phrases if p and p.lower() in hay)
    image_factor = IMAGE_BOOST if a.get("image_url") else 1.0  # photos make the front page look like a paper
    content_factor = 1.0 if len(a.get("snippet") or "") >= 60 else THIN_PENALTY  # headline-only items read poorly
    return topic_weight * recency * source_factor * (1 + 0.3 * keyword_hits) * image_factor * content_factor


def select_candidates(articles: list[dict], now: datetime, weights: dict[str, float],
                      source_affinity: dict[str, int], custom_phrases: list[str]) -> list[dict]:
    """Top MAX_CANDIDATES (max 8 per topic) + top EXPLORE_CANDIDATES explore articles.
    Each returned candidate gets a short id (c1, c2, ...) and a `score`."""
    scored = [{**a, "score": score_article(a, now, weights, source_affinity, custom_phrases)}
              for a in articles]
    scored.sort(key=lambda a: a["score"], reverse=True)
    main: list[dict] = []
    per_topic: dict[str, int] = {}
    for a in scored:
        if a["is_explore"] or len(main) >= MAX_CANDIDATES:
            continue
        if per_topic.get(a["topic"], 0) >= MAX_PER_TOPIC:
            continue
        per_topic[a["topic"]] = per_topic.get(a["topic"], 0) + 1
        main.append(a)
    explore = [a for a in scored if a["is_explore"]][:EXPLORE_CANDIDATES]
    out = main + explore
    for i, a in enumerate(out, 1):
        a["id"] = f"c{i}"
    return out


# ---------------------------------------------------------------- fallback layout
def section_label(c: dict, labels: dict[str, str]) -> str:
    if c.get("is_explore"):
        return "Explore"
    return labels.get(c["topic"]) or topic_label(c["topic"])


def why_template(c: dict, labels: dict[str, str]) -> str:
    if c.get("is_explore"):
        return "Something new, outside your usual topics."
    if c["topic"].startswith("custom:"):
        return truncate(f'Matches your interest: {c["topic"][7:]}.', 100)
    return truncate(f"From your interest in {labels.get(c['topic']) or topic_label(c['topic'])}.", 100)


def fallback_story(c: dict, role: str, style: str, labels: dict[str, str]) -> dict:
    return {
        "id": c["id"],
        "section": "Briefs" if role == "brief" else section_label(c, labels),
        "layout_role": role,
        "headline": truncate(c["title"], 90),
        "dek": first_sentence(c.get("snippet") or c["title"], 120),
        "summary": truncate(c.get("snippet") or c["title"], SUMMARY_MAX_CHARS.get(style, 380)),
        "key_points": [],
        "why_this": why_template(c, labels),
    }


def assign_roles(n: int) -> list[str]:
    """Highest = lead; next 2 = features; then standard; the last 3 = briefs."""
    roles = []
    for i in range(n):
        if i == 0:
            roles.append("lead")
        elif i <= 2 and i < n - 3:
            roles.append("feature")
        elif i >= n - 3 and n >= 6:
            roles.append("brief")
        else:
            roles.append("standard")
    return roles


def build_fallback_layout(candidates: list[dict], style: str, reader_name: str = "",
                          labels: dict[str, str] | None = None) -> dict:
    """Returns the same shape as the AI editor output, built from local scores."""
    labels = labels or {}
    size = EDITION_SIZE.get(style, 11)
    main = sorted([c for c in candidates if not c.get("is_explore")], key=lambda c: c["score"], reverse=True)
    explore = sorted([c for c in candidates if c.get("is_explore")], key=lambda c: c["score"], reverse=True)
    n_explore = 1 if explore and len(main) >= 5 else 0
    chosen = main[: size - n_explore]
    stories = [fallback_story(c, r, style, labels) for c, r in zip(chosen, assign_roles(len(chosen)))]
    for c in explore[:n_explore]:
        stories.append(fallback_story(c, "standard", style, labels))
    name = reader_name or "reader"
    top3 = [s for s in stories if s["layout_role"] != "brief"][:3]
    by_id = {c["id"]: c for c in candidates}
    three = [{"id": s["id"], "text": first_sentence(by_id[s["id"]].get("snippet") or s["headline"], 200)}
             for s in top3]
    return {
        "editors_note": f"Good morning, {name}. Here are today's {len(stories)} stories picked for you.",
        "stories": stories,
        "three_things": three,
    }
