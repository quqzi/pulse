#!/usr/bin/env python3
"""Check the filled worksheet: ticks in the right cells, answer text inside the
margins, and no new text overlapping anything that was already on the page."""
import pathlib, sys
import pymupdf

HERE = pathlib.Path(__file__).parent
SRC, OUT = (HERE / "activity-3.1-digital-privacy-blank.pdf",
            HERE / "activity-3.1-digital-privacy-filled.pdf")

ROW = {3: (311.5, 342.5), 4: (342.5, 392.5), 5: (392.5, 442.5), 6: (442.5, 493.5),
       7: (493.5, 523.5), 8: (523.5, 574.5), 9: (574.5, 604.5), 10: (604.5, 635.5)}
COL = {"yes": (416.5, 466.5), "no": (466.5, 534.5)}
ANSWERS = {3: "no", 4: "no", 5: "no", 6: "no", 7: "no", 8: "yes", 9: "yes", 10: "yes"}
LEFT, RIGHT, BOTTOM = 66.0, 535.0, 800.0

errors, notes = [], []


def spans(doc):
    out = []
    for b in doc[0].get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for line in b["lines"]:
            for s in line["spans"]:
                if s["text"].strip():
                    out.append((pymupdf.Rect(s["bbox"]), s["text"], s["font"]))
    return out


old = spans(pymupdf.open(SRC))
new_all = spans(pymupdf.open(OUT))

old_keys = {(round(r.x0, 1), round(r.y0, 1), t) for r, t, _ in old}
added = [(r, t, f) for r, t, f in new_all if (round(r.x0, 1), round(r.y0, 1), t) not in old_keys]
notes.append(f"{len(added)} added text spans")

# 1. every expected tick present, inside its own cell, and nowhere else
ticks = [(r, t) for r, t, _ in added if t.strip() == "✔"]
if len(ticks) != len(ANSWERS):
    errors.append(f"expected {len(ANSWERS)} new ticks, found {len(ticks)}")
for row, side in ANSWERS.items():
    y0, y1 = ROW[row]
    x0, x1 = COL[side]
    hit = [r for r, _ in ticks if x0 < r.x0 and r.x1 < x1 and y0 < r.y0 and r.y1 < y1]
    if len(hit) != 1:
        errors.append(f"row {row}: expected 1 tick in '{side}' cell, found {len(hit)}")
        continue
    r = hit[0]
    cx, want = (r.x0 + r.x1) / 2, (x0 + x1) / 2
    if abs(cx - want) > 1.0:
        errors.append(f"row {row}: tick off-centre by {cx - want:.1f}pt")
    other = COL["no" if side == "yes" else "yes"]
    if any(other[0] < t.x0 < other[1] and y0 < t.y0 < y1 for t, _ in ticks):
        errors.append(f"row {row}: stray tick in the opposite column")

# 2. answer text inside the margins
answer = [(r, t) for r, t, _ in added if t.strip() != "✔"]
for r, t in answer:
    if r.x0 < LEFT or r.x1 > RIGHT:
        errors.append(f"answer text out of margins ({r.x0:.1f}-{r.x1:.1f}): {t[:30]!r}")
    if r.y1 > BOTTOM:
        errors.append(f"answer text below the bottom margin (y1={r.y1:.1f}): {t[:30]!r}")

# 3. nothing added overlaps anything that was already there
for r, t, _ in added:
    for o, ot, _ in old:
        inter = r & o
        if inter.is_valid and inter.get_area() > 0.5:
            errors.append(f"overlap: added {t[:25]!r} over existing {ot[:25]!r}")

# 4. added lines must not overlap each other either
for i, (r, t, _) in enumerate(added):
    for o, ot, _ in added[i + 1:]:
        inter = r & o
        if inter.is_valid and inter.get_area() > 0.5:
            errors.append(f"overlap between added spans: {t[:20]!r} / {ot[:20]!r}")

# 5. glyph coverage — no missing-glyph boxes in the added text
doc = pymupdf.open(OUT)
for r, t, font in added:
    if "�" in t or "□" in t:
        errors.append(f"replacement glyph in {t[:30]!r}")

if answer:
    notes.append(f"answer block y {min(r.y0 for r, _ in answer):.1f}-"
                 f"{max(r.y1 for r, _ in answer):.1f}, "
                 f"widest right edge {max(r.x1 for r, _ in answer):.1f}pt")

print("\n".join("note: " + n for n in notes))
if errors:
    print("\n".join("ERROR: " + e for e in errors))
    sys.exit(1)
print("OK — all checks passed")
