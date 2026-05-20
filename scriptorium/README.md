# The Scriptorium

The Kingdom's documentation + design-demo village.

One page per village (an app, service, process, or bridge in the Kingdom).
Each village page has two halves: a **wiki** on top (searchable markdown
documentation) and a gallery of **HTML demos** on the bottom (mockups, flow
diagrams, design iterations pushed in from any Claude Code session).

## What's here today

This folder is the static design prototype, generated via claude.ai/design
and implemented from the handoff bundle on 2026-05-20.

| File | Purpose |
|---|---|
| `index.html` | The Kingdom — homepage with village grid, search, type filters |
| `village.html` | A single village's page (wiki + demos zone) |
| `demo.html` | Full-screen demo viewer with floating control bar |
| `search.html` | Full-text search results across all village wikis |
| `styles.css` | Void Teal design tokens + shared components |
| `scriptorium.js` | ⌘K focus + search-input → search.html on Enter |

### How to view

Open `index.html` directly in a browser, or serve the folder:

```
python3 -m http.server -d scriptorium 8090
# then visit http://localhost:8090
```

## What's next

The static prototype is the visual contract. To turn this into a working
village we still need:

1. **Charter** — village-type taxonomy + mandatory-post rules, written into
   `docs/GEKKO_STANDARD.md` so every village knows what it owes its page.
2. **Content store** — `villages/<slug>/wiki/*.md` + `villages/<slug>/demos/*.html`
   layout on disk, edited from any Claude Code session and committed to git.
3. **Renderer** — replace the hard-coded mock content in the HTML files with
   markdown rendering + a SQLite FTS5 index for site-wide search.
4. **Seed demos** — migrate the existing HTML reports from `~/reports/Kingdom/`
   into the demos gallery as the first batch.

## Design notes

- **Void Teal palette** — near-black background (`#050510`) with teal accent
  (`#81e6d9`). Kingdom metaphor is conceptual scaffolding, never visual
  decoration. No parchment, no medieval imagery.
- **Mock content** in the cards (Quarry, Postmaster, Almanac, Drawbridge,
  Beacon, Foundry) is design-fill. The three real villages depicted are
  Gekko Tracks, The Interceptor, and Bender; the rest will be replaced as
  real villages register.
- **Removed from the design** during iteration: village health dots, sync
  language, the three header buttons (Watch / Open repo / Edit page). The
  CSS still defines `--health-*` tokens because the warning-callout colour
  uses one of them.
