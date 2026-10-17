"""Make engine/ importable when pytest runs from engine/ or the repo root."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
