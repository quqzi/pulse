export interface TextEdit { text: string; selStart: number; selEnd: number; }

export function toggleWrap(
  text: string,
  selStart: number,
  selEnd: number,
  before: string,
  after: string
): TextEdit {
  const selected = text.slice(selStart, selEnd);
  const wrappedStart = selStart - before.length;
  const wrappedEnd = selEnd + after.length;

  const alreadyWrapped =
    wrappedStart >= 0 &&
    text.slice(wrappedStart, selStart) === before &&
    text.slice(selEnd, wrappedEnd) === after;

  // Guard composition: a single-char marker (italic `*`) must not match the
  // inner char of a compound run (bold `**`). If `before`/`after` are a run of
  // one char and the chars just outside continue it, these markers belong to a
  // longer run — compose (add) instead of unwrapping, so applying italic to
  // bold yields ***text*** rather than corrupting it back to *text*.
  const markerChar = before[before.length - 1];
  const extendsRun =
    before === after &&
    /^(.)\1*$/.test(before) &&
    (text[wrappedStart - 1] === markerChar || text[wrappedEnd] === markerChar);

  if (alreadyWrapped && !extendsRun) {
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
