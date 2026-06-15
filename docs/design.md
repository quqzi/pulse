# Pulse — Design Specification

A study-tracking PWA for Thai high-school students preparing for the **TCAS** university-entrance exams. This document is the single source of truth for Pulse's visual design — usable as a brief for design tools (e.g. Google Stitch) and as the reference behind the CSS token system in `src/app.css`.

**Product feeling:** *Apple Health + Headspace + Notion Calendar.* Calm, premium, focused, trustworthy. The app should **reduce exam anxiety** and encourage consistency — supportive, never pressuring.

Mobile-first PWA, responsive to tablet & desktop. Bilingual (English + ไทย) — always leave room for longer Thai strings.

---

## 1. Design philosophy (Apple-grade)

- **Clarity** — every element has a purpose; the interface never needs explanation.
- **Deference** — the UI serves the content; study progress is always the focus.
- **Depth** — layering, translucency, and soft shadows communicate hierarchy.
- **Focus** — each screen has ONE primary action and ONE primary piece of information.
- **Consistency** — unified spacing, type, icons, motion across the product.
- **Craftsmanship** — every radius, shadow, alignment, and transition is intentional.
- **Calm confidence** — students feel in control, not overwhelmed.
- **Subtraction** — remove anything that doesn't help students prepare. Fewer elements, more whitespace, stronger focus.

When choosing between options, pick what Apple would: fewer elements, clearer hierarchy, more whitespace.

---

## 2. Liquid Glass surfaces

Cards and floating nav use frosted, translucent "liquid glass":

- Background blur + saturation behind the panel
- Soft edge highlight (1px inner light) and a single gentle shadow
- Layered depth; floating bottom nav / sidebar
- Must stay **highly readable** — glass is structure, never decorative noise

---

## 3. Color system

**One accent only.** Secondary colors are reserved: **amber** = urgency (streak at risk, exam soon), **green** = completed goals/achievements only.

Pulse ships five themes; **Apple (light & dark) is the primary design direction** for the redesign.

| Token | Apple Light | Apple Dark | Vercel Light | Vercel Dark | Resend (dark) |
|---|---|---|---|---|---|
| `--primary` (accent) | `#0066cc` | `#2997ff` | `#171717` | `#ededed` | `#fcfdff` |
| `--bg` (page) | `#fafafa` | `#000000` | `#fdfdfd` | `#0a0a0a` | `#000000` |
| `--bg2` (card) | `#ffffff` | `#1c1c1e` | `#ffffff` | `#1a1a1a` | `#0a0a0c` |
| `--bg3` (hover) | `#fafafc` | `#2c2c2e` | `#f5f5f5` | `#262626` | `#101012` |
| `--border` | `rgba(0,0,0,.08)` | `#2c2c2e` | `#ebebeb` | `#2a2a2a` | `#1a1a1d` |
| `--text` | `#1d1d1f` | `#f2f2f7` | `#171717` | `#ededed` | `#fcfdff` |
| `--muted` | `#7a7a7a` | `#ababab` | `#888888` | `#a1a1aa` | `#a0a0a0` |
| `--warning` | `#f59e0b` | `#fbbf24` | `#f59e0b` | `#fbbf24` | `#fbbf24` |
| `--success` | `#22c55e` | `#4ade80` | `#22c55e` | `#4ade80` | `#4ade80` |

**Background:** behind all content, a soft, slow-moving **aurora gradient** — indigo → deep blue → soft cyan, low-contrast, alive but never distracting.

> Rule: never put `color: white/#fff` on a `--primary` background — use `--bg` (always contrasting). Read theme colors from `document.body` (theme classes live on `<body>`).

---

## 4. Typography

| Theme | Sans / display | Mono |
|---|---|---|
| Apple | `SF Pro Text / SF Pro Display` | `SF Mono` |
| Vercel | `Geist` | `Geist Mono` |
| Resend | `Inter` (display: `Georgia` serif) | `Geist Mono` |

Rules:
- Tight **negative letter-spacing** on headings ≥ 18px.
- **Large bold tabular numerals** for the values that matter: countdowns, study hours, streaks, timer display.
- Strong hierarchy, excellent readability. Page titles ~26px (`text-large-title`).

---

## 5. Spacing, radius, shadow

- **Radius** (`--radius-sm / md / lg`): Apple `8 / 18 / 22px` · Vercel `6 / 8 / 12px` · Resend `8 / 12 / 16px`. Cards use the **lg/md** radius (soft, 16–22px).
- **One subtle shadow per card.** No stacked/heavy shadows.
- Generous, consistent spacing; comfortable reading width on desktop; large touch targets (min 44px).
- Never animate `width`/`height` — use `transform: scaleX/scaleY`.

---

## 6. Motion

Calm and physical. Spring tokens: `--ease-spring`, `--ease-out`; durations `--dur-fast / base / slow`.

- Smooth spring transitions, soft hover, gentle expand/collapse.
- A slow **"breathing" pulse** on the exam countdown.
- Honor `prefers-reduced-motion` (a global guard disables motion).
- Never: flashy, bouncy-cartoon, or attention-grabbing motion.

---

## 7. Navigation

- **Mobile:** floating glass **bottom tab bar** — Dashboard · Timer · Subjects · **More**. The More drawer holds Schedule, Analytics, Journey, Tasks, Scores, Exam, Flashcards, Settings.
- **Tablet / desktop:** adaptive glass **sidebar**, grouped **Main** (Dashboard, Timer, Subjects) and **Track** (the rest). Same design language.

---

## 8. Screens

1. **Dashboard** — greeting ("Good evening, {name}"); the visual anchor is a **multi-exam countdown** (a glass card per upcoming exam, nearest first, huge tabular numeral + "N days until {exam}" + date); today's study hours vs daily goal with a slim bar; streak, readiness %, total hours; quick actions (Log session, Start timer).
2. **Timer** — large circular progress ring around a huge time (`MM:SS`, or `H:MM:SS` past an hour); Pomodoro/Free toggle; subject picker; start/pause/stop; a **Focus Mode** that hides everything but the ring, time, and pause.
3. **Subjects & topics** — grid of glass subject cards (tinted icon squircle + thin progress bar + %); detail view with topic checklist, flashcard decks (due badges), weak/recommended areas.
4. **Schedule** — weekly planner where all 7 days fit on a phone; glass study blocks on a time grid, drag-and-drop with a snap ghost; exam-countdown banner; richer calendar on desktop.
5. **Analytics & Insights** — minimal premium charts (hours by subject, weekly/monthly trends, goal completion) + plain-language insight cards in encouraging language.
6. **Settings** — grouped glass cards: Appearance (theme tiles), Language (EN/ไทย), **Exams** (editable list: name + date), Goals, Notifications.

---

## 9. Empty / loading states

- Standard empty state: centered card, bold title + muted hint. No spinners (stores fill fast), no explicit error UI (errors surface as toasts).

---

## 10. Quality bar

Design as if for an **Apple Design Award**: timeless, elegant, sophisticated — not trendy. Prioritize clarity, focus, craftsmanship, and emotional comfort over feature density.
