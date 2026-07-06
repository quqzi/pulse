import { describe, it, expect } from 'vitest';
import { mathSpans, visibleMathSpans } from './cmMath';

describe('mathSpans', () => {
  it('returns empty for plain text', () => {
    expect(mathSpans('no math here')).toEqual([]);
  });

  it('finds an inline span with delimiters included in the range', () => {
    const spans = mathSpans('a $x^2$ b');
    expect(spans).toEqual([{ from: 2, to: 7, tex: 'x^2', display: false }]);
  });

  it('finds a display span', () => {
    const spans = mathSpans('$$\\frac{a}{b}$$');
    expect(spans).toEqual([{ from: 0, to: 15, tex: '\\frac{a}{b}', display: true }]);
  });

  it('finds multiple spans in order', () => {
    const spans = mathSpans('$a$ and $$b$$');
    expect(spans.map((s) => s.tex)).toEqual(['a', 'b']);
    expect(spans.map((s) => s.display)).toEqual([false, true]);
  });

  it('ignores an unmatched trailing dollar', () => {
    expect(mathSpans('price is $5')).toEqual([]);
  });

  it('ignores empty delimiters', () => {
    expect(mathSpans('$$')).toEqual([]);
    expect(mathSpans('a $$ b')).toEqual([]);
  });

  it('does not let inline math cross a newline', () => {
    expect(mathSpans('$a\nb$')).toEqual([]);
  });

  it('lets display math contain a newline', () => {
    const spans = mathSpans('$$a\nb$$');
    expect(spans).toHaveLength(1);
    expect(spans[0].tex).toBe('a\nb');
  });
});

describe('visibleMathSpans', () => {
  const text = 'a $x^2$ b'; // span from 2 to 7

  it('shows the span when the cursor is outside it', () => {
    expect(visibleMathSpans(text, [{ from: 0, to: 0 }])).toHaveLength(1);
    expect(visibleMathSpans(text, [{ from: 9, to: 9 }])).toHaveLength(1);
  });

  it('hides the span when the cursor is inside it', () => {
    expect(visibleMathSpans(text, [{ from: 4, to: 4 }])).toEqual([]);
  });

  it('hides the span when the cursor touches either edge', () => {
    expect(visibleMathSpans(text, [{ from: 2, to: 2 }])).toEqual([]);
    expect(visibleMathSpans(text, [{ from: 7, to: 7 }])).toEqual([]);
  });

  it('hides the span when a selection overlaps it partially', () => {
    expect(visibleMathSpans(text, [{ from: 0, to: 3 }])).toEqual([]);
  });

  it('filters only the touched span when there are several', () => {
    const two = '$a$ $b$'; // spans 0-3 and 4-7
    const visible = visibleMathSpans(two, [{ from: 1, to: 1 }]);
    expect(visible).toHaveLength(1);
    expect(visible[0].tex).toBe('b');
  });

  it('handles multiple selection ranges', () => {
    const two = '$a$ $b$';
    expect(visibleMathSpans(two, [{ from: 1, to: 1 }, { from: 5, to: 5 }])).toEqual([]);
  });
});
