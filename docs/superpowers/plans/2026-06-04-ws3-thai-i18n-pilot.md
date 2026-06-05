# WS3 — Thai i18n (Pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `$t` i18n store + a new locale-aware `$fmt` formatter into the shared nav and the dashboard, add a language toggle (settings + onboarding), and lock en/th parity with a test — proving the full Thai-i18n pattern before fan-out.

**Architecture:** Keep the existing typed dict-as-store (`$t.section.key`, derived from `settings.lang`). Add `src/lib/i18n/format.ts` exposing a derived `fmt` store (`$fmt.date`/`$fmt.num`) that forces the Gregorian calendar on the `th-TH` locale (Thai month names, CE year). A vitest parity test guards en/th drift. Settings/onboarding get import-free autonym pills (`English` / `ไทย`) writing `settings.lang`; nav + dashboard components switch hardcoded strings to `$t`/`$fmt`.

**Tech Stack:** SvelteKit 2, TypeScript, Svelte 4 idiom, vitest, `Intl.DateTimeFormat`/`NumberFormat`.

**Spec:** `docs/superpowers/specs/2026-06-04-ws3-thai-i18n-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/i18n/i18n.test.ts` | en/th deep key+type parity guard | Create |
| `src/lib/i18n/format.ts` | `fmt` derived store — locale date/number formatting | Create |
| `src/lib/i18n/format.test.ts` | formatter behavior (Thai month + CE year; en-US) | Create |
| `src/lib/i18n/index.ts` | re-export `t` and `fmt` | Modify |
| `src/lib/i18n/en.ts` | canonical dictionary — add nav/dashboard/readiness keys | Modify |
| `src/lib/i18n/th.ts` | Thai mirror — add the same keys | Modify |
| `src/lib/components/Sidebar.svelte` | desktop nav → `$t.nav.*` | Modify |
| `src/lib/components/TabBar.svelte` | mobile tab bar → `$t.nav.*` | Modify |
| `src/lib/components/MoreDrawer.svelte` | mobile More drawer → `$t.nav.*` | Modify |
| `src/routes/(app)/settings/+page.svelte` | language pills in Appearance | Modify |
| `src/routes/onboarding/+page.svelte` | language pills at top of card | Modify |
| `src/routes/(app)/dashboard/+page.svelte` | greeting/labels/dates → `$t`/`$fmt` | Modify |
| `src/lib/components/HeroCard.svelte` | hero strings → `$t` | Modify |
| `src/lib/components/ReadinessCard.svelte` | readiness strings → `$t` | Modify |
| `src/lib/components/TodaysPlan.svelte` | label/Start → `$t`; rename local `t`→`tp` | Modify |
| `src/lib/components/QuickLog.svelte` | form strings → `$t`; rename local `t`→`tp` | Modify |

**Out of scope (fan-out plan):** the other 11 pages + their components, settings-body translation, nav group labels (`Main`/`Track`), aria-label translation. SubjectTile needs no change (no static strings).

---

## Task 1: en/th parity guard test

**Files:**
- Test: `src/lib/i18n/i18n.test.ts`

- [ ] **Step 1: Write the parity test**

```ts
import { describe, it, expect } from 'vitest';
import { en } from '$lib/i18n/en';
import { th } from '$lib/i18n/th';

type Shape = Record<string, unknown>;

// Flatten to `path:typeof` entries so a string→function mismatch is also caught.
function keyTypes(obj: Shape, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? keyTypes(v as Shape, path)
      : [`${path}:${typeof v}`];
  });
}

describe('i18n en/th parity', () => {
  it('th has the identical key set and value types as en', () => {
    expect(keyTypes(th as Shape).sort()).toEqual(keyTypes(en as Shape).sort());
  });

  it('converted sections have no leftover ASCII-English string values in th', () => {
    // Sections converted in the WS3 pilot. Extend this list as fan-out proceeds.
    const sections = ['nav', 'dashboard', 'readiness'] as const;
    const offenders: string[] = [];
    for (const sec of sections) {
      const block = (th as Record<string, Shape>)[sec] ?? {};
      for (const [k, v] of Object.entries(block)) {
        if (typeof v === 'string' && /[A-Za-z]/.test(v) && /^[\x00-\x7F]+$/.test(v)) {
          offenders.push(`${sec}.${k} = "${v}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — expect PASS (guard is green from the start)**

