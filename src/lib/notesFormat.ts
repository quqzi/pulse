export interface TextEdit { text: string; selStart: number; selEnd: number; }

export function toggleWrap(
  text: string,
  selStart: number,
  selEnd: number,
  before: string,
  after: string
): TextEdit {
  const selected = text.slice(selStart, selEnd);

  // Symmetric single-char-run markers (italic `*`, bold `**`, code `` ` ``) toggle
  // against the ACTUAL run of that char around the selection, so emphasis both
  // composes and decomposes: **x** +italic -> ***x***, then +italic -> **x**.
  // A naive equality check confuses the inner char of a longer run (the `*` of
  // `**`) with the marker itself, which either corrupts or blocks the toggle.
  const ch = before[0];
  const isCharRun = before === after && before.length > 0 && new RegExp(`^\\${ch}+$`).test(before);
  if (isCharRun) {
    const need = before.length;
    let left = 0;
    while (selStart - left - 1 >= 0 && text[selStart - left - 1] === ch) left++;
    let right = 0;
    while (selEnd + right < text.length && text[selEnd + right] === ch) right++;
    const pairs = Math.min(left, right);
    // italic-style (need 1) is active on odd runs (1, 3); bold-style (need 2) on runs >= 2.
    const active = need === 1 ? pairs % 2 === 1 : pairs >= need;
    if (active) {
      return {
        text: text.slice(0, selStart - need) + selected + text.slice(selEnd + need),
        selStart: selStart - need,
        selEnd: selEnd - need,
      };
    }
    return {
      text: text.slice(0, selStart) + before + selected + after + text.slice(selEnd),
      selStart: selStart + need,
      selEnd: selEnd + need,
    };
  }

  // Fallback for non-run markers: wrap, or unwrap if already exactly wrapped.
  const wrappedStart = selStart - before.length;
  const wrappedEnd = selEnd + after.length;
  if (
    wrappedStart >= 0 &&
    text.slice(wrappedStart, selStart) === before &&
    text.slice(selEnd, wrappedEnd) === after
  ) {
    return {
      text: text.slice(0, wrappedStart) + selected + text.slice(wrappedEnd),
      selStart: wrappedStart,
      selEnd: wrappedStart + selected.length,
    };
  }

  return {
    text: text.slice(0, selStart) + before + selected + after + text.slice(selEnd),
    selStart: selStart + before.length,
    selEnd: selEnd + before.length,
  };
}

export function toggleLinePrefix(
  text: string,
  selStart: number,
  selEnd: number,
  prefix: string
): TextEdit {
  const effectiveEnd = selEnd > selStart ? selEnd - 1 : selEnd;
  const lineStart = selStart === 0 ? 0 : text.lastIndexOf('\n', selStart - 1) + 1;
  const nextBreak = text.indexOf('\n', effectiveEnd);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split('\n');
  const ordered = prefix === '1. ';
  const orderedMarker = /^\d+\. /;
  const hasPrefix = (line: string) => ordered ? orderedMarker.test(line) : line.startsWith(prefix);
  const removePrefix = (line: string) => ordered ? line.replace(orderedMarker, '') : line.slice(prefix.length);

  const nextLines = lines.every(hasPrefix)
    ? lines.map(removePrefix)
    : lines.map((line, index) => `${ordered ? `${index + 1}. ` : prefix}${line}`);
  const nextBlock = nextLines.join('\n');

  return {
    text: text.slice(0, lineStart) + nextBlock + text.slice(lineEnd),
    selStart: lineStart,
    selEnd: lineStart + nextBlock.length,
  };
}

export function insertLink(text: string, selStart: number, selEnd: number): TextEdit {
  const selected = text.slice(selStart, selEnd);
  const linkText = selected || 'text';
  const insert = `[${linkText}](url)`;
  const placeholderStart = selStart + 1 + linkText.length + 2;
  const placeholderEnd = placeholderStart + 3;

  return {
    text: text.slice(0, selStart) + insert + text.slice(selEnd),
    selStart: selected ? placeholderStart : selStart + 1,
    selEnd: selected ? placeholderEnd : selStart + 1 + linkText.length,
  };
}
