"""Supabase client (service role — bypasses RLS) + all DB functions used by the engine."""
from __future__ import annotations

from datetime import datetime
from functools import lru_cache

from supabase import Client, create_client

import config


class DBNotConfigured(RuntimeError):
    pass


@lru_cache(maxsize=1)
def client() -> Client:
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
        raise DBNotConfigured("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
    return create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)


def _t(name: str):
    return client().table(name)


# ---------------------------------------------------------------- profile + interests
def get_profile(user_id: str) -> dict | None:
    rows = _t("profiles").select("*").eq("id", user_id).limit(1).execute().data
    return rows[0] if rows else None


def get_interests(user_id: str) -> list[dict]:
    return _t("interests").select("*").eq("user_id", user_id).execute().data or []


def save_weights(user_id: str, rows: list[dict]) -> None:
    now = datetime.utcnow().isoformat() + "Z"
    for r in rows:
        if r.get("is_new"):
            _t("interests").upsert({
                "user_id": user_id, "topic": r["topic"], "label": r["label"], "kind": "learned",
                "base_weight": 0.0, "weight": r["weight"], "previous_weight": None, "updated_at": now,
            }, on_conflict="user_id,topic").execute()
        else:
            _t("interests").update({
                "weight": r["weight"], "previous_weight": r["previous_weight"], "updated_at": now,
            }).eq("user_id", user_id).eq("topic", r["topic"]).execute()


def get_events_since(user_id: str, since_iso: str) -> list[dict]:
    return (_t("events").select("topic,source_name,event_type,value,created_at,item_id")
            .eq("user_id", user_id).gte("created_at", since_iso)
            .order("created_at", desc=True).limit(5000).execute().data or [])


# ---------------------------------------------------------------- editions
def get_edition_by_date(user_id: str, edition_date: str) -> dict | None:
    rows = (_t("editions").select("*").eq("user_id", user_id).eq("edition_date", edition_date)
            .limit(1).execute().data)
    return rows[0] if rows else None


def get_edition(edition_id: str) -> dict | None:
    rows = _t("editions").select("*").eq("id", edition_id).limit(1).execute().data
    return rows[0] if rows else None


def count_editions(user_id: str) -> int:
    res = _t("editions").select("id", count="exact").eq("user_id", user_id).execute()
    return res.count or 0


def insert_edition(user_id: str, edition_date: str, edition_number: int) -> dict:
    return _t("editions").insert({
        "user_id": user_id, "edition_date": edition_date, "edition_number": edition_number,
        "status": "generating", "progress": "Reading your interests", "ai_status": "pending",
    }).execute().data[0]


def update_edition(edition_id: str, **fields) -> None:
    _t("editions").update(fields).eq("id", edition_id).execute()


def clear_items(edition_id: str) -> None:
    """Delete an edition's items for a regenerate.

    events.item_id cascades on delete, so first detach today's events from the items
    (item_id -> null). They keep their topic/source_name, so learning never loses them."""
    ids = [r["id"] for r in (_t("edition_items").select("id").eq("edition_id", edition_id).execute().data or [])]
    for i in range(0, len(ids), 100):
        _t("events").update({"item_id": None}).in_("item_id", ids[i:i + 100]).execute()
    _t("edition_items").delete().eq("edition_id", edition_id).execute()


def recent_edition_urls(user_id: str, n: int, exclude_edition_id: str | None = None) -> set[str]:
    eds = (_t("editions").select("id").eq("user_id", user_id).order("edition_date", desc=True)
           .limit(n + 1).execute().data or [])
    ids = [e["id"] for e in eds if e["id"] != exclude_edition_id][:n]
    if not ids:
        return set()
    rows = _t("edition_items").select("articles(url)").in_("edition_id", ids).execute().data or []
    return {r["articles"]["url"] for r in rows if r.get("articles")}


def skipped_urls(user_id: str) -> set[str]:
    ev = (_t("events").select("item_id").eq("user_id", user_id).in_("event_type", ["skip", "dislike"])
          .not_.is_("item_id", "null").limit(2000).execute().data or [])
    ids = list({e["item_id"] for e in ev})
    urls: set[str] = set()
    for i in range(0, len(ids), 100):
        rows = _t("edition_items").select("articles(url)").in_("id", ids[i:i + 100]).execute().data or []
        urls |= {r["articles"]["url"] for r in rows if r.get("articles")}
    return urls


# ---------------------------------------------------------------- articles + items
def upsert_articles(articles: list[dict]) -> dict[str, str]:
    """Upsert by url; returns {url: article_id}."""
    now = datetime.utcnow().isoformat() + "Z"
    rows, seen = [], set()
    for a in articles:
        if a["url"] in seen:
            continue
        seen.add(a["url"])
        rows.append({
            "url": a["url"], "title": a["title"], "source_name": a.get("source_name"),
            "snippet": a.get("snippet"), "image_url": a.get("image_url"), "topic": a.get("topic"),
            "published_at": a["published_at"].isoformat() if isinstance(a.get("published_at"), datetime) else None,
            "fetched_at": now,
        })
    out: dict[str, str] = {}
    for i in range(0, len(rows), 200):
        data = _t("articles").upsert(rows[i:i + 200], on_conflict="url").execute().data or []
        out.update({r["url"]: r["id"] for r in data})
    return out


def insert_items(rows: list[dict]) -> list[dict]:
    return _t("edition_items").insert(rows).execute().data or []


def get_items_with_articles(edition_id: str) -> list[dict]:
    return (_t("edition_items")
            .select("*, articles(url, title, source_name, published_at, image_url, snippet)")
            .eq("edition_id", edition_id).order("section_position").order("position")
            .execute().data or [])
