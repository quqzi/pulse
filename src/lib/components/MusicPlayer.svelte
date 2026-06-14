<script lang="ts">
  import { settings } from '$lib/stores/settings';
  import { toMusicEmbed } from '$lib/music';
  import { t } from '$lib/i18n';

  let editing = false;
  let draft = '';
  let invalid = false;

  $: embed = toMusicEmbed($settings.musicUrl ?? '');

  function open() {
    draft = $settings.musicUrl ?? '';
    invalid = false;
    editing = true;
  }

  function save() {
    const url = draft.trim();
    if (url && !toMusicEmbed(url)) { invalid = true; return; }
    settings.update(s => ({ ...s, musicUrl: url }));
    editing = false;
  }

  function remove() {
    settings.update(s => ({ ...s, musicUrl: '' }));
    draft = '';
    editing = false;
  }
</script>

<div class="music">
  {#if embed}
    <iframe
      class="music-embed"
      title={$t.timer.musicTitle}
      src={embed.src}
      style="height:{embed.height}px"
      loading="lazy"
      allow="autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture"
    ></iframe>
  {/if}

  {#if editing}
    <div class="music-edit">
      <input
        class="music-input"
        class:invalid
        type="url"
        inputmode="url"
        autocomplete="off"
        bind:value={draft}
        placeholder={$t.timer.musicPlaceholder}
        on:input={() => (invalid = false)}
        on:keydown={(e) => e.key === 'Enter' && save()}
      />
      {#if invalid}<p class="music-err">{$t.timer.musicInvalid}</p>{/if}
      <div class="music-actions">
        {#if $settings.musicUrl}
          <button class="music-remove" on:click={remove}>{$t.timer.musicRemove}</button>
        {/if}
        <button class="music-save" on:click={save}>{$t.timer.musicSave}</button>
      </div>
    </div>
  {:else}
    <button class="music-toggle" on:click={open}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      {embed ? $t.timer.musicChange : $t.timer.musicAdd}
    </button>
  {/if}
</div>

<style>
  .music {
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .music-embed {
    width: 100%;
    border: 0;
    border-radius: 12px;
    background: var(--bg2);
  }
  .music-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
    background: none;
    border: 1px solid transparent;
    cursor: pointer;
    padding: 8px 10px;
    border-radius: 8px;
    transition: color 150ms;
  }
  .music-toggle:hover { color: var(--primary); }
  .music-edit {
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .music-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg2);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
  }
  .music-input:focus {
    outline: none;
    border-color: var(--primary);
  }
  .music-input.invalid { border-color: var(--danger); }
  .music-err {
    font-size: 12px;
    color: var(--danger);
    margin: -2px 2px 0;
  }
  .music-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .music-remove, .music-save {
    padding: 8px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }
  .music-remove { background: var(--bg3); color: var(--text); }
  .music-save { background: var(--primary); color: var(--bg); }

  @media (max-width: 768px) {
    .music-toggle { min-height: 44px; }
    .music-remove, .music-save { min-height: 44px; }
  }
</style>
