"""Newspaper-style A4 PDF of one edition (SPEC Section 7.10).

    render_edition_pdf(edition: dict) -> bytes

Input is exactly the Section 5.2 contract. No DB access; the only network access is an
optional lead-image download (4 s timeout, skipped on any error).

CLI test:  python -m pdf.render samples/sample_edition.json out.pdf
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Flowable, Frame, FrameBreak, Image, KeepInFrame,
                                KeepTogether, NextPageTemplate, PageBreak, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle)
from reportlab.platypus.flowables import HRFlowable

PAPER = HexColor("#FBF8F1")
INK = HexColor("#1A1A1A")
MUTED = HexColor("#555555")
BOX = HexColor("#EFEBE0")
INK_HEX = "#1A1A1A"

PAGE_W, PAGE_H = A4
M = 36
W = PAGE_W - 2 * M
GUTTER = 12
COL_W = (W - 2 * GUTTER) / 3

# Page 1 geometry (points from the bottom)
MAST_BOTTOM = PAGE_H - M - 88            # 718
LEAD_TOP = MAST_BOTTOM - 6
LEAD_H = 200
LEAD_BOTTOM = LEAD_TOP - LEAD_H          # 482
BRIEF_BOTTOM, BRIEF_H = M, 58
COLS_BOTTOM = BRIEF_BOTTOM + BRIEF_H + 8
COLS_TOP = LEAD_BOTTOM - 8
# Inside pages
IN_TOP = PAGE_H - M - 20
IN_BOTTOM = M + 22

# ---------------------------------------------------------------- fonts
FONT_DIR = Path(__file__).resolve().parent / "fonts"


def _register_fonts() -> dict:
    try:
        files = {
            "MESerif": "DejaVuSerif.ttf", "MESerif-Bold": "DejaVuSerif-Bold.ttf",
            "MESerif-Italic": "DejaVuSerif-Italic.ttf", "MESans": "DejaVuSans.ttf",
        }
        for name, f in files.items():
            if name not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / f)))
        sans_bold = "MESans"
        if (FONT_DIR / "DejaVuSans-Bold.ttf").exists():
            if "MESans-Bold" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("MESans-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
            sans_bold = "MESans-Bold"
        pdfmetrics.registerFontFamily("MESerif", normal="MESerif", bold="MESerif-Bold",
                                      italic="MESerif-Italic", boldItalic="MESerif-Bold")
        pdfmetrics.registerFontFamily("MESans", normal="MESans", bold=sans_bold,
                                      italic="MESans", boldItalic=sans_bold)
        return {"serif": "MESerif", "bold": "MESerif-Bold", "italic": "MESerif-Italic",
                "sans": "MESans", "sansb": sans_bold}
    except Exception:
        return {"serif": "Times-Roman", "bold": "Times-Bold", "italic": "Times-Italic",
                "sans": "Helvetica", "sansb": "Helvetica-Bold"}


# ---------------------------------------------------------------- helpers
def esc(text) -> str:
    return escape(str(text or ""))


def link(url: str, text: str) -> str:
    if not url:
        return esc(text)
    return f'<a href="{escape(url, {chr(34): "&quot;"})}" color="{INK_HEX}">{esc(text)}</a>'


def long_date(iso: str) -> str:
    try:
        d = datetime.strptime(iso[:10], "%Y-%m-%d")
        return f"{d:%A}, {d.day} {d:%B %Y}"
    except Exception:
        return str(iso or "")


def ago(iso: str | None, ref: datetime | None = None) -> str:
    if not iso:
        return ""
    try:
        d = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        ref = ref or datetime.now(timezone.utc)
        hours = (ref - d).total_seconds() / 3600
        if hours < 1:
            return "just now"
        if hours < 48:
            return f"{int(hours)}h ago"
        return f"{d.day} {d:%b}"
    except Exception:
        return ""


def first_sentence(text: str) -> str:
    text = (text or "").strip()
    return re.split(r"(?<=[.!?])\s+", text, maxsplit=1)[0] if text else ""


class SectionMarker(Flowable):
    """Zero-size flowable that records the current section for the running header."""

    def __init__(self, name: str):
        super().__init__()
        self.name = name

    def wrap(self, aw, ah):
        return 0, 0

    def draw(self):
        self.canv._me_section = self.name


def _fetch_image(url: str | None):
    """Download a photo and re-encode it as JPEG (handles WebP/PNG/CMYK). Returns (BytesIO, w, h) or None."""
    if not url or not str(url).startswith("http"):
        return None
    try:
        import httpx
        from PIL import Image as PILImage

        r = httpx.get(url, timeout=5, follow_redirects=True, headers={"User-Agent": _UA})
        r.raise_for_status()
        im = PILImage.open(io.BytesIO(r.content))
        im.thumbnail((1200, 1200))
        im = im.convert("RGB")
        out = io.BytesIO()
        im.save(out, "JPEG", quality=82)
        out.seek(0)
        return out, im.width, im.height
    except Exception:
        return None


_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


# ---------------------------------------------------------------- renderer
def render_edition_pdf(edition: dict) -> bytes:
    """Never fails because of a photo: if a render with photos breaks, it is redone without them."""
    try:
        return _render(edition, with_images=True)
    except Exception:
        return _render(edition, with_images=False)


def _render(edition: dict, with_images: bool) -> bytes:
    F = _register_fonts()
    app_url = os.getenv("APP_PUBLIC_URL", "").strip() or "the web edition"
    paper_name = str(edition.get("paper_name") or "The Morning Edition")
    reader = str(edition.get("reader_name") or "Reader")
    date_iso = str(edition.get("edition_date") or "")
    number = edition.get("edition_number") or 1
    ref_time = None
    try:
        ref_time = datetime.strptime(date_iso[:10], "%Y-%m-%d").replace(hour=12, tzinfo=timezone.utc)
        ref_time = min(ref_time, datetime.now(timezone.utc))
    except Exception:
        pass

    S = {
        "kicker": ParagraphStyle("kicker", fontName=F["sansb"], fontSize=6.5, leading=8, textColor=MUTED, spaceAfter=1),
        "lead_h": ParagraphStyle("lead_h", fontName=F["bold"], fontSize=28, leading=31, textColor=INK, spaceAfter=5),
        "lead_dek": ParagraphStyle("lead_dek", fontName=F["italic"], fontSize=12, leading=15, textColor=INK, spaceAfter=5),
        "feat_h": ParagraphStyle("feat_h", fontName=F["bold"], fontSize=15, leading=17.5, textColor=INK, spaceAfter=3),
        "std_h": ParagraphStyle("std_h", fontName=F["bold"], fontSize=12, leading=14, textColor=INK, spaceAfter=2),
        "dek": ParagraphStyle("dek", fontName=F["italic"], fontSize=9, leading=11.5, textColor=INK, spaceAfter=3),
        "byline": ParagraphStyle("byline", fontName=F["sans"], fontSize=7.5, leading=9.5, textColor=MUTED, spaceAfter=2),
        "jump": ParagraphStyle("jump", fontName=F["sans"], fontSize=8, leading=10, textColor=INK),
        "box_label": ParagraphStyle("box_label", fontName=F["sansb"], fontSize=7.5, leading=10, textColor=INK, spaceAfter=3),
        "box_text": ParagraphStyle("box_text", fontName=F["serif"], fontSize=8.5, leading=11, textColor=INK),
        "thing": ParagraphStyle("thing", fontName=F["serif"], fontSize=8.5, leading=11, textColor=INK, spaceAfter=3,
                                leftIndent=10, firstLineIndent=-10),
        "brief_strip": ParagraphStyle("brief_strip", fontName=F["serif"], fontSize=8.5, leading=11.5, textColor=INK),
        "sec": ParagraphStyle("sec", fontName=F["sansb"], fontSize=9, leading=11, textColor=INK, spaceBefore=2, spaceAfter=6),
        "in_feat_h": ParagraphStyle("in_feat_h", fontName=F["bold"], fontSize=15, leading=17.5, textColor=INK, spaceAfter=3),
        "in_std_h": ParagraphStyle("in_std_h", fontName=F["bold"], fontSize=12, leading=14, textColor=INK, spaceAfter=2),
        "sum_feat": ParagraphStyle("sum_feat", fontName=F["serif"], fontSize=9.5, leading=12.5, textColor=INK,
                                   alignment=TA_JUSTIFY, spaceAfter=4),
        "sum_std": ParagraphStyle("sum_std", fontName=F["serif"], fontSize=9, leading=12, textColor=INK,
                                  alignment=TA_JUSTIFY, spaceAfter=4),
        "point": ParagraphStyle("point", fontName=F["serif"], fontSize=8.5, leading=11, textColor=INK,
                                leftIndent=9, firstLineIndent=-7, spaceAfter=1),
        "why": ParagraphStyle("why", fontName=F["italic"], fontSize=7.5, leading=9.5, textColor=MUTED, spaceAfter=3),
        "orig": ParagraphStyle("orig", fontName=F["sans"], fontSize=7.5, leading=9.5, textColor=INK, spaceAfter=10),
        "brief_line": ParagraphStyle("brief_line", fontName=F["serif"], fontSize=9, leading=11.5, textColor=INK,
                                     leftIndent=8, firstLineIndent=-8, spaceAfter=4),
    }

    sections = edition.get("sections") or []
    all_items = [(s.get("name", ""), it) for s in sections for it in (s.get("items") or [])]
    lead = next(((n, it) for n, it in all_items if it.get("layout_role") == "lead"), all_items[0] if all_items else None)
    briefs = [(n, it) for n, it in all_items if it.get("layout_role") == "brief"]
    middle = [(n, it) for n, it in all_items if it.get("layout_role") in ("feature", "standard") and (n, it) != lead]

    def byline(it) -> Paragraph:
        bits = [esc(str(it.get("source_name") or "").upper())]
        a = ago(it.get("published_at"), ref_time)
        if a:
            bits.append(esc(a))
        return Paragraph(" · ".join(b for b in bits if b), S["byline"])

    def rule(thick=0.6, before=4, after=5):
        return HRFlowable(width="100%", thickness=thick, color=INK, spaceBefore=before, spaceAfter=after)

    # ---------------- page 1: lead
    story: list = []
    if lead:
        sec_name, it = lead
        text = [Paragraph(esc(sec_name.upper()), S["kicker"]),
                Paragraph(link(it.get("url", ""), it.get("headline", "")), S["lead_h"])]
        if it.get("dek"):
            text.append(Paragraph(esc(it["dek"]), S["lead_dek"]))
        text += [byline(it), Paragraph("Full story, page 2 →", S["jump"])]
        fetched = _fetch_image(it.get("image_url")) if with_images else None
        if fetched:
            img, iw, ih = fetched
            tw = W * 0.34
            th = min(LEAD_H - 16, tw * ih / iw if iw else tw)
            pic = Image(img, width=tw, height=th, kind="proportional")
            block = Table([[text, pic]], colWidths=[W * 0.64, W * 0.36])
            block.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                                       ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                       ("RIGHTPADDING", (0, 0), (0, -1), 10),
                                       ("RIGHTPADDING", (1, 0), (1, -1), 0)]))
            content = [block]
        else:
            content = text
        story.append(KeepInFrame(W, LEAD_H - 4, content, mode="shrink"))
    story.append(FrameBreak())

    # ---------------- page 1: three columns
    def front_block(sec_name, it) -> list:
        is_feat = it.get("layout_role") == "feature"
        blk = [Paragraph(esc(sec_name.upper()), S["kicker"]),
               Paragraph(link(it.get("url", ""), it.get("headline", "")), S["feat_h" if is_feat else "std_h"])]
        if it.get("dek"):
            blk.append(Paragraph(esc(it["dek"]), S["dek"]))
        blk += [byline(it), Paragraph("→ inside", S["jump"]), rule(0.5, 5, 6)]
        return blk

    feats = [x for x in middle if x[1].get("layout_role") == "feature"]
    stds = [x for x in middle if x[1].get("layout_role") != "feature"]
    cols: list[list] = [[], [], []]
    for i, x in enumerate(feats):
        cols[i % 2].append(x)
    for i, x in enumerate(stds):
        if i < 4:
            cols[i % 2].append(x)
        else:
            cols[2].append(x)

    def boxes() -> list:
        out = []
        note = edition.get("editors_note") or ""
        if note:
            t = Table([[[Paragraph("FROM THE EDITOR", S["box_label"]), Paragraph(esc(note), S["box_text"])]]],
                      colWidths=[COL_W])
            t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BOX),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                                   ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
            out += [t, Spacer(1, 8)]
        things = edition.get("three_things") or []
        if things:
            out += [rule(2.5, 0, 4), Paragraph("THREE THINGS TO REMEMBER TODAY", S["box_label"])]
            for n, t in enumerate(things[:3], 1):
                out.append(Paragraph(f"<b>{n}.</b> {esc(t.get('text', ''))}", S["thing"]))
        return out

    col_h = COLS_TOP - COLS_BOTTOM
    for ci in range(3):
        content = []
        for sec_name, it in cols[ci]:
            content += front_block(sec_name, it)
        if ci == 2:
            content += boxes()
        story.append(KeepInFrame(COL_W, col_h - 2, content or [Spacer(1, 1)], mode="shrink"))
        story.append(FrameBreak())

    # ---------------- page 1: In Brief strip
    if briefs:
        heads = " · ".join(link(it.get("url", ""), it.get("headline", "")) for _, it in briefs)
        strip = [Paragraph(f'<font name="{F["sansb"]}" size="7.5">IN BRIEF</font>&nbsp;&nbsp; {heads}', S["brief_strip"])]
    else:
        strip = [Spacer(1, 1)]
    story.append(KeepInFrame(W, BRIEF_H - 6, strip, mode="shrink"))
    story.append(NextPageTemplate("Later"))
    story.append(PageBreak())

    # ---------------- inside pages: full stories by section
    def inside_story(it) -> list:
        role = it.get("layout_role")
        if role == "brief":
            return [Paragraph(f"• <b>{link(it.get('url', ''), it.get('headline', ''))}</b> "
                              f"{esc(first_sentence(it.get('summary', '')))}", S["brief_line"])]
        big = role in ("lead", "feature")
        out = [Paragraph(link(it.get("url", ""), it.get("headline", "")), S["in_feat_h" if big else "in_std_h"]),
               byline(it)]
        if it.get("summary"):
            out.append(Paragraph(esc(it["summary"]), S["sum_feat" if big else "sum_std"]))
        for p in (it.get("key_points") or [])[:3]:
            out.append(Paragraph(f"• {esc(p)}", S["point"]))
        if big and it.get("why_this"):
            out.append(Paragraph(f"Why this: {esc(it['why_this'])}", S["why"]))
        if it.get("url"):
            out.append(Paragraph(f'<a href="{escape(it["url"], {chr(34): "&quot;"})}" color="{INK_HEX}">'
                                 f'Read the original at {esc(it.get("source_name") or "the source")} →</a>', S["orig"]))
        return out

    first_section = sections[0].get("name", "") if sections else ""
    for s in sections:
        name = s.get("name", "")
        items = s.get("items") or []
        if not items:
            continue
        header = "EXPLORE — SOMETHING NEW" if name == "Explore" else name.upper()
        head = [SectionMarker(name), rule(2.5, 2, 3), Paragraph(esc(header), S["sec"])]
        blocks = [inside_story(it) for it in items]
        story.append(KeepTogether(head + blocks[0]))
        for b in blocks[1:]:
            story += b
        story.append(Spacer(1, 6))

    # ---------------- page callbacks
    def background(canv):
        canv.saveState()
        canv.setFillColor(PAPER)
        canv.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
        canv.restoreState()

    def col_rules(canv, top, bottom):
        canv.setStrokeColor(INK)
        canv.setLineWidth(0.5)
        for i in (1, 2):
            x = M + i * COL_W + (i - 0.5) * GUTTER
            canv.line(x, bottom, x, top)

    def first_page(canv, doc):
        background(canv)
        canv.saveState()
        canv.setStrokeColor(INK)
        canv.setFillColor(INK)
        top = PAGE_H - M
        canv.setLineWidth(0.6)
        canv.line(M, top, M + W, top)
        size = 44
        while size > 18 and pdfmetrics.stringWidth(paper_name, F["bold"], size) > W:
            size -= 1
        name_base = top - 10 - size * 0.78
        canv.setFont(F["bold"], size)
        canv.drawCentredString(PAGE_W / 2, name_base, paper_name)
        y = name_base - 12
        canv.setLineWidth(3)
        canv.line(M, y, M + W, y)
        canv.setLineWidth(0.6)
        canv.line(M, y - 4, M + W, y - 4)
        info_y = y - 16
        canv.setFont(F["sans"], 8)
        canv.drawString(M, info_y, f"VOL. 1 · NO. {number}")
        canv.drawCentredString(PAGE_W / 2, info_y, long_date(date_iso))
        canv.drawRightString(M + W, info_y, f"PREPARED FOR {reader.upper()}")
        canv.line(M, info_y - 6, M + W, info_y - 6)
        canv.line(M, LEAD_BOTTOM - 4, M + W, LEAD_BOTTOM - 4)
        canv.line(M, BRIEF_BOTTOM + BRIEF_H + 3, M + W, BRIEF_BOTTOM + BRIEF_H + 3)
        col_rules(canv, COLS_TOP, COLS_BOTTOM)
        canv.restoreState()

    def later_page(canv, doc):
        background(canv)
        canv.saveState()
        canv.setFillColor(INK)
        canv.setStrokeColor(INK)
        top = PAGE_H - M
        canv.setFont(F["bold"], 9)
        canv.drawString(M, top - 9, paper_name)
        canv.setFont(F["sans"], 7.5)
        sec = getattr(canv, "_me_section", None) or first_section
        canv.drawRightString(M + W, top - 9, f"{sec} · {long_date(date_iso)}")
        canv.setLineWidth(0.6)
        canv.line(M, top - 14, M + W, top - 14)
        col_rules(canv, IN_TOP, IN_BOTTOM)
        canv.line(M, M + 16, M + W, M + 16)
        canv.setFont(F["sans"], 7.5)
        canv.drawCentredString(PAGE_W / 2, M + 6, f"— {doc.page} —")
        canv.setFillColor(MUTED)
        canv.setFont(F["sans"], 6.5)
        canv.drawCentredString(PAGE_W / 2, M - 4, f"Read the originals at {app_url}")
        canv.restoreState()

    first_frames = [Frame(M, LEAD_BOTTOM, W, LEAD_H, id="lead", leftPadding=0, rightPadding=0, topPadding=2, bottomPadding=2)]
    for i in range(3):
        first_frames.append(Frame(M + i * (COL_W + GUTTER), COLS_BOTTOM, COL_W, COLS_TOP - COLS_BOTTOM, id=f"c{i}",
                                  leftPadding=0, rightPadding=0, topPadding=2, bottomPadding=0))
    first_frames.append(Frame(M, BRIEF_BOTTOM, W, BRIEF_H, id="brief", leftPadding=0, rightPadding=0, topPadding=2, bottomPadding=0))
    later_frames = [Frame(M + i * (COL_W + GUTTER), IN_BOTTOM, COL_W, IN_TOP - IN_BOTTOM, id=f"in{i}",
                          leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0) for i in range(3)]

    buf = io.BytesIO()
    doc = BaseDocTemplate(buf, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=M, bottomMargin=M,
                          title=f"{paper_name} — {long_date(date_iso)}", author=paper_name)
    doc.addPageTemplates([PageTemplate(id="First", frames=first_frames, onPage=first_page),
                          PageTemplate(id="Later", frames=later_frames, onPage=later_page)])
    doc.build(story)
    return buf.getvalue()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python -m pdf.render samples/sample_edition.json out.pdf")
        sys.exit(1)
    with open(sys.argv[1], encoding="utf-8") as f:
        data = json.load(f)
    pdf = render_edition_pdf(data)
    with open(sys.argv[2], "wb") as f:
        f.write(pdf)
    print(f"Wrote {sys.argv[2]} ({len(pdf) // 1024} KB)")
