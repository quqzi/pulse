#!/usr/bin/env python3
"""Fill activity 3.1 worksheet: tick rows 3-10 and answer question 2."""
import subprocess, pathlib, sys

HERE = pathlib.Path(__file__).parent
SRC = HERE / "activity-3.1-digital-privacy-blank.pdf"
OVERLAY_HTML = HERE / ".overlay.html"
OVERLAY_PDF = HERE / ".overlay.pdf"
OUT = HERE / "activity-3.1-digital-privacy-filled.pdf"

PAGE_W, PAGE_H = 595.5, 842.2

# table geometry read off the source pdf
ROW_TOP = {3: 311.5, 4: 342.5, 5: 392.5, 6: 442.5,
           7: 493.5, 8: 523.5, 9: 574.5, 10: 604.5}
COL = {"yes": (416.5, 466.5), "no": (466.5, 534.5)}
ANSWERS = {3: "no", 4: "no", 5: "no", 6: "no",
           7: "no", 8: "yes", 9: "yes", 10: "yes"}

# vertical offset of the tick inside its row (matches rows 1-2 already ticked)
TICK_DY = 5.1
TICK_SIZE = 19.6
TICK_LINE = 24.0

# question 2 answer block
Q2_TOP = 686.0
Q2_LEFT = 90.0
Q2_WIDTH = 445.0
Q2_SIZE = 13.0
Q2_LINE = 19.0

Q2 = [
    ("รหัสผ่าน", "ตั้งให้ยาว ไม่ใช้วันเกิด ไม่ซ้ำกันทุกบัญชี และเปิดยืนยันตัวตน 2 ขั้นตอน"),
    ("คิดก่อนแชร์", "ไม่โพสต์เลขบัตรประชาชน ที่อยู่ หรือรูปบัตร เพราะลบออกไม่ได้จริง"),
    ("ตั้งค่าความเป็นส่วนตัว", "จำกัดผู้เห็นโพสต์ และปฏิเสธสิทธิ์ที่แอปขอเกินจำเป็น"),
    ("ระวังฟิชชิง", "ไม่กดลิงก์หรือกรอกข้อมูลจากอีเมลที่อ้างว่าได้รางวัล"),
    ("ใช้เครื่องปลอดภัย", "เลี่ยง Wi-Fi สาธารณะ ลงชื่อออกทุกครั้ง และอัปเดตระบบเสมอ"),
]


def html() -> str:
    parts = []
    for row, side in ANSWERS.items():
        x0, x1 = COL[side]
        parts.append(
            f'<div class="tick" style="left:{x0}pt;width:{x1 - x0}pt;'
            f'top:{ROW_TOP[row] + TICK_DY}pt">&#10004;</div>'
        )
    lines = "".join(
        f'<div class="q2line"><b>{n}. {head}</b> &ndash; {body}</div>'
        for n, (head, body) in enumerate(Q2, 1)
    )
    parts.append(f'<div id="q2">{lines}</div>')
    body = "\n".join(parts)
    return f"""<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<style>
  @page {{ size: {PAGE_W}pt {PAGE_H}pt; margin: 0; }}
  html, body {{ margin: 0; padding: 0; background: transparent; }}
  body {{ font-family: 'Sarabun'; color: #000; }}
  div {{ position: absolute; }}
  .tick {{ font-family: 'DejaVu Sans'; font-weight: bold; font-size: {TICK_SIZE}pt;
           line-height: {TICK_LINE}pt; text-align: center; }}
  #q2 {{ left: {Q2_LEFT}pt; top: {Q2_TOP}pt; width: {Q2_WIDTH}pt;
         font-size: {Q2_SIZE}pt; line-height: {Q2_LINE}pt; }}
  .q2line {{ position: static; white-space: nowrap; }}
</style></head><body>
{body}
</body></html>
"""


def main() -> None:
    OVERLAY_HTML.write_text(html(), encoding="utf-8")
    subprocess.run(
        ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "--headless",
         "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer",
         f"--print-to-pdf={OVERLAY_PDF}", OVERLAY_HTML.as_uri()],
        check=True, capture_output=True)

    import pymupdf
    base = pymupdf.open(SRC)
    over = pymupdf.open(OVERLAY_PDF)
    print("overlay page rect:", over[0].rect)
    base[0].show_pdf_page(base[0].rect, over, 0, overlay=True)
    base.save(OUT, garbage=3, deflate=True)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
