<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import katex from 'katex';
  import 'katex/dist/katex.min.css';

  const dispatch = createEventDispatcher<{ insert: { tex: string } }>();

  // Each button inserts a complete $...$ chunk; the parent puts the caret
  // inside the first empty {} so the user can keep typing.
  const SYMBOLS: { label: string; tex: string }[] = [
    { label: '\\frac{a}{b}', tex: '$\\frac{}{}$' },
    { label: 'x^2', tex: '$x^{}$' },
    { label: '\\sqrt{x}', tex: '$\\sqrt{}$' },
    { label: 'x_n', tex: '$x_{}$' },
    { label: '\\pi', tex: '$\\pi$' },
    { label: '\\infty', tex: '$\\infty$' },
    { label: '\\le', tex: '$\\le$' },
    { label: '\\ge', tex: '$\\ge$' },
    { label: '\\ne', tex: '$\\ne$' },
    { label: '\\pm', tex: '$\\pm$' },
    { label: '\\to', tex: '$\\to$' },
    { label: '\\theta', tex: '$\\theta$' },
    { label: '\\sin', tex: '$\\sin()$' },
    { label: '\\cos', tex: '$\\cos()$' },
    { label: '\\lim_{x \\to 0}', tex: '$\\lim_{x \\to } $' },
    { label: '\\sum', tex: '$\\sum_{}^{}$' },
    { label: '\\int', tex: '$\\int_{}^{}$' },
  ];

  const render = (tex: string) => katex.renderToString(tex, { throwOnError: false });
</script>

<div class="math-toolbar" role="toolbar">
  {#each SYMBOLS as s (s.tex)}
    <!-- mousedown.preventDefault keeps focus (and the caret) in the text input -->
    <button
      type="button"
      class="sym-btn"
      on:mousedown|preventDefault
      on:click={() => dispatch('insert', { tex: s.tex })}
    >
      <!-- eslint-disable-next-line svelte/no-at-html-tags — static KaTeX-rendered button labels -->
      {@html render(s.label)}
    </button>
  {/each}
</div>

<style>
  .math-toolbar {
    display: flex; flex-wrap: wrap; gap: 4px;
  }
  .sym-btn {
    min-width: 34px; height: 30px; padding: 0 7px;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--bg3); color: var(--text);
    cursor: pointer; line-height: 1;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .sym-btn :global(.katex) { font-size: 0.78em; }
  .sym-btn:hover { border-color: var(--primary); background: var(--primary-l); }
</style>
