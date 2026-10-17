"""Orchestrates the pipeline end to end (SPEC Section 7.8)."""
from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import db
from ai_editor import run_editor
from config import EDITION_SIZE, NO_REPEAT_LAST_N_EDITIONS
from fetcher import FeedSpec, enrich_images, fetch_all
from learning import recompute_weights, source_affinity
from prompts import PROMPT_VERSION
from ranking import build_fallback_layout, dedupe, filter_articles, select_candidates
from sources import EXPLORE_POOL, TOPICS, google_news_rss, topic_label
import config

log = logging.getLogger("engine.builder")


def local_date(tz: str | None) -> str:
    try:
        zone = ZoneInfo(tz or "Asia/Karachi")
    except Exception:
        zone = ZoneInfo("Asia/Karachi")
    return datetime.now(zone).date().isoformat()


# ---------------------------------------------------------------- step 1–2: the row
def prepare_edition(user_id: str, force: bool = False) -> tuple[str, str, bool]:
    """Find or create today's edition row. Returns (edition_id, status, needs_run)."""
    profile = db.get_profile(user_id)
    if not profile:
        raise LookupError("profile_not_found")
    edition_date = local_date(profile.get("timezone"))
    existing = db.get_edition_by_date(user_id, edition_date)
    if existing and not force:
        if existing["status"] == "failed":
            return existing["id"], "failed", False
        return existing["id"], existing["status"], False
    if existing:
        db.clear_items(existing["id"])
        db.update_edition(existing["id"], status="generating", progress="Reading your interests",
                          ai_status="pending", error_type=None, editors_note=None, three_things=[])
        return existing["id"], "generating", True
    row = db.insert_edition(user_id, edition_date, db.count_editions(user_id) + 1)
    return row["id"], "generating", True


# ---------------------------------------------------------------- step 5: feeds
def build_feed_specs(interests: list[dict], region: str) -> list[FeedSpec]:
    specs: list[FeedSpec] = []
    followed = set()
    for it in interests:
        if float(it.get("weight", 1.0)) < 0.3:
            continue
        topic = it["topic"]
        followed.add(topic)
        if topic.startswith("custom:"):
            phrase = topic[7:]
            specs.append(FeedSpec(url=google_news_rss(phrase, "pakistan" if region != "global" else "global"),
                                  topic=topic, source_hint=None, is_explore=False))
            continue
        t = TOPICS.get(topic)
        if not t:
            continue
        if region in ("global", "both"):
            specs += [FeedSpec(url=u, topic=topic, source_hint=None, is_explore=False) for u in t["feeds"]]
            specs.append(FeedSpec(url=google_news_rss(t["query"], "global"), topic=topic, source_hint=None, is_explore=False))
        if region in ("pakistan", "both"):
            specs += [FeedSpec(url=u, topic=topic, source_hint=None, is_explore=False) for u in t["pakistan_feeds"]]
            specs.append(FeedSpec(url=google_news_rss(t["pakistan_query"], "pakistan"), topic=topic, source_hint=None, is_explore=False))
    pool = [t for t in EXPLORE_POOL if t not in followed]
    for topic in random.sample(pool, min(3, len(pool))):
        specs.append(FeedSpec(url=google_news_rss(TOPICS[topic]["query"], "global"), topic=topic,
                              source_hint=None, is_explore=True))
    seen, out = set(), []
    for s in specs:
        if (s["url"], s["topic"]) not in seen:
            seen.add((s["url"], s["topic"]))
            out.append(s)
    return out


# ---------------------------------------------------------------- step 8: layout -> rows
def order_sections(stories: list[dict], cand_by_id: dict, weights: dict[str, float]) -> list[str]:
    lead = next((s for s in stories if s["layout_role"] == "lead"), stories[0])
    sec_weight: dict[str, float] = {}
    for s in stories:
        c = cand_by_id[s["id"]]
        sec_weight[s["section"]] = max(sec_weight.get(s["section"], 0), weights.get(c["topic"], 0.5))
    rest = [n for n in sec_weight if n not in (lead["section"], "Explore", "Briefs")]
    rest.sort(key=lambda n: sec_weight[n], reverse=True)
    order = [lead["section"]] + rest
    if "Explore" in sec_weight and lead["section"] != "Explore":
        order.append("Explore")
    if "Briefs" in sec_weight and lead["section"] != "Briefs":
        order.append("Briefs")
    return order


ROLE_ORDER = {"lead": 0, "feature": 1, "standard": 2, "brief": 3}


