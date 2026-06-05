# WS3 — Thai i18n: Design

**Date:** 2026-06-04 · **Status:** approved, ready for implementation plan
**Roadmap:** `docs/superpowers/specs/2026-05-29-pulse-roadmap-and-foundation-design.md` §6 (WS3)

## 1. Problem

Pulse is a TCAS prep app for Thai students, but every UI string is hardcoded English. The i18n *scaffolding* exists yet is essentially unwired:

- `src/lib/i18n/index.ts` exposes a derived store `t` returning the whole `en` or `th` dictionary based on `settings.lang` — usage is `$t.section.key` (a dict-as-store, **not** a `$t('key')` function).
- `en.ts` / `th.ts` are ~138 lines each with matching structure (nav, dashboard, timer, subjects, …), but cover only a fraction of on-screen strings.
- No page or component actually reads `$t` yet.
- `settings.lang: 'en' | 'th'` already exists (defaults `'en'`) and syncs per-user (WS1.4).

So WS3 is mostly **wiring `$t` everywhere, growing the dictionaries to real coverage, adding the language toggle UI, and locale-aware date/number formatting** — not greenfield translation.

Surface area: ~35 `.svelte` files (12 pages + 23 components).

## 2. Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| **i18n pattern** | Keep the existing typed dict-as-store `$t.section.key`. Extend, don't replace. No library. |
| **First-pass scope** | Infra + pilot, then fan out. This plan = plumbing + nav + dashboard. Remaining pages are a follow-up plan. |
| **Thai dates** | Gregorian year + Thai month/day names (force Gregorian calendar on the `th-TH` locale). e.g. `4 มิถุนายน 2026`. |
| **Thai voice / drafting** | Claude drafts casual-friendly Thai (study-buddy tone, minimal stiff politeness particles, short labels); user reviews/corrects. Non-blocking. |

## 3. Approach (why dict-as-store)

The scaffolding already works and is type-safe: TypeScript infers the key shape from `en.ts`, interpolation is handled by function-valued keys (`daysToExam: (n) => \`${n} days to TCAS\``), and there are zero dependencies. A function translator (`$t('section.key')`) would lose compile-time key checking and require rewriting the core; a library violates the roadmap's no-new-framework non-goal. Keep `A`.

## 4. Components

### 4.1 i18n core (keep + guard)
- `en.ts` is the canonical shape; `th.ts` mirrors it exactly.
- **Parity test** (`src/lib/i18n/i18n.test.ts`, vitest): assert `th` has the identical deep key set as `en` — same keys, same value *types* (string vs function), and no English-placeholder leftovers in converted sections. This is the safety net that keeps the later fan-out from silently drifting.

### 4.2 Formatter store — `src/lib/i18n/format.ts`
A derived store `fmt` (mirrors `t`, driven by `settings.lang`):
```ts
export const fmt = derived(settings, ($s) => {
  const locale = $s.lang === 'th' ? 'th-TH-u-ca-gregory' : 'en-US';
  return {
    date: (iso: string, opts?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, opts).format(new Date(iso)),
    num: (n: number, opts?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, opts).format(n),
  };
});
```
- Thai → Thai month/day names, **CE year** (the `-u-ca-gregory` override is what prevents Buddhist Era).
- Replaces scattered hardcoded `toLocaleDateString('en-US', …)` calls **in the pilot scope**; other pages migrate during fan-out.
- Usage: `$fmt.date(session.startedAt, { weekday: 'long', month: 'long', day: 'numeric' })`.

### 4.3 Language toggle UI
- **Settings** (`src/routes/(app)/settings/+page.svelte`): EN / TH segmented control in the Appearance section, bound to `settings.lang`.
- **Onboarding**: a language control on the existing onboarding flow.
- Pure UI wiring — the setting already exists, auto-persists, and syncs per-user. No store/schema work.

### 4.4 Pilot conversion — nav + dashboard
- **Shared nav:** `Sidebar.svelte`, `MoreDrawer.svelte`, and the bottom tab bar → use `$t.nav.*` (keys already exist).
- **Dashboard page + components:** `dashboard/+page.svelte`, `HeroCard`, `ReadinessCard`, `SubjectTile`, `TodaysPlan`, `QuickLog` — every hardcoded string → `$t.*`, every date → `$fmt.*`. Grow `en.ts`/`th.ts` to cover the real strings (greeting, days-to-exam, streak, daily goal, subjects, today's plan, quick-log, readiness, empty states).
- Exercises the full pattern end-to-end: shared components, interpolation, and dates — before committing to a 35-file fan-out.

## 5. Data flow

```
settings.lang ──► t   (derived)  ──► $t.section.key      in markup
              └──► fmt (derived)  ──► $fmt.date()/.num()  in markup
toggle UI ─────► settings.lang  (auto-persist + per-user sync)
```

## 6. Error handling

- Missing keys are prevented at **compile time** by the shared dict shape; the parity test catches `th`-side drift at **test time**.
- No runtime fallback machinery needed (both dicts are full objects). YAGNI.

## 7. Testing

- **Unit:** parity test (en/th identical deep shape + value types); formatter test (Thai → Thai month name + CE year, e.g. contains `มิถุนายน` and `2026` not `2569`; English → `en-US`).
- **Browser:** toggle language on the dashboard → all nav + dashboard strings and all dates flip EN↔TH; toggle persists across reload; guest + authenticated both work.
- `npm run check` clean; `npx vitest run` green.

## 8. Out of scope (next plan)

The remaining 11 pages (timer, subjects, tasks, analytics, schedule, scores, journey, insights, exam, settings body, auth) and their components — mechanical fan-out once the pilot proves the pattern. Tracked as a follow-up WS3 plan, not built here.

## 9. Non-goals

- No i18n library, no function-translator rewrite.
- No Buddhist Era (decided: Gregorian).
- No RTL / additional languages beyond en/th.
- No automated extraction tooling — strings are moved by hand during conversion.
