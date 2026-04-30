# Capital — Dashboard

The web UI for the Kingdom. Next.js 16, React 19, Tailwind 4, shadcn/ui.

For visual language and component contracts, see `../../docs/DESIGN_SYSTEM.md`.

## Structure

```
dashboard/
├── app/                     ← Next.js App Router
│   ├── layout.tsx           ← top bar + sidebar shell
│   ├── page.tsx             ← Landing page (kingdom welcome + status)
│   ├── villages/            ← The matrix view (apps × concerns)
│   ├── council/             ← The Royal Court — per-agent pages
│   ├── bridges/             ← External systems
│   ├── standard/            ← Gekko Standard compliance per village
│   └── settings/            ← Operator settings
├── components/
│   ├── ui/                  ← shadcn primitives
│   └── kingdom/             ← Kingdom-specific components (Matrix, AgentCard, etc.)
├── lib/                     ← utils, API client, types
└── public/
```

## Backend

The dashboard talks to the **Capital API** — currently `~/admin-center/backend/`, eventually moves to `../api/`. We do not duplicate the API layer; new endpoints are added to the Capital API, not here.

API base URL via `NEXT_PUBLIC_API_BASE` (default `http://localhost:5001`).

## Setup

```bash
cd ~/Kingdom/capital/dashboard
npm install
npx shadcn@latest init
npm run dev
```

## Status

Foundation phase. Landing page exists; downstream pages are placeholders until the Royal Court comes online.
