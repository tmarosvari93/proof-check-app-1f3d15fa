"""Build the fictional Proof Check test set.

Product: Mezőlak Mangós instant zabkása, 400 g, carton box (fictional brand,
company, address and codes). Outputs into ../fixtures:

  spec_SP-2026-0417_v3.xlsx        spec with 19 blue (mandatory) fields
  spec_SP-2026-0417_v3_signed.pdf  same spec as the signed PDF partners get
  proof_v1.pdf                     round 1 proof, 6 seeded errors (vector text)
  proof_v1_commented.pdf           v1 + 6 reviewer sticky-note comments (not used by build plan v4)
  proof_v2.pdf                     round 2 proof: 5 fixed, 1 ignored,
                                   2 unrequested changes, side panels swapped
  proof_v3.pdf                     round 3 proof: clean (build plan v4)
  proof_v{1,2,3}_flat.pdf          image-only versions (no text layer)
  answer_key.json                  expected findings per test case

Run: python3 scripts/build_testset.py
"""
import json, os, subprocess
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A3, A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (DictionaryObject, NameObject, TextStringObject,
                           ArrayObject, FloatObject, BooleanObject)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fixtures")
os.makedirs(OUT, exist_ok=True)
F = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("Sans", F + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("Sans-B", F + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Cond", F + "DejaVuSansCondensed.ttf"))
pdfmetrics.registerFont(TTFont("Cond-B", F + "DejaVuSansCondensed-Bold.ttf"))

# ---------------------------------------------------------------- spec data
SPEC_META = {
    "company": "Mezőlak Élelmiszer Kft. (fiktív)",
    "doc_number": "SP-2026-0417", "version": "3", "valid_from": "2026-10-15",
    "erp_code": "MZL-10482", "packaging_code_box": "CS-20931",
}
# (id, section, label, value, blue)
SPEC_ROWS = [
    ("name", "1. Termékadatok", "Termék megnevezése", "Mangós instant zabkása szárított mangódarabokkal", True),
    (None, "1. Termékadatok", "Termékleírás", "Előfőzött zabpehely alapú instant kása szárított mangódarabokkal, tejporral. Forró folyadékkal elkészítendő.", False),
    ("net_qty", "1. Termékadatok", "Nettó tömeg", "400 g", True),
    ("servings", "1. Termékadatok", "Adagok száma", "A csomag 8 adagot tartalmaz.", True),
    (None, "1. Termékadatok", "Csomagolás", "Kartondoboz, belső PE tasak", False),
    ("ingredients", "2. Összetevők és allergének", "Összetevők", "ZABPEHELY (68%), cukor, szárított mangó (12%), TELJES TEJPOR, rizsliszt, természetes aroma, só.", True),
    (None, "2. Összetevők és allergének", "Allergének (belső)", "zab (glutén), tej", False),
    ("may_contain", "2. Összetevők és allergének", "Keresztszennyeződés", "Nyomokban szóját és diófélét tartalmazhat.", True),
    ("energy", "3. Tápérték (100 g termékben)", "Energia", "1602 kJ / 380 kcal", True),
    ("fat", "3. Tápérték (100 g termékben)", "Zsír", "6,8 g", True),
    ("saturates", "3. Tápérték (100 g termékben)", "ebből telített zsírsavak", "2,1 g", True),
    ("carbs", "3. Tápérték (100 g termékben)", "Szénhidrát", "64,5 g", True),
    ("sugars", "3. Tápérték (100 g termékben)", "ebből cukrok", "22,4 g", True),
    ("fibre", "3. Tápérték (100 g termékben)", "Rost", "7,9 g", True),
    ("protein", "3. Tápérték (100 g termékben)", "Fehérje", "11,2 g", True),
    ("salt", "3. Tápérték (100 g termékben)", "Só", "0,18 g", True),
    ("per_serving", "3. Tápérték (100 g termékben)", "Energia adagonként (50 g)", "801 kJ / 190 kcal", True),
    (None, "4. Fizikai-kémiai jellemzők", "Nedvességtartalom", "max. 8,0%", False),
    (None, "4. Fizikai-kémiai jellemzők", "Szemcseméret (mangó)", "3–6 mm", False),
    (None, "5. Mikrobiológiai határértékek", "Összes csíraszám", "< 10⁴ TKE/g", False),
    (None, "5. Mikrobiológiai határértékek", "Penész és élesztő", "< 10³ TKE/g", False),
    (None, "5. Mikrobiológiai határértékek", "Salmonella", "nem mutatható ki 25 g-ban", False),
    ("preparation", "6. Felhasználás és tárolás", "Felhasználási javaslat", "50 g zabkásához adjon 150 ml forró tejet vagy vizet, keverje el, és hagyja állni 2 percig.", True),
    ("storage", "6. Felhasználás és tárolás", "Tárolás", "Száraz, hűvös helyen, közvetlen napfénytől védve tárolandó. Felbontás után légmentesen zárva tartandó.", True),
    (None, "6. Felhasználás és tárolás", "Minőségmegőrzési idő", "12 hónap a gyártástól", False),
    ("best_before", "6. Felhasználás és tárolás", "Minőségmegőrzés jelölése", "Minőségét megőrzi: a jelölt mezőben feltüntetett napig.", True),
    ("manufacturer", "7. Jelölés", "Gyártó", "Gyártja: Mezőlak Élelmiszer Kft., 9999 Mintaváros, Malom utca 7.", True),
    ("origin", "7. Jelölés", "Előállítás helye", "Magyarországon előállítva.", True),
    (None, "8. Tanúsítványok", "Üzem tanúsítványa", "IFS Food (fiktív)", False),
    (None, "9. Jóváhagyás", "Készítette", "Kovács Anna (K+F, fiktív)", False),
    (None, "9. Jóváhagyás", "Jóváhagyta", "Szabó Péter (minőségbiztosítás, fiktív)", False),
]
BLUE = "0070C0"


def build_xlsx(path):
    wb = Workbook(); ws = wb.active; ws.title = "Specifikáció"
    thin = Side(style="thin", color="BBBBBB")
    ws.column_dimensions["A"].width = 32; ws.column_dimensions["B"].width = 80
    ws["A1"] = SPEC_META["company"]; ws["A1"].font = Font(bold=True, size=12)
    ws["A2"] = "TERMÉKSPECIFIKÁCIÓ / GYÁRTMÁNYLAP"; ws["A2"].font = Font(bold=True, size=14)
    meta = [("Specifikáció száma", SPEC_META["doc_number"]), ("Verzió", SPEC_META["version"]),
            ("Érvényes", SPEC_META["valid_from"]), ("ERP termékkód", SPEC_META["erp_code"]),
            ("Csomagolóanyag kód (doboz)", SPEC_META["packaging_code_box"])]
    r = 4
    for k, v in meta:
        ws.cell(r, 1, k).font = Font(bold=True); ws.cell(r, 2, v); r += 1
    r += 1
    ws.cell(r, 1, "Jelmagyarázat:").font = Font(italic=True)
    ws.cell(r, 2, "Kék színű szöveg = kötelezően feltüntetendő jelölési elem").font = Font(italic=True, color=BLUE)
    r += 2
    section = None
    for fid, sec, label, value, blue in SPEC_ROWS:
        if sec != section:
            section = sec
            c = ws.cell(r, 1, sec); c.font = Font(bold=True, color="FFFFFF")
            c.fill = PatternFill("solid", fgColor="555555")
            ws.cell(r, 2).fill = PatternFill("solid", fgColor="555555"); r += 1
        a = ws.cell(r, 1, label); b = ws.cell(r, 2, value)
        b.font = Font(color=BLUE) if blue else Font(color="000000")
        b.alignment = Alignment(wrap_text=True, vertical="top")
        a.alignment = Alignment(vertical="top")
        for c in (a, b):
            c.border = Border(top=thin, bottom=thin, left=thin, right=thin)
        r += 1
    ws.cell(r + 1, 1, "Aláírások a kiadott PDF-en.").font = Font(italic=True, color="777777")
    wb.save(path)


def build_spec_pdf(path):
    c = canvas.Canvas(path, pagesize=A4); W, H = A4
    y = H - 20 * mm
    c.setFont("Sans-B", 11); c.drawString(20 * mm, y, SPEC_META["company"]); y -= 7 * mm
    c.setFont("Sans-B", 14); c.drawString(20 * mm, y, "TERMÉKSPECIFIKÁCIÓ / GYÁRTMÁNYLAP"); y -= 8 * mm
    c.setFont("Sans", 9)
    for k, v in [("Specifikáció száma", SPEC_META["doc_number"]), ("Verzió", SPEC_META["version"]),
                 ("Érvényes", SPEC_META["valid_from"]), ("ERP termékkód", SPEC_META["erp_code"])]:
        c.drawString(20 * mm, y, f"{k}: {v}"); y -= 5 * mm
    c.setFillColor(HexColor("#" + BLUE)); c.drawString(20 * mm, y, "Kék színű szöveg = kötelezően feltüntetendő jelölési elem")
    c.setFillColor(black); y -= 8 * mm
    section = None
    for fid, sec, label, value, blue in SPEC_ROWS:
        if y < 30 * mm:
            c.showPage(); y = H - 20 * mm
        if sec != section:
            section = sec; y -= 2 * mm
            c.setFont("Sans-B", 10); c.drawString(20 * mm, y, sec); y -= 6 * mm
        c.setFont("Sans", 8.5); c.setFillColor(black); c.drawString(20 * mm, y, label)
        c.setFillColor(HexColor("#" + BLUE) if blue else black)
        lines = simpleSplit(value, "Sans", 8.5, 115 * mm)
        for ln in lines:
            c.drawString(75 * mm, y, ln); y -= 4.2 * mm
        y -= 1.5 * mm
    c.setFillColor(black); y -= 8 * mm
    c.setFont("Sans", 9)
    c.drawString(20 * mm, y, "Készítette: Kovács Anna  ____________ 2026-10-14")
    c.drawString(110 * mm, y, "Jóváhagyta: Szabó Péter  ____________ 2026-10-15")
    c.save()


# ---------------------------------------------------------------- proof data
SPEC = {fid: value for fid, _, _, value, blue in SPEC_ROWS if fid}

V1 = dict(SPEC)
V1["name"] = "Sárgabarackos instant zabkása szárított mangódarabokkal"   # E1 leftover flavour
V1["carbs"] = "46,5 g"                                                  # E2 swapped digits
V1["salt"] = "0,18 mg"                                                  # E3 g -> mg
V1["servings"] = "A csomag 10 adagot tartalmaz."                         # E5 wrong servings
V1["may_contain"] = None                                                # E6 missing
V1_ALLERGEN_EMPHASIS = {"ZABPEHELY": True, "TEJPOR": False}             # E4 milk not emphasised
V1_CLAIMS = ["Erősíti az immunrendszert!"]                              # out of MVP scope

V2 = dict(SPEC)
V2["preparation"] = "50 g zabkásához adjon 200 ml forró tejet vagy vizet, keverje el, és hagyja állni 2 percig."  # U1 unrequested
V2_ALLERGEN_EMPHASIS = {"ZABPEHELY": True, "TEJPOR": False}             # C4 ignored
V2_CLAIMS = ["Erősíti az immunrendszert!", "Hozzáadott cukor nélkül"]  # U2 unrequested new claim

# v3 (build plan v4): clean. Every requested fix is in, the two unrequested changes are reverted,
# the original claim is kept, side panels as in v2.
V3 = dict(SPEC)
V3_ALLERGEN_EMPHASIS = {"ZABPEHELY": True, "TEJPOR": True}
V3_CLAIMS = ["Erősíti az immunrendszert!"]

PANEL_W = {"side_a": 80 * mm, "front": 130 * mm, "side_b": 80 * mm, "back": 130 * mm}
INK = HexColor("#2B2118"); MANGO = HexColor("#F2A531"); LEAF = HexColor("#5B8C3A")
BG = HexColor("#FFF6E5")


class Blocks:
    def __init__(self): self.items = []
    def add(self, bid, panel, kind, text, x, y_top, w, h, field=None):
        self.items.append({"id": bid, "panel": panel, "kind": kind, "field": field, "text": text,
                           "bbox_pt": [round(x, 1), round(y_top - h, 1), round(x + w, 1), round(y_top, 1)]})


def para(c, text, x, y, w, font="Sans", size=7.5, lead=9.5, color=INK):
    c.setFont(font, size); c.setFillColor(color)
    lines = simpleSplit(text, font, size, w)
    for ln in lines:
        c.drawString(x, y, ln); y -= lead
    return y, len(lines) * lead


def ingredients_line(c, x, y, w, emph, size=7.5, lead=9.5):
    """Ingredients with per-word emphasis, wrapped manually."""
    tokens = [("Összetevők: ", "Sans-B")]
    words = ("ZABPEHELY (68%), cukor, szárított mangó (12%), TELJES TEJPOR, rizsliszt, "
             "természetes aroma, só.").split(" ")
    for wd in words:
        core = wd.strip(",.()%0123456789")
        if core in ("ZABPEHELY",):
            tokens.append((wd + " ", "Sans-B" if emph["ZABPEHELY"] else "Sans"))
        elif core in ("TELJES", "TEJPOR"):
            if emph["TEJPOR"]:
                tokens.append((wd + " ", "Sans-B"))
            else:
                tokens.append((wd.lower() + " ", "Sans"))
        else:
            tokens.append((wd + " ", "Sans"))
    cx, cy = x, y; c.setFillColor(INK)
    for t, f in tokens:
        tw = pdfmetrics.stringWidth(t, f, size)
        if cx + tw > x + w:
            cx = x; cy -= lead
        c.setFont(f, size); c.drawString(cx, cy, t); cx += tw
    text = "".join(t for t, _ in tokens).strip()
    return cy - lead, text, (y - cy) + lead


def draw_proof(path, data, emph, claims, order, version_label, date):
    W, H = landscape(A3)
    c = canvas.Canvas(path, pagesize=(W, H))
    c.setTitle(f"Mezőlak Mangós zabkása 400 g - doboz - {version_label}")
    blocks = Blocks()
    top, bottom = H - 30 * mm, 40 * mm
    x = 0
    xs = {}
    for p in order:
        xs[p] = x; x += PANEL_W[p]
    # panel backgrounds + fold lines
    for p in order:
        c.setFillColor(BG if p in ("front", "back") else HexColor("#FFFBF2"))
        c.rect(xs[p], bottom, PANEL_W[p], top - bottom, stroke=0, fill=1)
    c.setDash(4, 3); c.setStrokeColor(HexColor("#999999")); c.setLineWidth(0.6)
    for p in order[1:]:
        c.line(xs[p], bottom - 5 * mm, xs[p], top + 5 * mm)
    c.setDash(); c.rect(0.5, bottom, W - 1, top - bottom, stroke=1, fill=0)
    pad = 7 * mm

    # FRONT
    fx, fw = xs["front"] + pad, PANEL_W["front"] - 2 * pad
    y = top - 14 * mm
    c.setFont("Sans-B", 20); c.setFillColor(LEAF); c.drawString(fx, y, "MEZŐLAK")
    blocks.add("brand", "front", "brand", "MEZŐLAK", fx, y + 16, 60 * mm, 20)
    y -= 14 * mm
    y2, h = para(c, data["name"], fx, y, fw, "Sans-B", 17, 21)
    blocks.add("name", "front", "name", data["name"], fx, y + 16, fw, h, field="name")
    # drawn mango (illustration, not a photo)
    cx, cy = xs["front"] + PANEL_W["front"] / 2, bottom + 105 * mm
    c.setFillColor(MANGO); c.ellipse(cx - 32 * mm, cy - 22 * mm, cx + 32 * mm, cy + 22 * mm, stroke=0, fill=1)
    c.setFillColor(LEAF); c.ellipse(cx + 18 * mm, cy + 16 * mm, cx + 38 * mm, cy + 26 * mm, stroke=0, fill=1)
    c.setFont("Sans", 6); c.setFillColor(HexColor("#8a6d3b"))
    c.drawCentredString(cx, cy - 27 * mm, "Tálalási javaslat – illusztráció")
    # claims badges
    by = bottom + 62 * mm
    for i, cl in enumerate(claims):
        bx = fx + i * 58 * mm
        c.setFillColor(LEAF); c.roundRect(bx, by, 54 * mm, 13 * mm, 6, stroke=0, fill=1)
        c.setFillColor(white); c.setFont("Sans-B", 8.5)
        c.drawCentredString(bx + 27 * mm, by + 5 * mm, cl)
        blocks.add(f"claim_{i+1}", "front", "claim", cl, bx, by + 13 * mm, 54 * mm, 13 * mm)
    c.setFont("Sans-B", 16); c.setFillColor(INK)
    c.drawRightString(xs["front"] + PANEL_W["front"] - pad, bottom + 12 * mm, data["net_qty"])
    blocks.add("net_front", "front", "net_qty", data["net_qty"], xs["front"] + PANEL_W["front"] - pad - 30 * mm,
               bottom + 12 * mm + 14, 30 * mm, 18, field="net_qty")

    # BACK
    bx, bw = xs["back"] + pad, PANEL_W["back"] - 2 * pad
    y = top - 12 * mm
    c.setFont("Sans-B", 10); c.setFillColor(INK); c.drawString(bx, y, data["name"])
    blocks.add("name_back", "back", "name", data["name"], bx, y + 10, bw, 13, field="name"); y -= 10 * mm
    y_start = y
    y, ing_text, h = ingredients_line(c, bx, y, bw, emph)
    blocks.add("ingredients", "back", "ingredients", ing_text, bx, y_start + 8, bw, h, field="ingredients")
    if data["may_contain"]:
        y0 = y
        y, h = para(c, data["may_contain"], bx, y, bw, "Sans", 7.5, 9.5)
        blocks.add("may_contain", "back", "allergen_statement", data["may_contain"], bx, y0 + 8, bw, h, field="may_contain")
    y -= 6 * mm
    # nutrition table
    c.setFont("Sans-B", 8); c.drawString(bx, y, "Átlagos tápérték"); c.drawRightString(bx + bw, y, "100 g termékben")
    t_top = y + 10; y -= 4 * mm
    rows = [("Energia", "energy"), ("Zsír", "fat"), ("ebből telített zsírsavak", "saturates"),
            ("Szénhidrát", "carbs"), ("ebből cukrok", "sugars"), ("Rost", "fibre"),
            ("Fehérje", "protein"), ("Só", "salt")]
    c.setStrokeColor(INK); c.setLineWidth(0.4)
    c.line(bx, y + 1, bx + bw, y + 1)
    for lab, fid in rows:
        y -= 11
        c.setFont("Sans", 7.5); c.setFillColor(INK)
        c.drawString(bx + (8 if lab.startswith("ebből") else 0), y, lab)
        c.drawRightString(bx + bw, y, data[fid])
        c.line(bx, y - 3.5, bx + bw, y - 3.5)
        blocks.add(f"nut_{fid}", "back", "nutrition_row", f"{lab} {data[fid]}", bx, y + 8, bw, 11, field=fid)
    c.rect(bx - 3, y - 6, bw + 6, t_top - (y - 6), stroke=1, fill=0)
    y -= 12 * mm
    t = f"Energia adagonként (50 g): {data['per_serving']}"
    y0 = y; y, h = para(c, t, bx, y, bw)
    blocks.add("per_serving", "back", "nutrition_row", t, bx, y0 + 8, bw, h, field="per_serving")
    y0 = y; y, h = para(c, data["servings"], bx, y, bw)
    blocks.add("servings", "back", "servings", data["servings"], bx, y0 + 8, bw, h, field="servings")
    # barcode placeholder
    c.setFillColor(white); c.rect(bx + bw - 40 * mm, bottom + 8 * mm, 40 * mm, 22 * mm, stroke=1, fill=1)
    c.setFillColor(INK); c.setFont("Sans", 6); c.drawCentredString(bx + bw - 20 * mm, bottom + 4 * mm, "EAN (fiktív) 5990000000000")
    for i in range(30):
        c.rect(bx + bw - 37 * mm + i * 1.1 * mm, bottom + 11 * mm, 0.5 * mm if i % 3 else 0.9 * mm, 16 * mm, stroke=0, fill=1)

    # SIDE A: preparation + storage
    ax, aw = xs["side_a"] + pad, PANEL_W["side_a"] - 2 * pad
    y = top - 14 * mm
    c.setFont("Sans-B", 9); c.setFillColor(INK); c.drawString(ax, y, "Elkészítés"); y -= 6 * mm
    y0 = y; y, h = para(c, data["preparation"], ax, y, aw)
    blocks.add("preparation", "side_a", "preparation", data["preparation"], ax, y0 + 8, aw, h, field="preparation")
    y -= 8 * mm
    c.setFont("Sans-B", 9); c.drawString(ax, y, "Tárolás"); y -= 6 * mm
    y0 = y; y, h = para(c, data["storage"], ax, y, aw)
    blocks.add("storage", "side_a", "storage", data["storage"], ax, y0 + 8, aw, h, field="storage")

    # SIDE B: best before + LOT + manufacturer + origin
    sx, sw = xs["side_b"] + pad, PANEL_W["side_b"] - 2 * pad
    y = top - 14 * mm
    y0 = y; y, h = para(c, data["best_before"], sx, y, sw)
    blocks.add("best_before", "side_b", "best_before", data["best_before"], sx, y0 + 8, sw, h, field="best_before")
    c.setDash(2, 2); c.setStrokeColor(HexColor("#C0392B"))
    c.rect(sx, y - 18 * mm, sw, 18 * mm, stroke=1, fill=0); c.setDash()
    c.setFont("Sans", 6); c.setFillColor(HexColor("#C0392B"))
    c.drawCentredString(sx + sw / 2, y - 10 * mm, "Kódolási mező: MM / LOT (nem nyomtatandó)")
    y -= 26 * mm
    y0 = y; y, h = para(c, data["manufacturer"], sx, y, sw)
    blocks.add("manufacturer", "side_b", "manufacturer", data["manufacturer"], sx, y0 + 8, sw, h, field="manufacturer")
    y -= 4 * mm
    y0 = y; y, h = para(c, data["origin"], sx, y, sw)
    blocks.add("origin", "side_b", "origin", data["origin"], sx, y0 + 8, sw, h, field="origin")

    # title block (designer's proof info) - outside the artwork
    c.setFillColor(INK); c.setFont("Sans", 8)
    c.drawString(10 * mm, 22 * mm, f"Mezőlak – Mangós instant zabkása 400 g – Doboz (CS-20931)  |  Termékkód: MZL-10482  |  Spec: SP-2026-0417 v3")
    c.drawString(10 * mm, 16 * mm, f"KORREKTÚRA {version_label}  |  {date}  |  Grafika: Studio Fiktív  |  Csak ellenőrzésre, nem nyomdai anyag")
    c.setFont("Sans", 7); c.setFillColor(HexColor("#777777"))
    names = {"side_a": "OLDALLAP – elkészítés/tárolás", "front": "ELŐLAP", "side_b": "OLDALLAP – MM/gyártó", "back": "HÁTLAP"}
    for p in order:
        c.drawCentredString(xs[p] + PANEL_W[p] / 2, top + 8 * mm, names[p])
    c.save()
    return blocks.items


def add_comments(src, dst, comments, blocks):
    r = PdfReader(src); w = PdfWriter(); w.append(r)
    page = w.pages[0]
    annots = page.get("/Annots") or ArrayObject()
    bmap = {b["id"]: b for b in blocks}
    for cm in comments:
        x0, y0, x1, y1 = bmap[cm["anchor_block"]]["bbox_pt"]
        # highlight-style square around the anchored block
        sq = DictionaryObject({
            NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Square"),
            NameObject("/Rect"): ArrayObject([FloatObject(x0 - 3), FloatObject(y0 - 3), FloatObject(x1 + 3), FloatObject(y1 + 3)]),
            NameObject("/C"): ArrayObject([FloatObject(0.9), FloatObject(0.1), FloatObject(0.1)]),
            NameObject("/Contents"): TextStringObject(cm["text"]),
            NameObject("/T"): TextStringObject(cm["author"]),
            NameObject("/NM"): TextStringObject(cm["id"]),
            NameObject("/M"): TextStringObject("D:20261021100000+01'00'"),
        })
        note = DictionaryObject({
            NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Text"),
            NameObject("/Rect"): ArrayObject([FloatObject(x1 + 2), FloatObject(y1 - 18), FloatObject(x1 + 20), FloatObject(y1)]),
            NameObject("/Contents"): TextStringObject(cm["text"]),
            NameObject("/T"): TextStringObject(cm["author"]),
            NameObject("/NM"): TextStringObject(cm["id"] + "-note"),
            NameObject("/Name"): NameObject("/Comment"), NameObject("/Open"): BooleanObject(False),
            NameObject("/C"): ArrayObject([FloatObject(1), FloatObject(0.85), FloatObject(0.1)]),
        })
        annots.append(w._add_object(sq)); annots.append(w._add_object(note))
    page[NameObject("/Annots")] = annots
    with open(dst, "wb") as f:
        w.write(f)


def flatten(src, dst, dpi=150):
    base = os.path.join(OUT, "_tmp_flat")
    subprocess.run(["pdftoppm", "-r", str(dpi), "-png", "-singlefile", src, base], check=True)
    from PIL import Image
    Image.open(base + ".png").convert("RGB").save(dst, "PDF", resolution=dpi)
    os.remove(base + ".png")


COMMENTS_V1 = [
    {"id": "C1", "anchor_block": "name", "author": "Ellenőr 1 (fiktív)",
     "text": "A termék mangós, nem sárgabarackos. Kérjük a megnevezést a specifikáció szerint javítani."},
    {"id": "C2", "anchor_block": "nut_carbs", "author": "Ellenőr 1 (fiktív)",
     "text": "Szénhidrát: a specifikáció szerint 64,5 g (a terven 46,5 g szerepel)."},
    {"id": "C3", "anchor_block": "nut_salt", "author": "Ellenőr 2 (fiktív)",
     "text": "Só: 0,18 g, nem mg. Kérjük a mértékegységet javítani."},
    {"id": "C4", "anchor_block": "ingredients", "author": "Ellenőr 2 (fiktív)",
     "text": "Az allergén TELJES TEJPOR nincs kiemelve. Kérjük félkövérrel kiemelni, mint a zabpelyhet."},
    {"id": "C5", "anchor_block": "servings", "author": "Ellenőr 1 (fiktív)",
     "text": "A csomag 8 adagot tartalmaz (400 g / 50 g), nem 10-et."},
    {"id": "C6", "anchor_block": "ingredients", "author": "Ellenőr 2 (fiktív)",
     "text": "Hiányzik a keresztszennyeződési mondat: 'Nyomokban szóját és diófélét tartalmazhat.' Az összetevők után kérjük feltüntetni."},
]


def main():
    build_xlsx(os.path.join(OUT, "spec_SP-2026-0417_v3.xlsx"))
    build_spec_pdf(os.path.join(OUT, "spec_SP-2026-0417_v3_signed.pdf"))
    b1 = draw_proof(os.path.join(OUT, "proof_v1.pdf"), V1, V1_ALLERGEN_EMPHASIS, V1_CLAIMS,
                    ["side_a", "front", "side_b", "back"], "v1", "2026-10-20")
    add_comments(os.path.join(OUT, "proof_v1.pdf"), os.path.join(OUT, "proof_v1_commented.pdf"), COMMENTS_V1, b1)
    b2 = draw_proof(os.path.join(OUT, "proof_v2.pdf"), V2, V2_ALLERGEN_EMPHASIS, V2_CLAIMS,
                    ["side_b", "front", "side_a", "back"], "v2", "2026-10-27")   # side panels swapped
    b3 = draw_proof(os.path.join(OUT, "proof_v3.pdf"), V3, V3_ALLERGEN_EMPHASIS, V3_CLAIMS,
                    ["side_b", "front", "side_a", "back"], "v3", "2026-10-30")   # clean, panels as in v2
    for v in ("v1", "v2", "v3"):
        flatten(os.path.join(OUT, f"proof_{v}.pdf"), os.path.join(OUT, f"proof_{v}_flat.pdf"))

    blue_fields = [{"id": fid, "label": lab, "value": val} for fid, _, lab, val, blue in SPEC_ROWS if blue]
    key = {
        "product": "Mezőlak Mangós instant zabkása 400 g (fictional)",
        "piece": "box CS-20931", "spec": f"{SPEC_META['doc_number']} v{SPEC_META['version']}",
        "spec_blue_fields": blue_fields,
        "spec_black_fields_count": sum(1 for r in SPEC_ROWS if not r[4]),
        "case_1_round1_v1_vs_spec": {
            "proof": "proof_v1.pdf (and proof_v1_flat.pdf)",
            "expected_findings": [
                {"field": "name", "verdict": "mismatch", "spec": SPEC["name"], "proof": V1["name"], "note": "leftover flavour from reused design"},
                {"field": "carbs", "verdict": "mismatch", "spec": "64,5 g", "proof": "46,5 g", "note": "swapped digits"},
                {"field": "salt", "verdict": "mismatch", "spec": "0,18 g", "proof": "0,18 mg", "note": "unit g vs mg"},
                {"field": "servings", "verdict": "mismatch", "spec": SPEC["servings"], "proof": V1["servings"]},
                {"field": "may_contain", "verdict": "missing", "spec": SPEC["may_contain"], "proof": None},
                {"field": "ingredients", "verdict": "allergen_not_emphasised", "word": "TELJES TEJPOR", "note": "text matches case-insensitively; emphasis missing"},
            ],
            "expected_matches": [f["id"] for f in blue_fields if f["id"] not in ("name", "carbs", "salt", "servings", "may_contain")],
            "not_in_mvp_scope": ["claim 'Erősíti az immunrendszert!' is an unauthorised-looking health claim; MVP does not check claims, a reviewer should"],
        },
        "case_2_round2_v2_vs_v1": {
            "proof": "proof_v2.pdf (and proof_v2_flat.pdf)", "previous": "proof_v1_commented.pdf",
            "comments": [
                {"id": "C1", "expected": "done"}, {"id": "C2", "expected": "done"}, {"id": "C3", "expected": "done"},
                {"id": "C4", "expected": "not_done", "note": "tejpor still not emphasised"},
                {"id": "C5", "expected": "done"}, {"id": "C6", "expected": "done"},
            ],
            "expected_unrequested_changes": [
                {"block": "preparation", "before": SPEC["preparation"], "after": V2["preparation"], "note": "150 ml -> 200 ml; also a spec mismatch"},
                {"block": "claim_2", "before": None, "after": "Hozzáadott cukor nélkül", "note": "new claim added; contradicts 'cukor' in ingredients"},
            ],
            "expected_moved_not_changed": ["preparation (panel only, content changed separately)", "storage", "best_before", "manufacturer", "origin"],
            "expected_spec_findings_v2": [
                {"field": "preparation", "verdict": "mismatch", "spec": SPEC["preparation"], "proof": V2["preparation"]},
                {"field": "ingredients", "verdict": "allergen_not_emphasised", "word": "TELJES TEJPOR"},
            ],
        },
        "case_3_round3_v3_vs_v2": {
            "proof": "proof_v3.pdf (and proof_v3_flat.pdf)", "previous": "proof_v2.pdf",
            "comments": [{"id": f"C{i}", "expected": "done"} for i in range(1, 7)],
            "expected_unrequested_changes": [],
            "expected_spec_findings_v3": [],
            "note": "[assumption] v3 reverts preparation to 150 ml and removes claim_2. Against v2 the diff sees "
                    "both, but the round 2 send-back lines ask for exactly these reverts, so they count as requested.",
        },
        "reviewer_comments_v1": COMMENTS_V1,
        "blocks_v1": b1, "blocks_v2": b2, "blocks_v3": b3,
    }
    with open(os.path.join(OUT, "answer_key.json"), "w", encoding="utf-8") as f:
        json.dump(key, f, ensure_ascii=False, indent=2)
    print("blue fields:", len(blue_fields))


if __name__ == "__main__":
    main()