Run: `npx vitest run src/lib/i18n/i18n.test.ts`
Expected: PASS (2 tests). en/th are already at parity; `readiness` doesn't exist yet so its block is `{}` (skipped). This test now guards every dict edit in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n/i18n.test.ts
git commit -m "test(i18n): guard en/th key+type parity"
```

---

## Task 2: `fmt` formatter store

**Files:**
- Create: `src/lib/i18n/format.ts`
- Test: `src/lib/i18n/format.test.ts`
- Modify: `src/lib/i18n/index.ts`

- [ ] **Step 1: Write the failing formatter test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { settings, defaults } from '$lib/stores/settings';
import { fmt } from '$lib/i18n/format';

const ISO = '2026-06-04T10:00:00.000Z';

beforeEach(() => settings.set(defaults()));

describe('fmt formatter store', () => {
  it('English uses en-US: English month + CE year', () => {
    settings.set({ ...defaults(), lang: 'en' });
    const s = get(fmt).date(ISO, { month: 'long', year: 'numeric' });
    expect(s).toContain('June');
    expect(s).toContain('2026');
  });

  it('Thai uses Thai month name + Gregorian (CE) year, not Buddhist Era', () => {
    settings.set({ ...defaults(), lang: 'th' });
    const s = get(fmt).date(ISO, { month: 'long', year: 'numeric' });
    expect(s).toContain('มิถุนายน'); // "June" in Thai
    expect(s).toContain('2026');     // CE year
    expect(s).not.toContain('2569'); // would be Buddhist Era
  });

  it('num formats with the active locale', () => {
    settings.set({ ...defaults(), lang: 'en' });
    expect(get(fmt).num(1234.5)).toBe('1,234.5');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/i18n/format.test.ts`
Expected: FAIL — `Cannot find module '$lib/i18n/format'` (file not created yet).

- [ ] **Step 3: Create the formatter store**

```ts
// src/lib/i18n/format.ts
import { derived } from 'svelte/store';
import { settings } from '$lib/stores/settings';

export interface Formatter {
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  num: (n: number, opts?: Intl.NumberFormatOptions) => string;
}

// `-u-ca-gregory` forces a Gregorian (CE) year on the Thai locale, which would
// otherwise default to the Buddhist Era. Thai month/day names are preserved.
export const fmt = derived(settings, ($s): Formatter => {
  const locale = $s.lang === 'th' ? 'th-TH-u-ca-gregory' : 'en-US';
  return {
    date: (iso, opts) => new Intl.DateTimeFormat(locale, opts).format(new Date(iso)),
    num: (n, opts) => new Intl.NumberFormat(locale, opts).format(n),
  };
});
```

- [ ] **Step 4: Re-export `fmt` from the i18n barrel**

Modify `src/lib/i18n/index.ts` to append:

```ts
export { fmt } from './format';
export type { Formatter } from './format';
```

