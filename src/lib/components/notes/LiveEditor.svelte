<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { EditorView, keymap, placeholder as cmPlaceholder, drawSelection, ViewPlugin, Decoration, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
  import { EditorState, Compartment, RangeSetBuilder } from '@codemirror/state';
  import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
  import { syntaxHighlighting, syntaxTree, HighlightStyle } from '@codemirror/language';
  import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
  import { languages } from '@codemirror/language-data';
  import { tags } from '@lezer/highlight';
  import { insertLink, toggleWrap } from '$lib/notesFormat';
  import { mathPreview } from '$lib/cmMath';

  export let value = '';
  export let disabled = false;
  export let placeholder = '';

  const dispatch = createEventDispatcher<{ change: string }>();

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  const editable = new Compartment();

  // ── Obsidian-style live preview ─────────────────────────────────
  // Markdown renders styled inline; the marker characters (#, **, `, …)
  // are hidden on every line except the one(s) holding the cursor.

  const HIDDEN_MARKS = new Set(['HeaderMark', 'EmphasisMark', 'CodeMark', 'StrikethroughMark']);

  class CheckboxWidget extends WidgetType {
    checked: boolean;
    pos: number;
    constructor(checked: boolean, pos: number) {
      super();
      this.checked = checked;
      this.pos = pos;
    }
    eq(other: CheckboxWidget) { return other.checked === this.checked && other.pos === this.pos; }
    toDOM(v: EditorView) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = this.checked;
      box.className = 'cm-task-toggle';
      box.setAttribute('aria-label', 'toggle task');
      box.onmousedown = (e) => {
        e.preventDefault();
        v.dispatch({ changes: { from: this.pos, to: this.pos + 3, insert: this.checked ? '[ ]' : '[x]' } });
      };
      return box;
    }
    ignoreEvent() { return true; }
  }

  function buildDecorations(v: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const state = v.state;
    const cursorLines = new Set<number>();
    for (const range of state.selection.ranges) {
      const start = state.doc.lineAt(range.from).number;
      const end = state.doc.lineAt(range.to).number;
      for (let n = start; n <= end; n++) cursorLines.add(n);
    }
    for (const { from, to } of v.visibleRanges) {
      syntaxTree(state).iterate({
        from, to,
        enter(node) {
          const onCursorLine = cursorLines.has(state.doc.lineAt(node.from).number);
          if (node.name === 'TaskMarker') {
            if (onCursorLine) return;
            const checked = /x/i.test(state.doc.sliceString(node.from, node.to));
            builder.add(node.from, node.to, Decoration.replace({
              widget: new CheckboxWidget(checked, node.from),
            }));
            return;
          }
          if (!HIDDEN_MARKS.has(node.name) || onCursorLine) return;
          let end = node.to;
          // Headers: swallow the space after "#" so the heading hugs the margin.
          if (node.name === 'HeaderMark' && state.doc.sliceString(end, end + 1) === ' ') end++;
          builder.add(node.from, end, Decoration.replace({}));
        },
      });
    }
    return builder.finish();
  }

  const livePreview = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(v: EditorView) { this.decorations = buildDecorations(v); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = buildDecorations(u.view);
    }
  }, { decorations: (p) => p.decorations });

  const mdHighlight = HighlightStyle.define([
    { tag: tags.heading1, fontSize: '1.55em', fontWeight: '700' },
    { tag: tags.heading2, fontSize: '1.3em', fontWeight: '700' },
    { tag: tags.heading3, fontSize: '1.15em', fontWeight: '700' },
    { tag: tags.heading4, fontWeight: '700' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.9em', background: 'var(--bg3)', borderRadius: '4px' },
    { tag: tags.link, color: 'var(--primary)' },
    { tag: tags.url, color: 'var(--primary)', textDecoration: 'underline' },
    { tag: tags.quote, color: 'var(--muted)', fontStyle: 'italic' },
    { tag: tags.processingInstruction, color: 'var(--muted)' },
    { tag: tags.meta, color: 'var(--muted)' },
    { tag: tags.labelName, color: 'var(--muted)' },
  ]);

  const theme = EditorView.theme({
    '&': {
      backgroundColor: 'var(--bg2)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      fontSize: '15px',
      flex: '1',
      minHeight: '320px',
    },
    '&.cm-focused': { outline: 'none', borderColor: 'var(--primary)' },
    '.cm-scroller': { fontFamily: 'var(--font-sans)', lineHeight: '1.65', overflow: 'auto' },
    '.cm-content': { padding: '14px', caretColor: 'var(--text)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text)' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
      { background: 'rgba(var(--primary-rgb), 0.22)' },
    '.cm-placeholder': { color: 'var(--muted)' },
    '.cm-task-toggle': { accentColor: 'var(--primary)', marginRight: '2px', verticalAlign: 'middle' },
    '.cm-math .katex': { fontSize: '1.06em' },
    '.cm-math-display': { display: 'block', textAlign: 'center', margin: '6px 0' },
  });

  /** Apply a pure (text, selStart, selEnd) edit — the tested notesFormat helpers. */
  export function applyEdit(
    edit: (text: string, selStart: number, selEnd: number) => { text: string; selStart: number; selEnd: number }
  ) {
    if (!view) return;
    const doc = view.state.doc.toString();
    const range = view.state.selection.main;
    const result = edit(doc, range.from, range.to);
    view.dispatch({
      changes: { from: 0, to: doc.length, insert: result.text },
      selection: { anchor: result.selStart, head: result.selEnd },
    });
    view.focus();
  }

  const formatKeymap = keymap.of([
    { key: 'Mod-b', run: () => { applyEdit((s, a, b) => toggleWrap(s, a, b, '**', '**')); return true; } },
    { key: 'Mod-i', run: () => { applyEdit((s, a, b) => toggleWrap(s, a, b, '*', '*')); return true; } },
    { key: 'Mod-k', run: () => { applyEdit(insertLink); return true; } },
  ]);

  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          formatKeymap,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(mdHighlight),
          livePreview,
          mathPreview,
          theme,
          cmPlaceholder(placeholder),
          editable.of(EditorView.editable.of(!disabled)),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              value = u.state.doc.toString();
              dispatch('change', value);
            }
          }),
        ],
      }),
    });
  });

  // External value changes (hydration) → replace the doc.
  $: if (view && value !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }

  $: if (view) view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!disabled)) });

  onDestroy(() => view?.destroy());
</script>

<div class="live-editor" bind:this={host}></div>

<style>
  .live-editor { display: flex; flex-direction: column; flex: 1; min-height: 320px; }
  .live-editor :global(.cm-editor) { display: flex; flex-direction: column; }
</style>
