"""FastAPI app + routes only (SPEC Section 7.9).

All routes except /health require header `X-Service-Key: <SERVICE_SHARED_SECRET>`.
Run locally from engine/:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import hmac
import logging
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, Response
from pydantic import BaseModel

import config
import db
from edition_builder import load_edition_json, prepare_edition, run_pipeline_sync
from learning import recompute_weights

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
log = logging.getLogger("engine")

app = FastAPI(title="The Morning Edition engine")


def require_service_key(x_service_key: str | None = Header(default=None)) -> None:
    secret = config.SERVICE_SHARED_SECRET
    if not secret or not x_service_key or not hmac.compare_digest(x_service_key, secret):
        raise HTTPException(status_code=401, detail="unauthorized")


class GenerateBody(BaseModel):
    user_id: str
    force: bool = False


class AssistantBody(BaseModel):
    query: str


class RecomputeBody(BaseModel):
    user_id: str
    live: bool = False  # True when triggered by a reading event (keeps the per-edition ▲/▼ baseline)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/editions/generate", status_code=202, dependencies=[Depends(require_service_key)])
def generate(body: GenerateBody, background: BackgroundTasks) -> dict:
    try:
        edition_id, status, needs_run = prepare_edition(body.user_id, body.force)
    except LookupError:
        raise HTTPException(status_code=404, detail="profile_not_found")
    except db.DBNotConfigured:
        raise HTTPException(status_code=503, detail="database_not_configured")
    if needs_run:
        background.add_task(run_pipeline_sync, edition_id, body.user_id)
    return {"edition_id": edition_id, "status": status}


def _generate_all() -> None:
    for user_id in db.onboarded_user_ids():
        try:
            edition_id, _status, needs_run = prepare_edition(user_id)
            if needs_run:
                run_pipeline_sync(edition_id, user_id)
        except Exception as e:  # one reader's failure never stops the morning run
            log.error("cron_edition_failed reason=%s", type(e).__name__)


@app.post("/editions/generate-all", status_code=202, dependencies=[Depends(require_service_key)])
def generate_all(background: BackgroundTasks) -> dict:
    """Daily freshness (SPEC Section 8.11): print today's paper for every onboarded reader."""
    background.add_task(_generate_all)
    return {"queued": True}


@app.get("/editions/{edition_id}/pdf", dependencies=[Depends(require_service_key)])
def edition_pdf(edition_id: str, user_id: str = Query(...)) -> Response:
    from pdf.render import render_edition_pdf

    edition = load_edition_json(edition_id)
    if not edition or edition.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="not_found")
    pdf_bytes = render_edition_pdf(edition)
    filename = f"morning-edition-{edition['edition_date']}.pdf"
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@app.post("/learning/recompute", dependencies=[Depends(require_service_key)])
def learning_recompute(body: RecomputeBody) -> list[dict]:
    now = datetime.now(timezone.utc)
    interests = db.get_interests(body.user_id)
    events = db.get_events_since(body.user_id, (now - timedelta(days=30)).isoformat())
    rows = recompute_weights(interests, events, now)
    db.save_weights(body.user_id, rows, keep_previous=body.live)
    return [{k: v for k, v in r.items() if k != "is_new"} for r in rows]


@app.post("/assistant/search", dependencies=[Depends(require_service_key)])
def assistant_search(body: AssistantBody) -> dict:
    from assistant import answer

    if not body.query.strip():
        raise HTTPException(status_code=400, detail="empty_query")
    return answer(body.query)


@app.get("/cartoons", dependencies=[Depends(require_service_key)])
def cartoons() -> dict:
    from cartoons import get_cartoons

    return {"cartoons": get_cartoons()}
