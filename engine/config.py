"""Environment loading and constants for the engine (SPEC Section 7.1).

Secrets are read from `engine/.env` (never committed). Never log or print them.
If a key is missing the engine still starts; AI calls return a controlled
failure later and the edition uses the local fallback.
"""
from pathlib import Path

from dotenv import load_dotenv
import os

# Load engine/.env no matter which directory uvicorn/pytest is started from.
load_dotenv(Path(__file__).resolve().parent / ".env")

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip().rstrip("/").removesuffix("/rest/v1").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "")
SERVICE_SHARED_SECRET: str = os.getenv("SERVICE_SHARED_SECRET", "")
APP_PUBLIC_URL: str = os.getenv("APP_PUBLIC_URL", "http://localhost:3000")

EDITION_SIZE = {"quick": 8, "balanced": 11, "deep": 14}
SUMMARY_MAX_CHARS = {"quick": 220, "balanced": 380, "deep": 600}
MAX_CANDIDATES = 40
EXPLORE_CANDIDATES = 3
FEED_TIMEOUT_SECONDS = 8
MAX_ARTICLE_AGE_HOURS = 36       # fall back to 72 if fewer than 20 candidates
NO_REPEAT_LAST_N_EDITIONS = 3
WEIGHT_MIN, WEIGHT_MAX = 0.1, 3.0
EVENT_HALF_LIFE_DAYS = 14
