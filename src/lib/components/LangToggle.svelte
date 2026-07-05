<script lang="ts">
  import { settings } from '$lib/stores/settings';

  function setLang(lang: 'en' | 'th') {
    settings.update(s => ({ ...s, lang }));
  }
</script>

<div class="lang-toggle" role="group" aria-label="Language / ภาษา">
  <button class="seg" class:active={$settings.lang === 'en'} on:click={() => setLang('en')}>EN</button>
  <button class="seg" class:active={$settings.lang === 'th'} on:click={() => setLang('th')}>ไทย</button>
</div>

<style>
  .lang-toggle {
    display: inline-flex; padding: 2px; border-radius: 999px;
    background: var(--bg3); border: 1px solid var(--border);
  }
  .seg {
    padding: 4px 12px; min-height: 26px; border: none; border-radius: 999px;
    background: none; color: var(--muted); font-family: inherit;
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: background 140ms ease, color 140ms ease;
  }
  .seg:hover { color: var(--text); }
  .seg.active { background: var(--bg2); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
</style>
