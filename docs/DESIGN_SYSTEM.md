# Kingdom Design System

The visual and interaction language for the Kingdom dashboard, the CI Desk, Telegraph editions, and any Gekko-internal UI.

**Tone:** clean SaaS, calm, professional. The kingdom is a *conceptual* layer — used in language, iconography, and information architecture — but never decorative. No parchment, no faux-medieval typography, no ornate borders. Think Linear, Notion, Vercel — but darker, and with soul.

---

## Theme — Void Teal

The Kingdom runs dark-first. One accent colour: **teal**. Everything else is near-black and slate.

> **Why Void Teal?** The king works at 6am. The screen shouldn't fight back.
> Teal reads as "active system" — calm, technical, alive. It is reserved for primary actions,
> active state, and key data points. Nothing else competes with it.

### Core palette

| Token | Value | Use |
|---|---|---|
| `--bg` | `#050510` | Page background (void — near-black with blue undertone) |
| `--surface` | `#0d0d1a` | Sidebar, toolbar backgrounds |
| `--card` | `#111122` | Cards, panels |
| `--card-hover` | `#181830` | Card hover state |
| `--bg-elev-2` | `#1a1a2e` | Elevated surfaces (modals, tooltips interior) |
| `--border` | `rgba(148,163,184,0.08)` | Default dividers |
| `--border-strong` | `rgba(148,163,184,0.15)` | Card outlines, focused inputs |
| `--teal` | `#81e6d9` | **Primary accent — use sparingly** |
| `--teal-deep` | `#4fd1c5` | Teal buttons (hover state) |
| `--teal-bright` | `#b2f5ea` | Teal button pressed / highlight |
| `--teal-glow` | `rgba(129,230,217,0.12)` | Active nav background |
| `--teal-glow-soft` | `rgba(129,230,217,0.06)` | Hover background |
| `--teal-tint-bg` | `rgba(129,230,217,0.04)` | Very subtle teal wash |

### Text scale

| Token | Value | Use |
|---|---|---|
| `--text-strong` | `#f1f5f9` | Headlines, labels, active items |
| `--text` | `#cbd5e1` | Body text |
| `--text-muted` | `#94a3b8` | Secondary labels |
| `--text-dim` | `#64748b` | Captions, timestamps |
| `--text-faint` | `#475569` | Placeholders, disabled |

### Entity type colours

Every ticket, project, bug, or incident carries one of three type colours. These are the only non-teal accent colours used in the Kingdom.

| Entity | Colour | Hex | Use |
|---|---|---|---|
| **Project** | Teal | `#81e6d9` | Ongoing work, features, initiatives |
| **Bug** | Orange | `#fb923c` | Feature degraded, core unaffected |
| **Incident** | Red | `#f87171` | Service down or severely impaired |

### Node status colours (chain view)

| Status | Colour | Hex |
|---|---|---|
| Done | Green | `#4ade80` |
| Active / in progress | Amber | `#fbbf24` |
| Waiting on stakeholder | Purple | `#c084fc` |
| Blocked | Red | `#f87171` |
| Not started / dim | Slate | `#475569` |
| Scope addition | Blue | `#60a5fa` |

---

## Design principles

1. **Calm over busy.** Generous whitespace. One primary action per surface. The operator should scan and immediately know what matters.
2. **Reusable over bespoke.** If it appears twice, it's a component.
3. **Information density when it earns it.** The chain view is dense by necessity — everything else breathes.
4. **One primary accent.** Teal is reserved for primary actions and active state. Orange (bug) and red (incident) exist only to communicate entity type. Nothing else is colourful.
5. **The kingdom shows through language, not chrome.** "Villages," "The Capital," "the Hand of the King" appear in copy. The visual style is just clean dark SaaS.
6. **Dark mode is first-class.** This system does not have a light mode. Dark is the design.

---

## Typography

| Stack | Font | Fallback |
|---|---|---|
| Body / UI | Inter | `ui-sans-serif, system-ui` |
| Code / mono | JetBrains Mono | `ui-monospace, monospace` |

