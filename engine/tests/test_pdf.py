"""PDF renderer (SPEC 7.11)."""
import copy
import json
from pathlib import Path

from pdf.render import render_edition_pdf

SAMPLE = json.loads((Path(__file__).resolve().parents[1] / "samples" / "sample_edition.json").read_text(encoding="utf-8"))


def no_images(ed):
    ed = copy.deepcopy(ed)
    for s in ed["sections"]:
        for it in s["items"]:
            it["image_url"] = None
    return ed


def test_sample_renders():
    assert no_images(SAMPLE) and render_edition_pdf(no_images(SAMPLE)).startswith(b"%PDF")


def test_special_characters_do_not_crash():
    ed = no_images(SAMPLE)
    ed["paper_name"] = "The A & B <Times>"
    ed["sections"][0]["items"][0]["headline"] = "Tom & Jerry <script> 5 > 3"
    ed["sections"][0]["items"][0]["url"] = 'https://x.com/?a=1&b="2"'
    ed["editors_note"] = "Fish & chips < caviar"
    assert render_edition_pdf(ed).startswith(b"%PDF")


def test_minimal_edition_without_images():
    ed = {"paper_name": "P", "reader_name": "R", "edition_date": "2026-10-17", "edition_number": 1,
          "editors_note": "", "three_things": [], "sections": [{"name": "World", "items": [
              {**no_images(SAMPLE)["sections"][0]["items"][0], "layout_role": "lead"}]}]}
    assert render_edition_pdf(ed).startswith(b"%PDF")
