# Newsroom Design System

The visual and interaction language for the Newsroom dashboard, Telegraph editions, and any future Gekko-internal UI.

**Tone:** clean SaaS, calm, professional. The kingdom is a *conceptual* layer — used in language, iconography, and information architecture — but never decorative. No parchment, no faux-medieval typography, no ornate borders. Think Linear, Notion, Vercel — but with the soul of a kingdom.

---

## Principles

1. **Calm over busy.** Generous whitespace. One primary action per surface. The operator should be able to scan a page and immediately know what matters.
2. **Reusable over bespoke.** If it appears twice, it's a component. If it appears once, it's still probably a component.
3. **Information density when it earns it.** The matrix view (apps × concerns) is dense by necessity — but everything else breathes.
4. **One primary accent.** Everything else neutral. The accent is reserved for primary actions and active state.
5. **The kingdom shows through language, not chrome.** "The Curator" labels appear in copy. Agent names label notifications. The dashboard talks about "villages" and "the Capital." But the visual style is just clean SaaS — no fantasy textures.
6. **Dark mode is first-class.** This is a developer-facing tool used at 6am with coffee. Both modes must feel intentional.

---

## Design tokens

### Colors

**Neutral scale (greys)** — the primary palette. Tailwind's `neutral` or `zinc` scale. Use these for ~90% of all surfaces, text, and borders.

**Primary accent** — `indigo-600` (light mode) / `indigo-400` (dark mode).
- Used for: primary CTA buttons, active nav state, links, focus rings, key data points (e.g. the "time saved" number on dashboards).
- Not used for: incidental icons, decoration, secondary buttons.

**Semantic colors** — used sparingly, only when they communicate state:
| Purpose | Light | Dark |
|---|---|---|
| Healthy / success | `emerald-600` | `emerald-400` |
| Warning / degraded | `amber-600` | `amber-400` |
| Critical / error | `rose-600` | `rose-400` |
| Info / neutral signal | `sky-600` | `sky-400` |

**Backgrounds:**
| Layer | Light | Dark |
|---|---|---|
| Page | `neutral-50` | `neutral-950` |
| Surface (card) | `white` | `neutral-900` |
| Surface (elevated) | `white` | `neutral-800` |
| Subtle (zebra, hover) | `neutral-100` | `neutral-800/50` |

**Text:**
| Use | Light | Dark |
|---|---|---|
| Primary | `neutral-900` | `neutral-50` |
| Secondary | `neutral-600` | `neutral-400` |
| Tertiary / hint | `neutral-500` | `neutral-500` |

### Spacing

Tailwind's default 4px grid. **Use only these spacing values:** `1, 2, 3, 4, 6, 8, 12, 16, 24` (= 4, 8, 12, 16, 24, 32, 48, 64, 96 px).
Don't invent intermediate values. If a layout needs spacing that isn't in this set, use the next one up.

**Rhythm:**
- Card internal padding: `p-6` (24px) standard, `p-8` (32px) for primary cards
- Section gap (between cards): `gap-4` or `gap-6`
- Page padding: `px-8 py-10` (page level), tighter on mobile

### Radius

**Use 4 (`rounded`) and 8 (`rounded-lg`) only.**
- `rounded` (4px) — small interactive elements (buttons, inputs, badges, chips)
- `rounded-lg` (8px) — cards, surfaces, modals, dropdowns

No `rounded-xl`, `rounded-2xl`, no fully circular elements except avatars.

### Shadows

**Subtle, not floating.** The shadow communicates layer, not levitation.

| Use | Class |
|---|---|
| Resting card | `shadow-sm` |
| Hover/elevated card | `shadow` |
| Modal, dropdown, popover | `shadow-lg` |
| Toast / floating element | `shadow-xl` |

Never `shadow-2xl`. Never custom shadows.

### Typography

**Stack:**
- Sans: Inter (system fallback: `ui-sans-serif`)
- Mono: JetBrains Mono (system fallback: `ui-monospace`)

**Scale:** Tailwind defaults. **Use only:** `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`. Skip `text-4xl+` outside marketing.

**Weights:** `font-normal` (400), `font-medium` (500), `font-semibold` (600). Never bold (`700`).

**Default body:** `text-sm` for dense surfaces (matrix, tables), `text-base` for reading surfaces (Telegraph article body).

### Iconography

