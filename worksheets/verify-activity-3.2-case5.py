#!/usr/bin/env python3
"""Check the filled Case 5 page: the answers landed where they should, they stay
inside the margins, and no added ink touches ink that was already on the page.

Overlap is checked at the pixel level (300 dpi) rather than by text bounding
boxes, because an answer written on a ruled blank line legitimately shares a
bounding box with the rule it sits on — what must not happen is the glyphs
colliding with the rule or with the printed text.
"""
import pathlib
import sys

import numpy as np
import pymupdf

HERE = pathlib.Path(__file__).parent
SRC = HERE / "activity-3.2-digital-detective-blank.pdf"
OUT = HERE / "activity-3.2-digital-detective-case5-filled.pdf"
SRC_PAGE = 4      # case 5 in the original five-case worksheet
OUT_PAGE = 0      # the deliverable is that one page on its own
DPI = 300
Z = DPI / 72.0

LEFT, RIGHT, TOP, BOTTOM = 72.0, 500.0, 60.0, 800.0
BOX = (110.04, 360.56, 120.84, 371.36)          # the chosen checkbox outline
OTHER_BOXES = [(110.04, 323.04, 125.88, 338.88), (110.04, 341.9, 125.88, 357.0)]
EXPECT_ANSWERS = 5

errors, notes = [], []


def spans(doc, page):
    out = []
    for b in doc[page].get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for line in b["lines"]:
            for s in line["spans"]:
                if s["text"].strip():
                    out.append((pymupdf.Rect(s["bbox"]), s["text"], s["font"]))
    return out


def dark(doc, page):
    pm = doc[page].get_pixmap(dpi=DPI)
    a = np.frombuffer(pm.samples, dtype=np.uint8)
    a = a.reshape(pm.height, pm.width, pm.n)[:, :, :3].min(axis=2)
    return a < 160


base, filled = pymupdf.open(SRC), pymupdf.open(OUT)

if filled.page_count != 1:
    errors.append(f"expected a single-page sheet, got {filled.page_count} pages")

old = spans(base, SRC_PAGE)
old_keys = {(round(r.x0, 1), round(r.y0, 1), t) for r, t, _ in old}
added = [(r, t, f) for r, t, f in spans(filled, OUT_PAGE)
         if (round(r.x0, 1), round(r.y0, 1), t) not in old_keys]
notes.append(f"{len(added)} added spans")

# every line of the original case 5 page must have survived the extraction
kept = {(round(r.x0, 1), round(r.y0, 1), t) for r, t, _ in spans(filled, OUT_PAGE)}
missing = [t for r, t, _ in old
           if (round(r.x0, 1), round(r.y0, 1), t) not in kept]
if missing:
    errors.append(f"original text lost: {missing[:3]}")

ticks = [r for r, t, _ in added if t.strip() == "✔"]
answers = [(r, t) for r, t, _ in added if t.strip() != "✔"]

# 1. exactly one tick, inside the intended checkbox
if len(ticks) != 1:
    errors.append(f"expected 1 check mark, found {len(ticks)}")
else:
    r = ticks[0]
    cx, cy = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
    if not (BOX[0] <= cx <= BOX[2] and BOX[1] <= cy <= BOX[3]):
        errors.append(f"check mark not centred in its box (centre {cx:.1f},{cy:.1f})")
    for b in OTHER_BOXES:
        if b[0] <= cx <= b[2] and b[1] <= cy <= b[3]:
            errors.append("check mark landed in the wrong checkbox")

# 2. right number of answer lines, all inside the margins
if len(answers) != EXPECT_ANSWERS:
    errors.append(f"expected {EXPECT_ANSWERS} answer lines, found {len(answers)}")
for r, t in answers:
    if r.x0 < LEFT - 0.5 or r.x1 > RIGHT:
        errors.append(f"answer out of margins ({r.x0:.1f}-{r.x1:.1f}): {t[:25]!r}")
    if r.y0 < TOP or r.y1 > BOTTOM:
        errors.append(f"answer outside the text area (y {r.y0:.1f}-{r.y1:.1f}): {t[:25]!r}")

# 3. answer lines must not collide with each other
for i, (r, t) in enumerate(answers):
    for o, ot in answers[i + 1:]:
        inter = r & o
        if inter.is_valid and inter.get_area() > 0.5:
            errors.append(f"answers overlap: {t[:20]!r} / {ot[:20]!r}")

# 4. pixel check — no added ink on top of ink that was already there
before, after = dark(base, SRC_PAGE), dark(filled, OUT_PAGE)
if before.shape != after.shape:
    errors.append("render size mismatch")
else:
    new_ink = after & ~before
    # ink that vanished would mean we covered something up
    lost = before & ~after
    if lost.sum() > 0:
        ys, xs = np.nonzero(lost)
        errors.append(f"{lost.sum()} px of original ink was covered "
                      f"(around {xs.min() / Z:.0f},{ys.min() / Z:.0f})")
    # a 1px halo around the new glyphs must stay clear of the old ink
    pad = np.zeros_like(new_ink)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            pad |= np.roll(np.roll(new_ink, dy, axis=0), dx, axis=1)
    touch = pad & before
    if touch.sum() > 0:
        ys, xs = np.nonzero(touch)
        spots = sorted({(round(x / Z), round(y / Z)) for x, y in zip(xs, ys)})[:5]
        errors.append(f"new ink touches existing ink at {spots} ({touch.sum()} px)")
    notes.append(f"{new_ink.sum()} px of new ink, none touching the original")

print("\n".join("note: " + n for n in notes))
if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)
print("OK — all checks passed")