**Scale (use only these):** `text-xs` (10–11px), `text-sm` (12–13px), `text-base` (14px), `text-lg` (16px), `text-xl` (18px), `text-2xl` (22px), `text-3xl` (28px).

**Weights:** 400 (normal), 500 (medium), 600 (semibold), 700 (bold for numerics only). Never 800+.

**Mono is used for:** IDs, timestamps, code, serial numbers, counts in badges, keyboard shortcuts.

---

## Spacing

Tailwind's 4px grid. **Permitted values:** `1 2 3 4 6 8 10 12 16 20 24 32`. Don't invent intermediates.

- Card internal padding: `p-4` dense · `p-5` standard · `p-6` relaxed
- Section gap between cards: `gap-3` or `gap-4`
- Page padding: `px-8 py-10` on desktop

---

## Radius

| Size | Value | Use |
|---|---|---|
| `--r-sm` | `6px` | Buttons, badges, chips, inputs |
| `--r-md` | `8px` | Cards, dropdowns, tooltips |
| `--r-lg` | `12px` | Panels, desk frames |
| `--r-pill` | `999px` | Tags, filter chips, avatar pills |

---

## Shadows

Shadows communicate depth, not drama. All shadows use near-black (`rgba(0,0,0,x)`) not grey.

| Use | Definition |
|---|---|
| Resting card | `0 1px 4px rgba(0,0,0,0.4)` |
| Elevated card | `0 4px 12px -4px rgba(0,0,0,0.6)` |
| Modal / popover | `0 16px 48px -16px rgba(0,0,0,0.8)` |
| Teal glow (accent elements) | `0 0 12px rgba(129,230,217,0.2)` |

---

## Core components

### Chip / Badge

`border-radius: 999px`, `font-size: 10.5px`, `font-family: mono`, `font-weight: 600`, `letter-spacing: 0.02em`.

Variants:
- `chip-project` — teal tint, teal text
- `chip-bug` — orange tint, orange text
- `chip-incident` — red tint, red text
- `chip-done` — green tint, green text
- `chip-active` — amber tint, amber text
- `chip-waiting` — purple tint, purple text
- `chip-blocked` — red tint, red text
- `chip-village` — indigo tint, indigo text

### Buttons

| Variant | Background | Text | Use |
|---|---|---|---|
| Primary | `--teal-deep` → `--teal-bright` on hover | `--bg` | Single primary action per page |
| Secondary | Transparent | `--text-muted` | Non-destructive secondary |
| Ghost | Transparent | `--text-faint` | Toolbar, inline |

All buttons: `border-radius: var(--r-sm)`, `font-size: 12px`, `font-weight: 600`.

### Card / Surface

```css
background: var(--card);
border: 1px solid var(--border-strong);
border-radius: var(--r-lg);
```

Hover state adds `background: var(--card-hover)` and strengthens border slightly.

### Sidebar filter pattern

The sidebar is a filter, not navigation. Structure:
- Section header: `10px mono uppercase tracking-widest --text-faint`
- Item: `13px`, `--text-muted` default, `--teal` + `--teal-glow` background when active
- Count badge: `11px mono --text-faint`, teal when active

**Do not put metadata in the sidebar.** Stakeholders, assignees, and tags belong on the queue items themselves, not as sidebar filters — they create visual noise without earned value.

### Chain node

The chain visualization is the defining component of the CI Desk. Rules:

- **Spine:** 2px vertical gradient line, teal-to-dim
- **Phase node:** circle (22px), status colour fill + border
- **Milestone node:** diamond (20px rotated square), status colour
- **Comms node:** pill/cloud (22×14px), status colour — used for logged communication events
- **Node label:** `13.5px semibold --text-strong`
- **Node desc:** `12px --text-dim`
- **Gap warning:** inline pill, red text + red border — auto-calculated from `due_date`
- **Node actions (on hover):** `Edit · Log comms · Add node below` — appear only on hover, mono 10.5px
- **Add-node inserter:** dashed teal rule with `+ insert node here` appears between nodes on hover

