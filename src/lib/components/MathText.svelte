<script lang="ts">
  import katex from 'katex';
  import 'katex/dist/katex.min.css';

  export let text = '';

  type Seg = { kind: 'text' | 'inline' | 'display'; value: string };

  // Split on $$...$$ (display) first, then $...$ (inline). Unmatched or empty
  // delimiters fall through as plain text, so non-math dollar signs survive.
  function segment(src: string): Seg[] {
    const out: Seg[] = [];
    const re = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;
    let last = 0;
    for (let m = re.exec(src); m !== null; m = re.exec(src)) {
      if (m.index > last) out.push({ kind: 'text', value: src.slice(last, m.index) });
      if (m[1] !== undefined) out.push({ kind: 'display', value: m[1] });
      else out.push({ kind: 'inline', value: m[2] });
      last = m.index + m[0].length;
    }
    if (last < src.length) out.push({ kind: 'text', value: src.slice(last) });
    return out;
  }

  function render(tex: string, display: boolean): string {
    return katex.renderToString(tex, { throwOnError: false, displayMode: display });
  }

  $: segs = segment(text);
</script>

{#each segs as seg, i (i)}
  {#if seg.kind === 'text'}{seg.value}{:else}
    <!-- eslint-disable-next-line svelte/no-at-html-tags — KaTeX output with throwOnError:false escapes its input -->
    <span class="math" class:display={seg.kind === 'display'}>{@html render(seg.value, seg.kind === 'display')}</span>
  {/if}
{/each}

<style>
  .math.display { display: block; text-align: center; margin: 6px 0; overflow-x: auto; }
  .math :global(.katex) { font-size: 1.06em; }
</style>