(Keep the existing `export const t = …` line untouched.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/i18n/format.test.ts`
Expected: PASS (3 tests). If the Thai assertion fails with the month name missing, the Node build lacks full ICU — rerun with `node --version` ≥ 18 (full-icu is bundled by default); report before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/format.ts src/lib/i18n/format.test.ts src/lib/i18n/index.ts
git commit -m "feat(i18n): locale-aware fmt store (Thai month, Gregorian year)"
```

---

## Task 3: Grow en/th dictionaries for nav + dashboard + readiness

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/th.ts`

- [ ] **Step 1: Add the new keys to `en.ts`**

In the `nav` block, after `journey: 'Journey',` add:

```ts
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    exam: 'Exam',
```

Replace the `dashboard` block's closing (currently ends `noSubjects: 'No subjects yet.',`) so the block reads — add these keys before the closing brace:

```ts
    todaysStudy: "Today's study",
    ofDailyGoal: (n: number) => `${n}% of daily goal`,
    reviewDue: (n: number) => `Review ${n} due card${n !== 1 ? 's' : ''}`,
    logged: 'Logged!',
    subjectField: 'Subject',
    topicField: 'Topic (opt.)',
    logBtn: 'Log',
```

After the entire `dashboard: { … },` block, add a new `readiness` block:

```ts
  readiness: {
    title: 'Exam Readiness',
    noData: 'Add subjects to see readiness',
    startExam: 'Start Mock Exam →',
  },
```

- [ ] **Step 2: Add the mirrored keys to `th.ts`**

In `nav`, after `journey: 'ความก้าวหน้า',` add:

```ts
    dashboard: 'แดชบอร์ด',
    analytics: 'สถิติ',
    exam: 'ข้อสอบ',
```

In `dashboard`, before the closing brace add:

```ts
    todaysStudy: 'เรียนวันนี้',
    ofDailyGoal: (n: number) => `${n}% ของเป้าหมายวันนี้`,
    reviewDue: (n: number) => `ทบทวน ${n} การ์ดที่ถึงกำหนด`,
    logged: 'บันทึกแล้ว!',
    subjectField: 'วิชา',
    topicField: 'หัวข้อ (ไม่บังคับ)',
    logBtn: 'บันทึก',
```

After the `dashboard` block, add:

```ts
  readiness: {
    title: 'ความพร้อมสอบ',
    noData: 'เพิ่มวิชาเพื่อดูความพร้อม',
    startExam: 'เริ่มทำข้อสอบ →',
  },
```

- [ ] **Step 3: Type-check + parity**

Run: `npm run check`
Expected: 0 errors (en is the canonical `I18n` type; th is typed `: I18n`, so a missing/mismatched key fails here).

Run: `npx vitest run src/lib/i18n/i18n.test.ts`
Expected: PASS — both dicts grew identically.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/th.ts
git commit -m "feat(i18n): add nav/dashboard/readiness keys (en+th)"
```

---

## Task 4: Wire shared nav to `$t.nav.*`

**Files:**
- Modify: `src/lib/components/Sidebar.svelte`
- Modify: `src/lib/components/TabBar.svelte`
- Modify: `src/lib/components/MoreDrawer.svelte`

- [ ] **Step 1: Sidebar — key the items, render via `$t`**

Replace the `<script>` block top (imports + `groups`) with:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib/i18n';
  import type { I18n } from '$lib/i18n/en';

  type NavKey = keyof I18n['nav'];

  const groups: { label: string; colorVar: string; items: { key: NavKey; href: string; d: string }[] }[] = [
    { label: 'Main', colorVar: 'var(--nav-main)', items: [
      { key: 'dashboard', href: '/dashboard', d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
      { key: 'timer',     href: '/timer',     d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 6v6l4 2' },
      { key: 'subjects',  href: '/subjects',  d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
    ]},
    { label: 'Track', colorVar: 'var(--nav-track)', items: [
      { key: 'analytics', href: '/analytics', d: 'M18 20V10M12 20V4M6 20v-6' },
      { key: 'insights',  href: '/insights',  d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM12 8v4M12 16h.01' },
      { key: 'journey',   href: '/journey',   d: 'M22 12h-4l-3 9L9 3l-3 9H2' },
      { key: 'tasks',     href: '/tasks',     d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
      { key: 'schedule',  href: '/schedule',  d: 'M3 4h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M2 10h20' },
      { key: 'scores',    href: '/scores',    d: 'M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6' },
      { key: 'exam',      href: '/exam',      d: 'M9 11l3 3 5-5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
    ]},
    { label: 'Settings', colorVar: 'var(--muted)', items: [
      { key: 'settings',  href: '/settings',  d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
    ]},
  ];

  $: path = $page.url.pathname;
</script>
```

Then in the markup, change the item label line:

```svelte
          <span>{item.label}</span>
```
to:
```svelte
          <span>{$t.nav[item.key]}</span>
```

(The group label `{group.label}` stays English — out of scope.)

- [ ] **Step 2: TabBar — key the tabs, render via `$t`**

Replace the `<script>` block with:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib/i18n';
  import type { I18n } from '$lib/i18n/en';
  export let onMore: () => void = () => {};

  type NavKey = keyof I18n['nav'];
  const tabs: { key: NavKey; href: string; d: string }[] = [
    { key: 'home',     href: '/dashboard', d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22v-10h6v10' },
    { key: 'timer',    href: '/timer',     d: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M12 6v6l4 2' },
    { key: 'subjects', href: '/subjects',  d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
    { key: 'stats',    href: '/analytics', d: 'M18 20V10M12 20V4M6 20v-6' },
    { key: 'more',     href: '#more',      d: 'M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0M19 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0M5 12m-1 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0' },
  ];
  $: path = $page.url.pathname;
</script>
```

In the markup replace both `{tab.label}` occurrences with `{$t.nav[tab.key]}`, and change `aria-label="More"` to `aria-label={$t.nav.more}`.

- [ ] **Step 3: MoreDrawer — key the items, render via `$t`**

Replace the `<script>` block with:

```svelte
<script lang="ts">
  import { t } from '$lib/i18n';
  import type { I18n } from '$lib/i18n/en';
  export let open = false;
  export let onClose: () => void = () => {};

  type NavKey = keyof I18n['nav'];
  const items: { key: NavKey; href: string }[] = [
    { key: 'tasks',    href: '/tasks' },
    { key: 'schedule', href: '/schedule' },
    { key: 'scores',   href: '/scores' },
    { key: 'exam',     href: '/exam' },
    { key: 'insights', href: '/insights' },
    { key: 'journey',  href: '/journey' },
    { key: 'settings', href: '/settings' },
  ];
</script>
```

In the markup: change the header `<span style="font-size:17px;font-weight:700">More</span>` to `<span style="font-size:17px;font-weight:700">{$t.nav.more}</span>`, and the item line `>{item.label}</a>` to `>{$t.nav[item.key]}</a>`.

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/Sidebar.svelte src/lib/components/TabBar.svelte src/lib/components/MoreDrawer.svelte
git commit -m "feat(i18n): wire shared nav to \$t.nav"
```

---

## Task 5: Language pills in Settings (Appearance)

**Files:**
- Modify: `src/routes/(app)/settings/+page.svelte`

No i18n import here (settings body stays English in the pilot; pills use autonyms to avoid the `themes as t` shadow).

- [ ] **Step 1: Add the language control after the Theme card**

Immediately after the Appearance `</div>` that closes the theme `section-card` (the `</div>` on the line before `<p class="section-label" style="margin-top:20px">Study</p>`), insert:

```svelte
  <div class="card section-card" style="margin-top:8px">
    <div class="setting-row">
      <span class="text-body">Language</span>
      <div class="lang-pills">
        <button class="lang-pill" class:active={$settings.lang === 'en'}
          on:click={() => settings.update(s => ({ ...s, lang: 'en' }))}>English</button>
        <button class="lang-pill" class:active={$settings.lang === 'th'}
          on:click={() => settings.update(s => ({ ...s, lang: 'th' }))}>ไทย</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Add the pill styles**

Inside the `<style>` block (e.g. after the `.num-input:focus` rule), add:

```css
  .lang-pills { display:flex; gap:6px; }
  .lang-pill {
    padding:7px 14px; border-radius:999px; border:1.5px solid var(--border);
    background:var(--bg); color:var(--muted); font-family:inherit; font-size:14px;
    font-weight:600; cursor:pointer; min-height:36px;
  }
  .lang-pill.active { border-color:var(--primary); background:var(--primary-l); color:var(--primary); }
  @media (max-width: 768px) { .lang-pill { min-height: 44px; } }
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "src/routes/(app)/settings/+page.svelte"
git commit -m "feat(i18n): language toggle in settings"
```

---

## Task 6: Language pills in Onboarding

**Files:**
- Modify: `src/routes/onboarding/+page.svelte`

No i18n import (onboarding copy stays English in the pilot; pills use autonyms to avoid the `BUILTIN_TEMPLATES as t` shadow).

- [ ] **Step 1: Add pills at the top of the card, above the dots**

Change:

```svelte
  <div class="ob-card card">
    <div class="dots">
```
to:
```svelte
  <div class="ob-card card">
    <div class="lang-pills">
      <button class="lang-pill" class:active={$settings.lang === 'en'}
        on:click={() => settings.update(s => ({ ...s, lang: 'en' }))}>English</button>
      <button class="lang-pill" class:active={$settings.lang === 'th'}
        on:click={() => settings.update(s => ({ ...s, lang: 'th' }))}>ไทย</button>
    </div>
    <div class="dots">
```

(`settings` is already imported in this file.)

- [ ] **Step 2: Add the pill styles**

Inside `<style>`, after the `.dot.done` rule, add:

```css
  .lang-pills { display:flex; gap:6px; justify-content:flex-end; }
  .lang-pill {
    padding:5px 12px; border-radius:999px; border:1.5px solid var(--border);
    background:var(--bg); color:var(--muted); font-family:inherit; font-size:13px;
    font-weight:600; cursor:pointer;
  }
  .lang-pill.active { border-color:var(--primary); background:var(--primary-l); color:var(--primary); }
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/onboarding/+page.svelte
git commit -m "feat(i18n): language toggle in onboarding"
```

---

## Task 7: Wire dashboard page + its components to `$t`/`$fmt`

**Files:**
- Modify: `src/routes/(app)/dashboard/+page.svelte`
- Modify: `src/lib/components/HeroCard.svelte`
- Modify: `src/lib/components/ReadinessCard.svelte`
- Modify: `src/lib/components/TodaysPlan.svelte`
- Modify: `src/lib/components/QuickLog.svelte`

- [ ] **Step 1: Dashboard page — import stores, replace greeting/date/labels**

In `<script>`, add to the imports:

```ts
  import { t, fmt } from '$lib/i18n';
```

Replace the greeting helper. Change:

```ts
  $: greeting = getGreeting();
  …
  function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
```
to:
```ts
  $: greetingKey = greetingKeyFor(new Date().getHours());

  function greetingKeyFor(h: number): 'goodMorning' | 'goodAfternoon' | 'goodEvening' {
    if (h < 12) return 'goodMorning';
    if (h < 17) return 'goodAfternoon';
    return 'goodEvening';
  }
```

In the markup, change the greeting heading:

```svelte
      <h1 class="text-large-title">{greeting}, {name}</h1>
```
to:
```svelte
      <h1 class="text-large-title">{$t.dashboard[greetingKey]}, {name}</h1>
```

Change the date + days-to-exam line:

```svelte
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        {#if daysToExam !== null}
          · <strong>{daysToExam}d</strong> to TCAS
        {/if}
```
to:
```svelte
        {$fmt.date(new Date().toISOString(), { weekday: 'long', month: 'long', day: 'numeric' })}
        {#if daysToExam !== null}
          · {$t.dashboard.daysToExam(daysToExam)}
        {/if}
```

Change the subjects section label `<div class="section-label">SUBJECTS</div>` to:
```svelte
      <div class="section-label">{$t.dashboard.subjects}</div>
```

Change the review CTA text line:
```svelte
        Review {$dueCards.length} due card{$dueCards.length === 1 ? '' : 's'}
```
to:
```svelte
        {$t.dashboard.reviewDue($dueCards.length)}
```

Change the tasks section label `<div class="section-label">TASKS DUE</div>` to:
```svelte
      <div class="section-label">{$t.tasks.dueToday}</div>
```

Change the task due date format:
```svelte
                {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
```
to:
```svelte
                {$fmt.date(task.dueDate + 'T00:00:00', { month: 'short', day: 'numeric' })}
```

Change the see-more link text `+{$tasksDueToday.length - 5} more` to:
```svelte
          {$t.tasks.seeMore($tasksDueToday.length - 5)}
```

- [ ] **Step 2: HeroCard — `$t` for its three strings**

In `<script>` add: `import { t } from '$lib/i18n';`

Markup changes:
- `<div class="hero-label">Today's study</div>` → `<div class="hero-label">{$t.dashboard.todaysStudy}</div>`
- `<span class="streak-label">day streak</span>` → `<span class="streak-label">{$t.dashboard.streak}</span>`
- `<span>{Math.round(pct * 100)}% of daily goal</span>` → `<span>{$t.dashboard.ofDailyGoal(Math.round(pct * 100))}</span>`

- [ ] **Step 3: ReadinessCard — `$t` for label / no-data / button**

In `<script>` add: `import { t } from '$lib/i18n';`

Markup changes:
- `<span class="card-label">Exam Readiness</span>` → `<span class="card-label">{$t.readiness.title}</span>`
- `<span class="no-data">Add subjects to see readiness</span>` → `<span class="no-data">{$t.readiness.noData}</span>`
- `<button class="start-btn" on:click={() => goto('/exam')}>Start Mock Exam →</button>` → `<button class="start-btn" on:click={() => goto('/exam')}>{$t.readiness.startExam}</button>`

- [ ] **Step 4: TodaysPlan — rename local `t`→`tp`, wire label + Start**

In `<script>` add: `import { t } from '$lib/i18n';`

Rename the lambda parameter to avoid shadowing the `$t` store. Change:
```ts
      const topic = topics.find(t => t.id === card.topicId);
```
to:
```ts
      const topic = topics.find(tp => tp.id === card.topicId);
```

Markup changes:
- `<div class="section-label">TODAY'S PLAN</div>` → `<div class="section-label">{$t.dashboard.todaysPlan}</div>`
- The Start button text (the `Start` text node after the `<svg>…</svg>` inside `.start-btn`) → `{$t.timer.start}`

- [ ] **Step 5: QuickLog — rename local `t`→`tp`, wire form strings**

In `<script>` add: `import { t } from '$lib/i18n';`

Rename to avoid the store shadow. Change:
```ts
  $: subjectTopics = topics.filter(t => t.subjectId === selectedSubjectId);
```
to:
```ts
  $: subjectTopics = topics.filter(tp => tp.subjectId === selectedSubjectId);
```

Markup changes:
- `<div class="section-label">LOG SESSION</div>` → `<div class="section-label">{$t.dashboard.quickLog}</div>`
- `<span>Logged!</span>` → `<span>{$t.dashboard.logged}</span>`
- `<option value="">Subject</option>` → `<option value="">{$t.dashboard.subjectField}</option>`
- `<option value="">Topic (opt.)</option>` → `<option value="">{$t.dashboard.topicField}</option>`
- The topic `{#each subjectTopics as t}` loop → rename loop var:
  ```svelte
          {#each subjectTopics as tp}
            <option value={tp.id}>{tp.name}</option>
          {/each}
  ```
- `<span class="dur-label">min</span>` → `<span class="dur-label">{$t.common.minutes}</span>`
- The log button text `Log` → `{$t.dashboard.logBtn}`

- [ ] **Step 6: Type-check + unit tests**

Run: `npm run check`
Expected: 0 errors.

Run: `npx vitest run`
Expected: all green (parity + formatter + existing suites).

- [ ] **Step 7: Commit**

```bash
git add "src/routes/(app)/dashboard/+page.svelte" src/lib/components/HeroCard.svelte src/lib/components/ReadinessCard.svelte src/lib/components/TodaysPlan.svelte src/lib/components/QuickLog.svelte
git commit -m "feat(i18n): wire dashboard + cards to \$t/\$fmt"
```

---

## Task 8: Browser verification

**Files:** none (manual verification)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (worktree note: ensure Vite `fs.allow` + `.env.local` per the worktree memory, or run from the main checkout).

- [ ] **Step 2: Verify the EN→TH flip on the dashboard**

In the browser (guest mode):
1. Go to `/settings` → tap **ไทย**. Confirm the pill highlights.
2. Go to `/dashboard`. Confirm: greeting (อรุณสวัสดิ์/สวัสดีตอนบ่าย/สวัสดีตอนเย็น), the date renders Thai month name with a **CE year** (e.g. `4 มิถุนายน 2026`, not 2569), "days to TCAS" shows `อีก N วัน`, the SUBJECTS/แผนวันนี้/บันทึกการเรียน labels, ReadinessCard (ความพร้อมสอบ / เริ่มทำข้อสอบ), and HeroCard (เรียนวันนี้, N% ของเป้าหมายวันนี้) are all Thai.
3. Confirm desktop **Sidebar** + mobile **TabBar**/**MoreDrawer** nav items are Thai.
4. Toggle back to **English** → everything reverts.
5. Reload the page → language persists (localStorage for guest).

- [ ] **Step 3: Confirm no console errors and reduced-motion still holds**

Open devtools console — expect no errors (especially no "t is not a store" / subscription errors from the renamed loops).

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "fix(i18n): dashboard verification fixes"
```

(Skip if step 2 passed clean.)

---

## Self-Review

**Spec coverage:**
- §4.1 parity guard → Task 1 ✓
- §4.2 `fmt` store (Gregorian-forced Thai) → Task 2 ✓
- §4.3 toggle UI (settings + onboarding) → Tasks 5, 6 ✓
- §4.4 pilot conversion (nav + dashboard + components) → Tasks 3 (keys), 4 (nav), 7 (dashboard) ✓
- §7 testing (parity + formatter unit; browser flip) → Tasks 1, 2, 8 ✓

**Placeholder scan:** none — every step has concrete code/paths/commands.

**Type consistency:** `NavKey = keyof I18n['nav']` used identically in Sidebar/TabBar/MoreDrawer; new dict keys (`todaysStudy`, `ofDailyGoal`, `reviewDue`, `logged`, `subjectField`, `topicField`, `logBtn`, `readiness.*`, `nav.dashboard/analytics/exam`) are added in Task 3 before any task references them; `$fmt.date(iso, opts)` / `$t.dashboard.daysToExam(n)` signatures match their definitions. The `t`-store shadow is resolved by renaming local loop vars to `tp` in the only two converted files that used `t` (TodaysPlan, QuickLog); settings/onboarding deliberately avoid importing `t`.

**Note on scope:** nav group labels (`Main`/`Track`), aria-labels, and the settings/onboarding body copy remain English by design — they belong to the fan-out plan, not this pilot.