Sub-trees (branches):
- Collapsed by default, summary badge shows count
- Toggle button: `branch-toggle`, mono 11px, arrow rotates on open
- Branch spine: 2px `rgba(148,163,184,0.12)` — visually subordinate to main spine

### Evolution timeline (Screen 04)

- One swimlane per village (not per type)
- Left column: village name + activity badge counts (`3P 5B 1I`)
- Right: `position:relative` track, height `80px`, markers positioned by `left: X%`
- Marker anatomy: dot (16px circle) → 8px line → label text
- Label colour maps to entity type
- Popup appears **above** the marker (`bottom: calc(100% + 10px)`)
- Merged tickets: dashed dot, strikethrough label, faded opacity

---

## Layout — CI Desk

```
┌────────────── Control bar (fixed top, pill) ───────────────────────┐
│  ← Scriptorium  |  CI Desk  |  01 Queue  02 Project  03 Bug  04 Evo │
└─────────────────────────────────────────────────────────────────────┘

Queue screen:                     Chain screen:
┌─────────────────────────────┐   ┌─────────────────────────────────┐
│ ◀ Queue / [ticket title]    │   │ ◀ Queue / [ticket title]        │
├──────────┬──────────────────┤   ├──────────┬──────────────────────┤
│ Sidebar  │ Stats strip      │   │ Sidebar  │ chain title + legend  │
│ Views    │ Tab bar          │   │ metadata │ ─────────────────     │
│ Villages │ Queue list       │   │ alert    │ ● Kickoff milestone   │
│          │ ─────────────    │   │ gh link  │ ○ Phase node          │
│          │ Each row has:    │   │          │   └ sub-tree (toggle) │
│          │ icon · title ·   │   │          │ ☁ Comms event         │
│          │ chips · meta     │   │          │ ◇ Next milestone      │
│          │ days · › chevron │   │          │                       │
└──────────┴──────────────────┘   └──────────┴──────────────────────┘
```

---

## Kingdom theme — where it surfaces

**In language and copy:**
- "Villages" (not "apps" or "services")
- "The Capital" (platform-level)
- "Bridges" (external-system integrations)
- "The Hand of the King" (the daily task list / matters view)
- "The Scriptorium" (documentation and design demos)
- Agent attribution: "The Steward noticed…", "The Herald published…"

**In iconography:**
- Each Royal Court agent has a single lucide icon paired with their name
- Villages use `building-2` by default
- The CI Desk uses: `flame` (incident), `bug` (bug), `hexagon` (project)

**Where it does NOT show up:**
- No castle illustrations, banners, parchment, scrolls
- No medieval typography
- No skeuomorphic textures
- No fantasy colour palette (gold, brown, deep red)

---

## Accessibility

- Contrast ≥ AA. Teal (#81e6d9) on `#050510` passes WCAG AA large text; used at ≥11px for chips.
- Focus rings: `outline: 2px solid var(--teal); outline-offset: 2px`
- Status communicated by colour **and** text/icon — never colour alone.
- Every icon-only button has `aria-label`.
- Keyboard-first: all actions reachable via tab.

---

## Tech implementation

| Layer | Choice |
|---|---|
| Framework | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 (CSS-variable theming) |
| Components | shadcn/ui + custom |
| Icons | lucide-react (16px default, 20px primary actions) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |
| Motion | `transition-all duration-150` — never scale/rotation on hover |

**shadcn components in use:** `button`, `card`, `badge`, `dialog`, `dropdown-menu`, `sheet`, `toast` (sonner), `tabs`, `tooltip`, `input`, `select`, `command` (search palette).

**Custom components** (live in `components/kingdom/`):
- `ChainView` — the spine + node visualization
- `QueueItem` — desk queue row
- `EvolutionTimeline` — per-village swimlane
- `NodeActionBar` — hover actions on chain nodes
- `GapWarning` — inline pill for overdue communication gaps
- `BranchToggle` — collapsible sub-tree button
