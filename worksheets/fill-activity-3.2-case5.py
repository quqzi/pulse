#!/usr/bin/env python3
"""Fill the DIGITAL DETECTIVE worksheet, Case 5 (ข่าวด่วน!) — page 5 of the pdf.

Thai shaping is done by headless Chromium (HarfBuzz) with the document's own
font (Bai Jamjuree); the printed page is then merged onto the blank worksheet
as a transparent overlay.
"""
import pathlib
import subprocess

HERE = pathlib.Path(__file__).parent
SRC = HERE / "activity-3.2-digital-detective-blank.pdf"
OUT = HERE / "งานอีกรอบ.pdf"
OVERLAY_HTML = HERE / ".overlay.html"
OVERLAY_PDF = HERE / ".overlay.pdf"

PAGE_INDEX = 4
PAGE_W, PAGE_H = 596.0, 842.0

# ── geometry read off the source page ────────────────────────────────────────
# "☐ ตรวจสอบช่องทางทางการก่อน" box: ink x 110.0-120.8, y 360.6-371.4
BOX = (110.04, 360.56, 120.84, 371.36)
TICK_SIZE = 12.5          # keeps the check mark's ink inside the box outline
TICK_LINE = 14.0

SIZE, LINE = 12.0, 14.0        # exit-ticket answers
R_SIZE, R_LINE = 11.5, 13.5    # the two เหตุผล lines, in a tighter gap

# top = css top of the line box; each answer clears the rule it sits on
ANSWERS = [
    # เหตุผล — free space to the right of the bold label (rule below at y 418.2)
    (126.0, 385.0, 370.0, "ยอดแชร์เยอะไม่ได้แปลว่าเป็นเรื่องจริง และโพสต์นี้ไม่มีแหล่งที่มา", "r"),
    (126.0, 402.5, 325.0, "จึงต้องเช็กเพจทางการของโรงเรียนก่อน ถ้าแชร์ผิดคนอื่นจะเข้าใจผิด", "r"),
    # exit ticket — rules at y 528.2 / 556.0 / 583.8
    (140.0, 513.5, 276.0, "คิดก่อนแชร์ ข่าวนี้จริงไหม ใครเป็นคนโพสต์", "a"),
    (136.0, 539.8, 284.0, "ไม่กดลิงก์แปลก ไม่กรอกข้อมูลส่วนตัว", "a"),
    (166.0, 569.1, 260.0, "ไม่ส่งต่อข่าวปลอมที่ทำให้คนอื่นเดือดร้อน", "a"),
]

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


def html() -> str:
    cx = (BOX[0] + BOX[2]) / 2
    parts = [
        f'<div class="tick" style="left:{cx - 10:.2f}pt;width:20pt;'
        f'top:{BOX[1] - 1.05:.2f}pt">&#10004;</div>'
    ]
    for left, top, width, text, cls in ANSWERS:
        parts.append(
            f'<div class="{cls}" style="left:{left}pt;top:{top}pt;'
            f'width:{width}pt">{text}</div>'
        )
    body = "\n".join(parts)
    return f"""<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<style>
  @page {{ size: {PAGE_W}pt {PAGE_H}pt; margin: 0; }}
  html, body {{ margin: 0; padding: 0; background: transparent; }}
  body {{ color: #000; }}
  div {{ position: absolute; }}
  .tick {{ font-family: 'DejaVu Sans'; font-size: {TICK_SIZE}pt;
           line-height: {TICK_LINE}pt; text-align: center; }}
  .a {{ font-family: 'Bai Jamjuree'; font-size: {SIZE}pt;
        line-height: {LINE}pt; white-space: nowrap; }}
  .r {{ font-family: 'Bai Jamjuree'; font-size: {R_SIZE}pt;
        line-height: {R_LINE}pt; white-space: nowrap; }}
</style></head><body>
{body}
</body></html>
"""


def main() -> None:
    OVERLAY_HTML.write_text(html(), encoding="utf-8")
    subprocess.run(
        [CHROME, "--headless", "--no-sandbox", "--disable-gpu",
         "--no-pdf-header-footer", f"--print-to-pdf={OVERLAY_PDF}",
         OVERLAY_HTML.as_uri()],
        check=True, capture_output=True)

    import pymupdf
    base = pymupdf.open(SRC)
    over = pymupdf.open(OVERLAY_PDF)
    page = base[PAGE_INDEX]
    page.show_pdf_page(page.rect, over, 0, overlay=True)
    base.select([PAGE_INDEX])          # keep case 5 only, as a standalone sheet
    base.save(OUT, garbage=3, deflate=True)
    OVERLAY_HTML.unlink()
    OVERLAY_PDF.unlink()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
