<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { backOut, cubicOut } from 'svelte/easing';
  import { auth } from '$lib/stores/auth';
  import { supabase } from '$lib/supabase';
  import { toast } from '$lib/stores/toast';
  import { t } from '$lib/i18n';

  export let open = false;

  // Portal to <body> to escape the trapped stacking context above the tab-bar.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  let name = '';
  let password = '';
  let confirm = '';
  let saving = false;

  // Seed the form on each open (single reactive block so the writer can't run
  // before the reader — same pattern as SubjectEditSheet).
  let wasOpen = false;
  $: {
    if (open && !wasOpen) seed();
    wasOpen = open;
  }

  function seed() {
    name = $auth.name === 'Student' ? '' : $auth.name;
    password = '';
    confirm = '';
    saving = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) close();
  }

  function close() {
    open = false;
  }

  async function save() {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error($t.settings.nameRequired);
      return;
    }
    const wantsPassword = $auth.mode === 'authenticated' && password.length > 0;
    if (wantsPassword) {
      if (password.length < 8) {
        toast.error($t.auth.passwordMin);
        return;
      }
      if (password !== confirm) {
        toast.error($t.settings.passwordsMismatch);
        return;
      }
    }

    saving = true;
    try {
      if ($auth.mode === 'authenticated') {
        const payload: { data: { name: string }; password?: string } = { data: { name: trimmed } };
        if (wantsPassword) payload.password = password;
        const { error } = await supabase.auth.updateUser(payload);
        if (error) throw error;
        auth.update((a) => ({ ...a, name: trimmed }));
      } else {
        localStorage.setItem('pulse_guest_name', trimmed);
        auth.update((a) => ({ ...a, name: trimmed }));
      }
      toast.success($t.settings.profileSaved);
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : $t.common.errSave);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div use:portal>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="sheet-overlay" on:click={close} role="presentation" transition:fade={{ duration: 200 }}></div>
    <div
      class="sheet glass-panel"
      role="dialog"
      aria-modal="true"
      aria-label={$t.settings.profile}
      in:fly={{ y: 380, duration: 420, easing: backOut }}
      out:fly={{ y: 360, duration: 240, easing: cubicOut }}
    >
      <div class="sheet-handle"></div>
      <p class="sheet-title">{$t.settings.profile}</p>

      <div class="field">
        <label class="field-label" for="profile-name">{$t.settings.displayName}</label>
        <input id="profile-name" class="field-input" bind:value={name} placeholder={$t.auth.namePlaceholder} autocomplete="name" />
      </div>

      {#if $auth.mode === 'authenticated'}
        <div class="field">
          <span class="field-label">{$t.auth.email}</span>
          <p class="readonly">{$auth.user?.email}</p>
        </div>

        <p class="section-divide">{$t.settings.changePassword}</p>
        <p class="hint">{$t.settings.passwordKeepHint}</p>
        <div class="field">
          <label class="field-label" for="profile-pw">{$t.settings.newPassword}</label>
          <input id="profile-pw" class="field-input" type="password" bind:value={password} placeholder={$t.auth.passwordMin} autocomplete="new-password" />
        </div>
        <div class="field">
          <label class="field-label" for="profile-pw2">{$t.settings.confirmPassword}</label>
          <input id="profile-pw2" class="field-input" type="password" bind:value={confirm} autocomplete="new-password" />
        </div>
      {/if}

      <div class="sheet-actions">
        <button class="btn-cancel" on:click={close}>{$t.common.cancel}</button>
        <button class="btn-save" on:click={save} disabled={!name.trim() || saving}>{$t.common.save}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200; }
  .sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 201;
    border-radius: 20px 20px 0 0;
    border: none;
    border-top: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    padding: 12px 20px calc(40px + env(safe-area-inset-bottom)); max-width: 600px; margin: 0 auto;
  }
  .sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--border); margin: 0 auto 16px; }
  .sheet-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
  .field { margin-bottom: 14px; }
  .field-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .field-input {
    width: 100%; padding: 11px 13px; border: 1.5px solid var(--border);
    border-radius: 12px; background: color-mix(in srgb, var(--bg) 70%, transparent); color: var(--text);
    font-family: inherit; font-size: 15px; outline: none; box-sizing: border-box;
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }
  .field-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15); }
  .readonly { font-size: 15px; color: var(--text); padding: 2px 0; }
  .section-divide { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text); margin: 20px 0 4px; }
  .hint { font-size: 12px; color: var(--muted); margin-bottom: 12px; }
  .sheet-actions { display: flex; gap: 8px; margin-top: 22px; }
  .btn-cancel {
    flex: 1; padding: 11px; border-radius: var(--radius-md); border: 1.5px solid var(--border);
    background: none; color: var(--muted); font-family: inherit; font-size: 14px; cursor: pointer;
  }
  .btn-save {
    flex: 2; padding: 11px; border-radius: var(--radius-md); border: none;
    background: var(--primary); color: var(--bg); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