- **Library:** `lucide-react` (already in Gekko's standard tooling).
- **Default size:** 16px (`size-4`) inline, 20px (`size-5`) for primary actions, 24px (`size-6`) for empty-state illustrations.
- **Stroke weight:** default (2). Don't change.
- **Color:** inherit from text by default; semantic colors only when state-communicating.

### Motion

- **Duration:** `transition-all duration-150` for most interactions.
- **Hover state:** subtle background shift, never scale or rotation.
- **Page transitions:** none, beyond what Next.js does by default.
- **Loading:** skeleton placeholders, not spinners (except for explicit "submitting" states ≤300ms).

---

## Kingdom theme — where it shows up

The kingdom analogy is **conceptual scaffolding**, not visual decoration. Here's where it surfaces:

**In language and copy:**
- "Villages" instead of "apps" or "services"
- "The Capital" for platform-level views
- "Bridges" for external-system integrations
- "The Curator says…" / "The Mechanic noticed…" for agent attribution
- "Telegraph — Daily Edition" for the morning digest

**In iconography (subtle):**
- Each agent has a single lucide icon paired with their name (e.g. The Curator → `library`, The Mechanic → `wrench`, The Scout → `binoculars`, The Foreman → `hard-hat`, The Firefighter → `flame`, The Inspector → `clipboard-check`, The Concierge → `concierge-bell`, The Caretaker → `broom`, The Quartermaster → `package`, The Architect → `compass`).
- Villages get a generic `building-2` icon by default; specific apps may have their own.

**Where it does NOT show up:**
- No castle illustrations, no banners, no parchment, no scrolls
- No medieval typography
- No skeuomorphic textures
- No fantasy color palette (gold, brown, deep red)

If you want the Age-of-Empires/WoW-modern feel, it lives in the **information architecture** (the matrix is your "kingdom map") and in the **agent personas** (each has a voice and a beat) — not in the chrome.

---

## Layout and navigation

### App shell

```
┌────────────────────────────────────────────────────────────────────┐
│  ⌂ Newsroom               Search...                     ☰  ☾  👤   │  ← top bar (h-14)
├──────────┬─────────────────────────────────────────────────────────┤
│          │                                                          │
│  Sidebar │  Page content                                            │
│  (w-64)  │                                                          │
│          │                                                          │
│ Front pg │                                                          │
│ Villages │                                                          │
│ Agents   │                                                          │
│ Bridges  │                                                          │
│ Standard │                                                          │
│ Settings │                                                          │
│          │                                                          │
└──────────┴─────────────────────────────────────────────────────────┘
```

- **Top bar:** logo, global search, theme toggle, notifications, user menu.
- **Sidebar:** persistent on desktop (≥lg), drawer on mobile. Width 256px (`w-64`). Subtle right border, no shadow.
- **Page content:** `max-w-7xl mx-auto px-8 py-10`.

### Primary nav (sidebar)

| Section | Slug | What |
|---|---|---|
| **Front Page** | `/` | Telegraph Daily — morning digest, urgent items, today's work |
| **Villages** | `/villages` | The matrix view — apps × concerns |
| **Agents** | `/agents` | The team — what each agent did recently |
| **Bridges** | `/bridges` | Power Automate, Copilot Studio, Pronto — external systems |
| **Standard** | `/standard` | The Gekko Standard — compliance per village |
| **Settings** | `/settings` | Operator settings, notification config, agent prefs |

---

## Core components

These are the building blocks. Every screen composes from these.

### Card

The fundamental container. `rounded-lg`, `shadow-sm`, `p-6`, `bg-white dark:bg-neutral-900`, optional border `border border-neutral-200 dark:border-neutral-800`.

Variants:
- `Card` — default
- `Card.Stat` — large headline number + label (e.g. "47 hours saved this week")
- `Card.Section` — has header (title + optional action), body, optional footer

### StatusDot

A 2px-wide colored circle indicating health. Sizes `sm` (8px) / `md` (10px). Colors map to semantic palette.

### Badge / Chip

`rounded`, `text-xs`, `font-medium`, `px-2 py-0.5`. Variants: neutral (default), success, warning, danger, info.

### Button

- `rounded`, `px-3 py-1.5` (sm) or `px-4 py-2` (md)
- Variants: `primary` (indigo bg), `secondary` (neutral bg), `ghost` (transparent, hover bg-neutral-100), `destructive` (rose bg)
- Always pair with optional leading icon

### Matrix table

The **defining component** of this product. A grid of villages × concerns where each cell shows status.

Specs:
- Sticky first column (village name + icon)
- Cells: status dot + value (e.g. "🟢 342" or "8.5h")
- Click cell → opens drawer with detail
- Click village name → village page
- Click column header → filter/sort

### Agent card

Per-agent summary: icon, name, beat (one sentence), last-seen timestamp, count of recent findings. Click → agent page.

### Telegraph article

A reading surface — wider line-length, larger leading, `prose` styles. Sections: front-page items, today's work, long read, classifieds. Each item has an attribution footer ("— The Foreman, 06:14").

### Empty state

Illustration (lucide icon, `size-12`, `text-neutral-400`), heading, one-line description, optional CTA.

### Drawer / sheet

Right-side slide-out for detail views. Width `w-[480px]` standard, `w-[640px]` for wide content. Uses `shadow-lg`.

### Toast

Bottom-right, `rounded-lg`, `shadow-xl`, with semantic accent border. Auto-dismiss 5s, manual close X.

---

## Component library

**Use shadcn/ui as the base.** Install components as needed (don't pre-install all). Keep the registry default; only customize variants when the design tokens above require it.

**Required from shadcn:**
- `button`, `card`, `badge`, `dialog`, `dropdown-menu`, `sheet` (drawer), `toast` (sonner), `tabs`, `tooltip`, `input`, `label`, `select`, `switch`, `skeleton`, `avatar`, `command` (search palette)

**Do not use:**
- `accordion` (collapsing UI fights scannability)
- `carousel` (this is a tool, not a marketing page)
- Any component with built-in animations beyond fade/slide

**Custom components** (live in `components/newsroom/`):
- `Matrix` (the village-concern grid)
- `StatCard`
- `AgentCard`
- `VillageCard`
- `TelegraphArticle`
- `StatusDot`

---

## Accessibility

- Color contrast ≥ AA in both modes.
- Focus rings visible: `focus-visible:ring-2 focus-visible:ring-indigo-500`.
- Every icon-only button has `aria-label`.
- Status colors paired with text or icon — never color alone.
- Keyboard-first: every action reachable via tab; `cmd-k` opens search.

---

## What this design system is NOT

- It's not a marketing site spec.
- It's not a public product spec — this is internal tooling for a small team.
- It's not a brand guideline — Gekko's brand lives elsewhere.
- It's not exhaustive — when you need something new, decide once, document here, then use everywhere.

---

## Implementation

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4 (CSS-variable based theming for dark mode)
- **Components:** shadcn/ui, lucide-react
- **Lives at:** `Platform/newsroom/dashboard/`
- **Reuses (long-term):** the existing `~/admin-center/frontend/` may be replaced by this; for now they coexist
