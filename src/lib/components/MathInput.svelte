<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { EditorView, keymap, placeholder as cmPlaceholder, drawSelection } from '@codemirror/view';
  import { EditorState, Compartment } from '@codemirror/state';
  import { history, defaultKeymap, historyKeymap } from '@codemirror/commands';
  import { mathPreview } from '$lib/cmMath';

  export let value = '';
  export let placeholder = '';
  export let multiline = false;
  export let disabled = false;
  export let ariaLabel = '';

  const dispatch = createEventDispatcher<{ change: string; focus: void }>();

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  const editable = new Compartment();

  // Single-line fields strip newlines from any insert (typed or pasted)
  // instead of rejecting the whole transaction.
  const singleLine = EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || tr.newDoc.lines === 1) return tr;
    const changes: { from: number; to: number; insert: string }[] = [];
    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      changes.push({ from: fromA, to: toA, insert: inserted.toString().replace(/\n+/g, ' ') });
    });
    return [{ changes }];
  });

  /** Insert a toolbar snippet at the caret, placing it inside the first {} / () hole. */
  export function insertSnippet(tex: string) {
    if (!view) return;
    const range = view.state.selection.main;
    const hole = tex.includes('{}') ? tex.indexOf('{}') + 1 : tex.includes('()') ? tex.indexOf('()') + 1 : tex.length;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: tex },
      selection: { anchor: range.from + hole },
    });
    view.focus();
  }

  export function focus() {
    view?.focus();
  }

  const theme = EditorView.theme({
    '&': {
      backgroundColor: 'var(--bg)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      fontSize: '13px',
    },
    '&.cm-focused': { outline: 'none', borderColor: 'var(--primary)' },
    '.cm-scroller': { fontFamily: 'var(--font-sans)', lineHeight: '1.5', overflow: 'auto' },
    '.cm-content': { padding: '8px 10px', caretColor: 'var(--text)' },
    '.cm-line': { padding: '0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--text)' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
      { background: 'rgba(var(--primary-rgb), 0.22)' },
    '.cm-placeholder': { color: 'var(--muted)' },
    '.cm-math .katex': { fontSize: '1.06em' },
    '.cm-math-display': { display: 'block', textAlign: 'center', margin: '4px 0' },
  });

  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          ...(multiline ? [] : [singleLine]),
          mathPreview,
          theme,
          cmPlaceholder(placeholder),
          ...(ariaLabel ? [EditorView.contentAttributes.of({ 'aria-label': ariaLabel })] : []),
          editable.of(EditorView.editable.of(!disabled)),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              value = u.state.doc.toString();
              dispatch('change', value);
            }
            if (u.focusChanged && u.view.hasFocus) dispatch('focus');
          }),
        ],
      }),
    });
  });

  // External value changes (edit prefill, form reset) → replace the doc.
  $: if (view && value !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }

  $: if (view) view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!disabled)) });

  onDestroy(() => view?.destroy());
</script>

<div class="math-input" class:multiline bind:this={host}></div>

<style>
  .math-input :global(.cm-editor) { width: 100%; box-sizing: border-box; }
  .math-input.multiline :global(.cm-content) { min-height: 62px; }
</style>
