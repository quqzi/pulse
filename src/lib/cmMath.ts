import katex from 'katex';
import 'katex/dist/katex.min.css';
import { EditorView, ViewPlugin, Decoration, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';

export interface MathSpan {
  from: number;
  to: number;
  tex: string;
  display: boolean;
}

// Same delimiter grammar as MathText: $$...$$ (display) first, then $...$
// (inline, no newline inside). Unmatched or empty delimiters stay plain text.
const MATH_RE = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;

export function mathSpans(text: string): MathSpan[] {
  const out: MathSpan[] = [];
  MATH_RE.lastIndex = 0;
  for (let m = MATH_RE.exec(text); m !== null; m = MATH_RE.exec(text)) {
    const display = m[1] !== undefined;
    out.push({ from: m.index, to: m.index + m[0].length, tex: display ? m[1] : m[2], display });
  }
  return out;
}

/**
 * Spans to replace with rendered math: every math span the selection does not
 * touch. A cursor at either delimiter edge counts as touching, so clicking
 * next to a formula reveals its source for editing.
 */
export function visibleMathSpans(text: string, selections: readonly { from: number; to: number }[]): MathSpan[] {
  return mathSpans(text).filter(
    (span) => !selections.some((sel) => span.from <= sel.to && span.to >= sel.from),
  );
}

class MathWidget extends WidgetType {
  constructor(readonly tex: string, readonly display: boolean) {
    super();
  }
  eq(other: MathWidget) {
    return other.tex === this.tex && other.display === this.display;
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = this.display ? 'cm-math cm-math-display' : 'cm-math';
    el.innerHTML = katex.renderToString(this.tex, { throwOnError: false, displayMode: this.display });
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

function buildMathDecorations(view: EditorView): DecorationSet {
  // An unfocused editor keeps its caret where it was, which would pin the
  // last-typed formula to raw text forever — render everything on blur.
  const selections = view.hasFocus ? view.state.selection.ranges : [];
  const spans = visibleMathSpans(view.state.doc.toString(), selections);
  return Decoration.set(
    spans.map((s) =>
      Decoration.replace({ widget: new MathWidget(s.tex, s.display) }).range(s.from, s.to),
    ),
  );
}

/** Live KaTeX preview: $…$ / $$…$$ render as math while the cursor is outside the span. */
export const mathPreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildMathDecorations(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.focusChanged) this.decorations = buildMathDecorations(u.view);
    }
  },
  { decorations: (p) => p.decorations },
);
