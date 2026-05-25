# Auth + Onboarding Design

## Goal

Fix two broken paths in the authenticated account flow:
1. Onboarding saves subjects to localStorage only — authenticated users' subjects never reach Supabase.
2. Login always goes to `/dashboard` — new accounts skip setup and hit an empty dashboard.

No guest-to-account data migration. Fresh start on signup.

---

## Files Changed

| File | What changes |
|------|-------------|
| `src/routes/onboarding/+page.svelte` | Replace hardcoded subject step with inline template picker; make `finish()` auth-aware |
| `src/routes/auth/login/+page.svelte` | After login, check subject count → redirect to `/onboarding` or `/dashboard` |

Signup (`/auth/signup`), `db.ts`, auth store, and layout are unchanged.

---

## Onboarding Wizard

Steps stay at 0–4. Step 1 is replaced.

| Step | Content |
|------|---------|
| 0 | Exam date (unchanged) |
| 1 | Template picker (see below) |
| 2 | Daily goal slider (unchanged) |
| 3 | Target scores — inputs for each checked subject from step 1 |
| 4 | "You're all set!" (unchanged) |

### Step 1 — Template Picker

Two sub-states within the same step, no route change:

**Sub-state A — Template list:** Shows the three `BUILTIN_TEMPLATES` as cards (TCAS, Medicine, Engineering). Each card shows template name, subject count, and color dots. Tapping a card sets `pickedTemplate` and advances to sub-state B.

**Sub-state B — Subject checklist:** Shows the chosen template's presets as a checklist (same pattern as `/subjects/templates/[id]`). All checked by default. A back arrow clears `pickedTemplate` and returns to sub-state A. "Next" is enabled when at least one subject is checked.

Local state for step 1:
```ts
let pickedTemplate: Template | null = null;
let checked: Set<string> = new Set();   // preset names that are checked
```

`checked` is re-initialized to all preset names whenever `pickedTemplate` changes.

`selectedPresets` (used in `finish()`) is derived:
```ts
$: selectedPresets = pickedTemplate?.presets.filter(p => checked.has(p.name)) ?? [];
```

"Next" is disabled when `pickedTemplate` is null OR `selectedPresets.length === 0`.

Only `BUILTIN_TEMPLATES` are shown — new users have no custom templates yet.

---

## `finish()` — Auth-Aware Subject Save

```ts
import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';

async function finish() {
  settings.update(s => ({ ...s, dailyGoalHours }));
  localStorage.setItem('pulse_exam_date', examDate);
  localStorage.setItem('pulse_target_scores', JSON.stringify(targetScores));
  localStorage.setItem('pulse_onboarded', '1');

  const authState = get(auth);
  const isAuth = authState.mode === 'authenticated';
  const userId = isAuth ? (authState.user?.id ?? 'guest') : 'guest';
  const mode: 'guest' | 'authenticated' = isAuth ? 'authenticated' : 'guest';

  const subjectRecords: Subject[] = selectedPresets.map((p, i) => ({
    id: db.newId(),
    userId,
    name: p.name,
    symbol: p.symbol,
    color: p.color,
    colorRgb: p.colorRgb,
    orderIndex: i,
    targetScore: targetScores[p.name],
  }));

  if (mode === 'guest') {
    localStorage.setItem('pulse_subjects', JSON.stringify(subjectRecords));
  } else {
    await Promise.all(subjectRecords.map(s => db.saveSubject(s, 'authenticated')));
  }

  goto('/dashboard');
}
```

Exam date, target scores, and daily goal stay in `localStorage` for both modes — they are settings, not Supabase-backed data.

---

## Login — Post-Auth Routing

After a successful `signInWithPassword`, query Supabase for one subject row to determine if the account is new:

```ts
async function login() {
  loading = true; error = '';
  const { data: authData, error: err } = await supabase.auth.signInWithPassword({ email, password });
  loading = false;
  if (err) { error = err.message; return; }

  const userId = authData.session!.user.id;
  const { data: existing } = await supabase
    .from('subjects')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  goto(existing && existing.length > 0 ? '/dashboard' : '/onboarding');
}
```

One lightweight query (select id only, limit 1). Fast.

---

## Out of Scope

- Guest-to-account data migration
- Onboarding for custom/user-created templates
- Server-side route guards (no SvelteKit hooks changes)
- Persisting exam date / target scores / daily goal to Supabase
