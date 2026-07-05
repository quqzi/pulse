<script lang="ts">
  import katex from 'katex';
  import 'katex/dist/katex.min.css';

  export let text = '';
  /** Editor previews: render a trailing unclosed $…/$$… as math so the
   *  formula appears live while typing, before the closing delimiter. */
  export let liveTail = false;

  type Seg = { kind: 'text' | 'inline' | 'display'; value: string };

  // Split on $$...$$ (display) first, then $...$ (inline). Unmatched or empty
  // delimiters fall through as plain text, so non-math dollar signs survive.
  function segment(src: string, tail: boolean): Seg[] {
    const out: Seg[] = [];
    const re = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;
    let last = 0;
    for (let m = re.exec(src); m !== null; m = re.exec(src)) {
      if (m.index > last) out.push({ kind: 'text', value: src.slice(last, m.index) });
      if (m[1] !== undefined) out.push({ kind: 'display', value: m[1] });
      else out.push({ kind: 'inline', value: m[2] });
      last = m.index + m[0].length;
    }
    if (last < src.length) {
      const rest = src.slice(last);
      const d = tail ? rest.lastIndexOf('$') : -1;
      if (d >= 0) {
        const isDisplay = d > 0 && rest[d - 1] === '$';
        const cut = isDisplay ? d - 1 : d;
        if (cut > 0) out.push({ kind: 'text', value: rest.slice(0, cut) });
        const inner = rest.slice(d + 1);
        if (inner) out.push({ kind: isDisplay ? 'display' : 'inline', value: inner });
      } else {
        out.push({ kind: 'text', value: rest });
      }
    }
    return out;
  }

  function render(tex: string, display: boolean): string {
    return katex.renderToString(tex, { throwOnError: false, displayMode: display });
  }

  $: segs = segment(text, liveTail);
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
