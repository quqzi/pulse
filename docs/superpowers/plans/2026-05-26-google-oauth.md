# Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Continue with Google" to login and signup pages. Supabase handles the OAuth flow and auto-links Google accounts to existing email/password accounts with the same email.

**Architecture:** One new SvelteKit route (`/auth/callback`) handles the OAuth redirect and exchanges the code for a session. The login/signup pages get a Google button that calls `supabase.auth.signInWithOAuth`. Guest localStorage data is preserved — `loadData` already handles migrating it on first authenticated load.

**Tech Stack:** SvelteKit 2, Supabase JS v2 (`supabase.auth.signInWithOAuth`, `supabase.auth.exchangeCodeForSession`)

---

## ⚠️ Manual Setup Required BEFORE Running This Plan

The developer must complete these steps in external dashboards first:

**Google Cloud Console:**
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add Authorized redirect URI: `https://bzcanpehaoeminjbzpvq.supabase.co/auth/v1/callback`
4. Also add for local dev: `http://localhost:5173/auth/callback`
5. Copy the **Client ID** and **Client Secret**

**Supabase Dashboard:**
1. Go to Authentication → Providers → Google
2. Enable Google, paste Client ID and Client Secret
3. Go to Authentication → Settings → enable **"Allow users to link multiple OAuth identities to one account"** (this links Google login to existing email accounts)

Only start the code tasks after both are done.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/routes/auth/callback/+page.svelte` | **Create** | Handles OAuth redirect, exchanges code, redirects to dashboard |
| `src/routes/auth/login/+page.svelte` | Modify | Add Google button above email form |
| `src/routes/auth/signup/+page.svelte` | Modify | Add Google button above email form |

---

### Task 1: Create the OAuth callback route

**Files:**
- Create: `src/routes/auth/callback/+page.svelte`

After Google auth, Supabase redirects to `/auth/callback?code=...`. This page exchanges the code for a session then redirects to `/dashboard`.

- [ ] **Step 1: Create the file**

Create `src/routes/auth/callback/+page.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabase';

  onMount(async () => {
    const code = $page.url.searchParams.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('OAuth callback error:', error.message);
        goto('/auth?error=oauth');
        return;
      }
    }
    goto('/dashboard');
  });
</script>

<div class="callback-wrap">
  <p>Signing in…</p>
</div>

<style>
  .callback-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    color: var(--muted);
    font-size: 14px;
  }
</style>
```

- [ ] **Step 2: Verify the supabase client path**

Open `src/lib/supabase.ts` and confirm the export is named `supabase`. The import in step 1 uses `import { supabase } from '$lib/supabase'` — adjust if the export name differs.

- [ ] **Step 3: Run type check**

```powershell
npm run check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```powershell
git add "src/routes/auth/callback/+page.svelte"
git commit -m "feat: add OAuth callback route for Google sign-in"
```

---

### Task 2: Add Google button to login and signup pages

**Files:**
- Modify: `src/routes/auth/login/+page.svelte`
- Modify: `src/routes/auth/signup/+page.svelte`

Apply the same change to both files — the Google button and divider go above the email/password form in each.

- [ ] **Step 1: Read both auth pages**

Open `src/routes/auth/login/+page.svelte` and `src/routes/auth/signup/+page.svelte`. Note where the forms are and what's already imported from `$lib/supabase`.

- [ ] **Step 2: Add the signInWithGoogle function**

In the `<script>` block, add:

```ts
async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) console.error('Google sign-in error:', error.message);
}
```

- [ ] **Step 3: Add the Google button to the markup**

Place this button above (or below) the email/password form, separated by an "or" divider:

```svelte
<button class="google-btn" on:click={signInWithGoogle} type="button">
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
  Continue with Google
</button>

<div class="auth-divider"><span>or</span></div>
```

Place the divider between the Google button and the email form.

- [ ] **Step 4: Add CSS**

```css
.google-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg2);
  color: var(--text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 16px;
}
.google-btn:hover { background: var(--bg3); }

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 12px;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
```

- [ ] **Step 5: Run type check**

```powershell
npm run check
```

Expected: 0 errors.

- [ ] **Step 6: Verify locally**

Run `npm run dev`. Go to `/auth`. The Google button should appear. Clicking it should redirect to Google's OAuth consent screen (requires the Supabase + Google Cloud setup to be done).

After completing Google auth, you should land on `/auth/callback`, then be redirected to `/dashboard` and be logged in.

- [ ] **Step 7: Commit**

```powershell
git add "src/routes/auth/login/+page.svelte" "src/routes/auth/signup/+page.svelte"
git commit -m "feat: add Continue with Google button to login and signup pages"
```

---

### Task 3: Push and verify on production

- [ ] **Step 1: Push**

```powershell
git push origin master
```

- [ ] **Step 2: Add production redirect URI to Google Console**

In Google Cloud Console → Credentials → your OAuth client, ensure `https://pulse-hazel-ten.vercel.app/auth/callback` is in the Authorized redirect URIs list. (Supabase's own callback URL should already be there from setup.)

- [ ] **Step 3: Verify on production**

Go to https://pulse-hazel-ten.vercel.app/auth. Click "Continue with Google". Confirm the full flow works end-to-end.

- [ ] **Step 4: Test account linking**

If you have an existing account with email X, sign in with Google using the same email X. You should land on `/dashboard` with your existing data intact (Supabase links the identity automatically).
