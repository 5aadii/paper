"""News Assistant: answer a question from real, retrieved articles only.

1. Parse the question for dates (years, "last week", "today"), region and keywords.
2. Search Google News RSS (with after:/before: or when: operators) and our own `articles` cache.
3. One OpenRouter call writes a short answer that may only use the numbered results, citing [n].
   If the AI is unavailable, the results are returned without an answer — never invented text.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import quote_plus

import httpx

import config
import db
from ai_editor import EditorError, _call, extract_json
from fetcher import USER_AGENT, parse_feed

log = logging.getLogger("engine.assistant")

STOP = set("""a an the of in on at for to about me show find what whats what's are is was were did does do happened happen
happening tell give news latest recent today today's todays major top biggest stories story articles article headlines
headline please any some and or from with by this that these those how why can could you i want get search look up last
past week weeks month months year years days day yesterday compare comparing reporting different publishers publisher
between vs versus coverage covered summarize summarise explain important matter matters new current currently there
their its it be been being has have had will would should into over under than more most which who whom whose where when
let us our my your again also just only same such very much many""".split())

PK_HINTS = ("pakistan", "karachi", "lahore", "islamabad", "rawalpindi", "peshawar", "quetta", "psl", "pti", "pml",
            "imran khan", "sharif", "sbp", "kse", "multan", "sindh", "punjab", "balochistan", "khyber")


def parse_query(q: str, now: datetime) -> dict:
    low = q.lower()
    years = [int(y) for y in re.findall(r"\b(19[5-9]\d|20[0-4]\d)\b", q)]
    after = before = when = None
    label = "recent coverage"
    if years:
        y1, y2 = min(years), max(years)
        after, before = f"{y1}-01-01", f"{y2}-12-31"
        label = f"{y1}" if y1 == y2 else f"{y1}–{y2}"
    elif "yesterday" in low:
        when, label = "2d", "the last 2 days"
    elif "today" in low or "this morning" in low or "right now" in low:
        when, label = "1d", "the last 24 hours"
    elif re.search(r"\b(last|past|this) week\b", low):
        when, label = "7d", "the last 7 days"
    elif re.search(r"\b(last|past|this) month\b", low):
        when, label = "30d", "the last 30 days"
    elif re.search(r"\b(last|past|this) year\b", low):
        when, label = "1y", "the last 12 months"
    region = "pakistan" if any(h in low for h in PK_HINTS) else "global"
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9'&.\-]*", q)
    terms = [w.strip(".'") for w in words if w.lower().strip(".'") not in STOP and not re.fullmatch(r"\d{4}", w)]
    keywords = " ".join(terms[:8]) or q.strip()
    return {"keywords": keywords, "terms": terms, "after": after, "before": before, "when": when,
            "region": region, "range_label": label, "historical": bool(years and max(years) < now.year)}


def google_url(p: dict) -> str:
    q = p["keywords"]
    if p["after"]:
        q += f" after:{p['after']} before:{p['before']}"
    elif p["when"]:
        q += f" when:{p['when']}"
    if p["region"] == "pakistan":
        return f"https://news.google.com/rss/search?q={quote_plus(q)}&hl=en-PK&gl=PK&ceid=PK:en"
    return f"https://news.google.com/rss/search?q={quote_plus(q)}&hl=en-US&gl=US&ceid=US:en"


def search_google(p: dict) -> list[dict]:
    try:
        r = httpx.get(google_url(p), timeout=8, follow_redirects=True, headers={"User-Agent": USER_AGENT})
        r.raise_for_status()
    except Exception:
        log.warning("assistant_search_failed source=google_news")
        return []
    spec = {"url": "https://news.google.com/rss", "topic": "search", "source_hint": None, "is_explore": False}
    out = parse_feed(r.content, spec)
    for a in out:
        a["origin"] = "Google News search"
    return out


def search_archive(p: dict) -> list[dict]:
    terms = sorted({t for t in p["terms"] if len(t) >= 3}, key=len, reverse=True)[:3]
    if not terms:
        return []
    try:
        rows = db.search_articles(terms, p["after"], p["before"])
    except Exception:
        log.warning("assistant_search_failed source=archive")
        return []
    out = []
    for r in rows:
        pub = r.get("published_at")
        out.append({"url": r["url"], "title": r["title"], "source_name": r.get("source_name") or "",
                    "snippet": r.get("snippet") or "", "image_url": r.get("image_url"),
                    "published_at": datetime.fromisoformat(pub.replace("Z", "+00:00")) if pub else None,
                    "origin": "Our article archive"})
    return out


SYSTEM = """You are a careful news research assistant. Answer the reader's question using ONLY the numbered search
results provided (title, source, date, snippet). Rules:
- Every factual sentence must cite the result(s) it comes from, like [1] or [2][4].
- Never invent facts, numbers, quotes, dates or stories that are not in the results.
- If the results do not answer the question, say so plainly and suggest a better search.
- If asked to compare publishers, compare only what the listed results show, by source name.
- Mention dates when they matter. Be neutral. 60 to 160 words.
Return valid JSON only, in this shape: {"answer": "string", "used": [1, 2]}"""


def answer(query: str) -> dict:
    query = (query or "").strip()[:300]
    now = datetime.now(timezone.utc)
    p = parse_query(query, now)
    found = search_google(p) + search_archive(p)

    seen, results = set(), []
    for a in found:
        key = a["url"].split("?")[0].lower()
        tkey = a["title"].lower()[:60]
        if key in seen or tkey in seen:
            continue
        seen |= {key, tkey}
        results.append(a)
    if p["after"]:
        lo = datetime.fromisoformat(p["after"]).replace(tzinfo=timezone.utc)
        hi = datetime.fromisoformat(p["before"]).replace(tzinfo=timezone.utc) + timedelta(days=1)
        results = [a for a in results if not a.get("published_at") or lo <= a["published_at"] < hi]
    else:
        results.sort(key=lambda a: a.get("published_at") or datetime(1970, 1, 1, tzinfo=timezone.utc), reverse=True)
    results = results[:10]

    out_results = [{
        "n": i + 1, "title": a["title"], "source": a.get("source_name") or "", "url": a["url"],
        "published_at": a["published_at"].isoformat() if a.get("published_at") else None,
        "snippet": (a.get("snippet") or "")[:300], "origin": a.get("origin", ""),
    } for i, a in enumerate(results)]

    coverage = f"Searched Google News and our own article archive for {p['range_label']}."
    if p["historical"]:
        coverage += (" Older coverage is incomplete: Google News search returns only part of its archive for past"
                     " years, and our own archive only holds articles fetched since this app went live.")

    if not results:
        return {"query": query, "answer": None, "ai_status": "no_results", "results": [], "coverage": coverage,
                "searched_for": p["keywords"]}

    if not config.OPENROUTER_API_KEY or not config.OPENROUTER_MODEL:
        return {"query": query, "answer": None, "ai_status": "unavailable", "results": out_results,
                "coverage": coverage, "searched_for": p["keywords"]}

    listing = "\n".join(
        f"[{r['n']}] {r['title']} — {r['source']} — {(r['published_at'] or 'date unknown')[:10]}"
        + (f"\n    {r['snippet']}" if r["snippet"] else "")
        for r in out_results)
    user = f"Today is {now.date().isoformat()}.\nQuestion: {query}\n\nSearch results:\n{listing}"
    try:
        content, _model = _call(SYSTEM, user)
        data = extract_json(content)
        text = data.get("answer") if isinstance(data, dict) else None
        if not isinstance(text, str) or not text.strip():
            raise EditorError("invalid_schema")
        valid = {r["n"] for r in out_results}
        cited = sorted({int(n) for n in re.findall(r"\[(\d+)\]", text) if int(n) in valid})
        text = re.sub(r"\[(\d+)\]", lambda m: m.group(0) if int(m.group(1)) in valid else "", text)
        return {"query": query, "answer": text.strip(), "cited": cited, "ai_status": "success",
                "results": out_results, "coverage": coverage, "searched_for": p["keywords"]}
    except Exception as e:
        log.warning("assistant_ai_failed error_type=%s", getattr(e, "error_type", type(e).__name__))
        return {"query": query, "answer": None, "ai_status": "unavailable", "results": out_results,
                "coverage": coverage, "searched_for": p["keywords"]}


if __name__ == "__main__":
    import sys
    print(json.dumps(parse_query(" ".join(sys.argv[1:]), datetime.now(timezone.utc)), indent=2))