# ---------------------------------------------------------------- the pipeline
async def run_pipeline(edition_id: str, user_id: str) -> None:
    try:
        profile = db.get_profile(user_id) or {}
        style = profile.get("reading_style") or "balanced"
        region = profile.get("region") or "both"
        name = profile.get("display_name") or "reader"
        now = datetime.now(timezone.utc)

        # 4. learning
        db.update_edition(edition_id, progress="Reading your interests")
        interests = db.get_interests(user_id)
        events = db.get_events_since(user_id, (now - timedelta(days=30)).isoformat())
        new_weights = recompute_weights(interests, events, now)
        db.save_weights(user_id, new_weights)
        weights = {w["topic"]: w["weight"] for w in new_weights}
        labels = {w["topic"]: topic_label(w["topic"]) for w in new_weights}
        affinity = source_affinity(events)
        custom_phrases = [w["topic"][7:] for w in new_weights if w["topic"].startswith("custom:")]

        # 5–6. fetch, cache, rank
        db.update_edition(edition_id, progress="Collecting today's stories")
        specs = build_feed_specs([{"topic": w["topic"], "weight": w["weight"]} for w in new_weights], region)
        raw = await fetch_all(specs)
        exclude = db.recent_edition_urls(user_id, NO_REPEAT_LAST_N_EDITIONS, exclude_edition_id=edition_id) | db.skipped_urls(user_id)
        articles = filter_articles(dedupe(raw, weights), now, exclude)
        candidates = select_candidates(articles, now, weights, affinity, custom_phrases)
        if not candidates:
            raise RuntimeError("no_candidates")
        await enrich_images(sorted(candidates, key=lambda c: -c["score"]))
        url_to_id = db.upsert_articles(candidates)
        cand_by_id = {c["id"]: c for c in candidates}

        # 7. one AI call, else local fallback
        db.update_edition(edition_id, progress="The editor is choosing")
        ai_profile = {
            "name": name, "reading_style": style, "region": region,
            "topics": [{"slug": w["topic"], "label": labels[w["topic"]], "weight": w["weight"]}
                       for w in sorted(new_weights, key=lambda w: -w["weight"]) if not w["topic"].startswith("custom:")],
            "custom_interests": custom_phrases,
        }
        result = run_editor(ai_profile, candidates, labels=labels)
        if result["success"]:
            layout, ai_status, error_type, model_id = result["data"], "success", None, result["model_id"]
        else:
            layout = build_fallback_layout(candidates, style, name, labels)
            ai_status, error_type, model_id = "fallback", result["error_type"], config.OPENROUTER_MODEL or None

        # 8. save items
        db.update_edition(edition_id, progress="Setting the type")
        stories = layout["stories"][: EDITION_SIZE.get(style, 11)]
        sec_order = order_sections(stories, cand_by_id, weights)
        rows = []
        for s_pos, sec in enumerate(sec_order):
            in_sec = [s for s in stories if s["section"] == sec]
            in_sec.sort(key=lambda s: ROLE_ORDER[s["layout_role"]])
            for pos, s in enumerate(in_sec):
                c = cand_by_id[s["id"]]
                rows.append({
                    "edition_id": edition_id, "article_id": url_to_id[c["url"]],
                    "section": sec, "section_position": s_pos, "position": pos,
                    "layout_role": s["layout_role"], "headline": s["headline"], "dek": s["dek"],
                    "summary": s["summary"], "key_points": s["key_points"], "why_this": s["why_this"],
                    "topic": c["topic"], "is_explore": bool(c.get("is_explore")), "score": round(c["score"], 4),
                    "_cid": s["id"],
                })
        cids = [r.pop("_cid") for r in rows]
        inserted = db.insert_items(rows)
        cid_to_item = {cid: it["id"] for cid, it in zip(cids, inserted)}

        # 9. ready
        three = [{"text": t["text"], "item_id": cid_to_item[t["id"]]}
                 for t in layout["three_things"] if t["id"] in cid_to_item]
        db.update_edition(edition_id, status="ready", progress=None, editors_note=layout["editors_note"],
                          three_things=three, ai_status=ai_status, error_type=error_type,
                          model_id=model_id, prompt_version=PROMPT_VERSION)
    except Exception as e:  # 10. never leave an edition stuck
        log.error("edition_failed edition=%s reason=%s", edition_id, type(e).__name__)
        try:
            db.update_edition(edition_id, status="failed", error_type="internal", progress=None)
        except Exception:
            pass


def run_pipeline_sync(edition_id: str, user_id: str) -> None:
    """Runs the pipeline in its own event loop. FastAPI runs sync background tasks in a worker
    thread, so the blocking Supabase/OpenRouter calls never freeze the API."""
    asyncio.run(run_pipeline(edition_id, user_id))


async def generate_edition(user_id: str, force: bool = False) -> str:  # returns edition_id
    edition_id, _status, needs_run = prepare_edition(user_id, force)
    if needs_run:
        await run_pipeline(edition_id, user_id)
    return edition_id


# ---------------------------------------------------------------- Section 5.2 contract
def load_edition_json(edition_id: str) -> dict | None:
    ed = db.get_edition(edition_id)
    if not ed:
        return None
    profile = db.get_profile(ed["user_id"]) or {}
    items = db.get_items_with_articles(edition_id)
    sections: list[dict] = []
    for it in items:
        a = it.get("articles") or {}
        if not sections or sections[-1]["name"] != it["section"]:
            sections.append({"name": it["section"], "items": []})
        sections[-1]["items"].append({
            "item_id": it["id"], "layout_role": it["layout_role"], "headline": it["headline"],
            "dek": it.get("dek") or "", "summary": it.get("summary") or "",
            "key_points": it.get("key_points") or [], "why_this": it.get("why_this") or "",
            "source_name": a.get("source_name") or "", "published_at": a.get("published_at"),
            "url": a.get("url") or "", "image_url": a.get("image_url"),
            "topic": it.get("topic"), "is_explore": bool(it.get("is_explore")),
        })
    return {
        "edition_id": ed["id"], "user_id": ed["user_id"],
        "paper_name": profile.get("paper_name") or "The Morning Edition",
        "reader_name": profile.get("display_name") or "Reader",
        "edition_date": ed["edition_date"], "edition_number": ed["edition_number"],
        "reading_style": profile.get("reading_style") or "balanced",
        "editors_note": ed.get("editors_note") or "", "ai_status": ed["ai_status"],
        "three_things": ed.get("three_things") or [], "sections": sections,
    }
