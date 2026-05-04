# Phase 1 — Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every error across all villages lands in the Kingdom automatically, visible on the dashboard and delivered by Telegram at 06:00 CAT — before the King opens a laptop.

**Architecture:** New `errors` and `todos` tables in the existing admin-center SQLite database, served by two new Express routes. The Kingdom dashboard gains three new pages (Errors, To-Dos, Villages) and summary cards on the Throne Room. A Python script queries the API nightly and sends the Telegram digest via systemd timer.

**Tech Stack:** TypeScript + Express (admin-center backend) · Next.js 16 + Tailwind 4 (dashboard) · better-sqlite3 · Python 3 (village handler + Telegram digest) · systemd timer

---

## File Map

**Create:**
- `~/admin-center/backend/src/migrations/012_errors_and_todos.sql`
- `~/admin-center/backend/src/routes/errors.ts`
- `~/admin-center/backend/src/routes/todos.ts`
- `~/Kingdom/capital/dashboard/app/errors/page.tsx`
- `~/Kingdom/capital/dashboard/app/todos/page.tsx`
- `~/Kingdom/capital/dashboard/app/villages/page.tsx`
- `~/Kingdom/capital/dashboard/components/kingdom/SummaryCards.tsx`
- `~/Kingdom/capital/dashboard/components/kingdom/ErrorFeed.tsx`
- `~/Kingdom/capital/dashboard/components/kingdom/TodoList.tsx`
- `~/Kingdom/council/shared/error_reporter.py`
- `~/Kingdom/council/the-herald/morning_digest.py`
- `~/.config/systemd/user/kingdom-morning-digest.service`
- `~/.config/systemd/user/kingdom-morning-digest.timer`

**Modify:**
- `~/admin-center/backend/src/server.ts` — register errors and todos routes
- `~/Kingdom/capital/dashboard/app/layout.tsx` — add Errors and To-Dos to sidebar
- `~/Kingdom/capital/dashboard/app/page.tsx` — add SummaryCards + ErrorFeed

---

## Task 1: Database Migration

**Files:**
- Create: `~/admin-center/backend/src/migrations/012_errors_and_todos.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 012_errors_and_todos.sql

CREATE TABLE IF NOT EXISTS errors (
  id TEXT PRIMARY KEY,
  village TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  severity TEXT NOT NULL DEFAULT 'error',
  status TEXT NOT NULL DEFAULT 'open',
  linked_todo_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  village TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_errors_village ON errors(village);
CREATE INDEX IF NOT EXISTS idx_errors_status ON errors(status);
CREATE INDEX IF NOT EXISTS idx_errors_created_at ON errors(created_at);
CREATE INDEX IF NOT EXISTS idx_todos_village ON todos(village);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
```

- [ ] **Step 2: Run the migration**

```bash
cd ~/admin-center/backend && npm run migrate
```

Expected output includes `Running migration: 012_errors_and_todos.sql` with no errors.

- [ ] **Step 3: Verify tables exist**

```bash
cd ~/admin-center && sqlite3 data/app-registry.db ".tables"
```

Expected: output includes `errors` and `todos`.

- [ ] **Step 4: Commit**

```bash
cd ~/admin-center && git add backend/src/migrations/012_errors_and_todos.sql
git commit -m "feat: add errors and todos tables for Kingdom Phase 1"
```

---

## Task 2: Errors API Route

**Files:**
- Create: `~/admin-center/backend/src/routes/errors.ts`
- Modify: `~/admin-center/backend/src/server.ts`

- [ ] **Step 1: Create the errors route**

```typescript
// ~/admin-center/backend/src/routes/errors.ts
import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import { randomUUID } from 'crypto';

const router = Router();

// POST /api/errors — villages call this to report an error
router.post('/', (req: Request, res: Response) => {
  const { village, message, stack, severity = 'error' } = req.body;

  if (!village || !message) {
    return res.status(400).json({ error: 'village and message are required' });
  }

  if (!['error', 'warning', 'info'].includes(severity)) {
    return res.status(400).json({ error: 'severity must be error, warning, or info' });
  }

  const id = randomUUID();
  const created_at = Math.floor(Date.now() / 1000);

  (db as any).prepare(
    'INSERT INTO errors (id, village, message, stack, severity, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, village, message, stack || null, severity, 'open', created_at);

  res.status(201).json({ id, received_at: new Date(created_at * 1000).toISOString() });
});

// GET /api/errors — fetch errors with optional filters
router.get('/', (req: Request, res: Response) => {
  const { village, status, severity, limit = '50', offset = '0' } = req.query;

  let query = 'SELECT * FROM errors WHERE 1=1';
  const params: any[] = [];

  if (village) { query += ' AND village = ?'; params.push(village); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (severity) { query += ' AND severity = ?'; params.push(severity); }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit as string), parseInt(offset as string));

  const errors = (db as any).prepare(query).all(...params);
  const total = (db as any).prepare('SELECT COUNT(*) as count FROM errors WHERE 1=1').get();

  res.json({ errors, total: total.count });
});

// PATCH /api/errors/:id — update status or link a todo
router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, linked_todo_id } = req.body;

  const error = (db as any).prepare('SELECT * FROM errors WHERE id = ?').get(id);
  if (!error) return res.status(404).json({ error: 'Error not found' });

  if (status && !['open', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'status must be open or resolved' });
  }

  const updates: string[] = [];
  const params: any[] = [];
  if (status) { updates.push('status = ?'); params.push(status); }
  if (linked_todo_id !== undefined) { updates.push('linked_todo_id = ?'); params.push(linked_todo_id); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  (db as any).prepare(`UPDATE errors SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = (db as any).prepare('SELECT * FROM errors WHERE id = ?').get(id);
  res.json(updated);
});

// GET /api/errors/summary — counts for dashboard cards
router.get('/summary', (req: Request, res: Response) => {
  const openErrors = (db as any).prepare("SELECT COUNT(*) as count FROM errors WHERE status = 'open'").get();
  const linked = (db as any).prepare("SELECT COUNT(*) as count FROM errors WHERE linked_todo_id IS NOT NULL AND status = 'open'").get();
  const byVillage = (db as any).prepare(
    "SELECT village, COUNT(*) as count FROM errors WHERE status = 'open' GROUP BY village"
  ).all();
  const since24h = (db as any).prepare(
    "SELECT COUNT(*) as count FROM errors WHERE created_at > ? AND status = 'open'"
  ).get(Math.floor(Date.now() / 1000) - 86400);

  res.json({
    open: openErrors.count,
    linked: linked.count,
    new_24h: since24h.count,
    by_village: byVillage,
  });
});

export default router;
```

- [ ] **Step 2: Register the route in server.ts**

Open `~/admin-center/backend/src/server.ts`. Add after the last import line:

```typescript
import errorsRouter from './routes/errors';
```

Add after the last `app.use('/api/...')` line (before the auth-protected section or with the API key routes):

```typescript
app.use('/api/errors', errorsRouter);
```

- [ ] **Step 3: Restart the backend and test POST**

```bash
cd ~/admin-center/backend && npm run dev &
sleep 3
curl -s -X POST http://localhost:5001/api/errors \
  -H "Content-Type: application/json" \
  -d '{"village":"test","message":"test error","severity":"error"}' | python3 -m json.tool
```

Expected: `{ "id": "<uuid>", "received_at": "<iso-timestamp>" }`

- [ ] **Step 4: Test GET**

```bash
curl -s http://localhost:5001/api/errors | python3 -m json.tool
```

Expected: `{ "errors": [{ "id": "...", "village": "test", "message": "test error", ... }], "total": 1 }`

- [ ] **Step 5: Test summary endpoint**

```bash
curl -s http://localhost:5001/api/errors/summary | python3 -m json.tool
```

Expected: `{ "open": 1, "linked": 0, "new_24h": 1, "by_village": [{"village": "test", "count": 1}] }`

- [ ] **Step 6: Commit**

```bash
cd ~/admin-center && git add backend/src/routes/errors.ts backend/src/server.ts
git commit -m "feat: add /api/errors endpoint for Kingdom error capture"
```

---

## Task 3: Todos API Route

**Files:**
- Create: `~/admin-center/backend/src/routes/todos.ts`
- Modify: `~/admin-center/backend/src/server.ts`

- [ ] **Step 1: Create the todos route**

```typescript
// ~/admin-center/backend/src/routes/todos.ts
import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import { randomUUID } from 'crypto';

const router = Router();

// POST /api/todos — create a todo (manual or from an error)
router.post('/', (req: Request, res: Response) => {
  const { village, title, description, source = 'manual' } = req.body;

  if (!village || !title) {
    return res.status(400).json({ error: 'village and title are required' });
  }

  const id = randomUUID();
  const created_at = Math.floor(Date.now() / 1000);

  (db as any).prepare(
    'INSERT INTO todos (id, village, title, description, source, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, village, title, description || null, source, 'open', created_at);

  // If created from an error, link it
  if (source !== 'manual') {
    const error = (db as any).prepare('SELECT * FROM errors WHERE id = ?').get(source);
    if (error) {
      (db as any).prepare('UPDATE errors SET linked_todo_id = ? WHERE id = ?').run(id, source);
    }
  }

  res.status(201).json({ id });
});

// GET /api/todos — fetch todos with optional filters
router.get('/', (req: Request, res: Response) => {
  const { village, status, linked, limit = '50', offset = '0' } = req.query;

  let query = 'SELECT * FROM todos WHERE 1=1';
  const params: any[] = [];

  if (village) { query += ' AND village = ?'; params.push(village); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (linked === 'true') { query += " AND source != 'manual'"; }
  if (linked === 'false') { query += " AND source = 'manual'"; }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit as string), parseInt(offset as string));

  const todos = (db as any).prepare(query).all(...params);
  const total = (db as any).prepare('SELECT COUNT(*) as count FROM todos WHERE 1=1').get();

  res.json({ todos, total: total.count });
});

// PATCH /api/todos/:id — update status
router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, title, description } = req.body;

  const todo = (db as any).prepare('SELECT * FROM todos WHERE id = ?').get(id);
  if (!todo) return res.status(404).json({ error: 'Todo not found' });

  if (status && !['open', 'in-progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'status must be open, in-progress, or done' });
  }

  const updates: string[] = [];
  const params: any[] = [];
  if (status) { updates.push('status = ?'); params.push(status); }
  if (title) { updates.push('title = ?'); params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);
  (db as any).prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = (db as any).prepare('SELECT * FROM todos WHERE id = ?').get(id);
  res.json(updated);
});

// GET /api/todos/summary — counts for dashboard cards
router.get('/summary', (req: Request, res: Response) => {
  const open = (db as any).prepare("SELECT COUNT(*) as count FROM todos WHERE status != 'done'").get();
  const linked = (db as any).prepare("SELECT COUNT(*) as count FROM todos WHERE source != 'manual' AND status != 'done'").get();

  res.json({ open: open.count, linked: linked.count });
});

export default router;
```

- [ ] **Step 2: Register in server.ts**

Add after the errors import:

```typescript
import todosRouter from './routes/todos';
```

Add after `app.use('/api/errors', errorsRouter)`:

```typescript
app.use('/api/todos', todosRouter);
```

- [ ] **Step 3: Restart and test POST**

```bash
# Get an error ID from previous task first
ERROR_ID=$(curl -s http://localhost:5001/api/errors | python3 -c "import sys,json; print(json.load(sys.stdin)['errors'][0]['id'])")

# Create a todo linked to that error
curl -s -X POST http://localhost:5001/api/todos \
  -H "Content-Type: application/json" \
  -d "{\"village\":\"test\",\"title\":\"Fix test error\",\"source\":\"$ERROR_ID\"}" | python3 -m json.tool
```

Expected: `{ "id": "<uuid>" }`

- [ ] **Step 4: Verify the error was linked**

```bash
curl -s http://localhost:5001/api/errors | python3 -c "import sys,json; e=json.load(sys.stdin)['errors'][0]; print('linked_todo_id:', e['linked_todo_id'])"
```

Expected: `linked_todo_id: <todo-uuid>` (not None)

- [ ] **Step 5: Commit**

```bash
cd ~/admin-center && git add backend/src/routes/todos.ts backend/src/server.ts
git commit -m "feat: add /api/todos endpoint with error linking"
```

---

## Task 4: Village Error Handler

**Files:**
- Create: `~/Kingdom/council/shared/error_reporter.py`
- Modify: first village — `~/admin-center/` Interceptor app

- [ ] **Step 1: Create the shared error reporter**

```python
# ~/Kingdom/council/shared/error_reporter.py
"""
Kingdom Error Reporter — drop this into any village to enable error reporting.
Usage:
    from error_reporter import report_error
    try:
        ...
    except Exception as e:
        report_error("what failed", exc=e)
"""
import requests
import traceback
import os

KINGDOM_API = os.getenv("KINGDOM_API", "http://localhost:5001")
VILLAGE_NAME = os.getenv("VILLAGE_NAME", "unknown")

def report_error(message: str, exc: Exception = None, severity: str = "error") -> None:
    """Report an error to the Kingdom. Never raises — error reporting must not break the app."""
    try:
        requests.post(
            f"{KINGDOM_API}/api/errors",
            json={
                "village": VILLAGE_NAME,
                "message": message,
                "stack": traceback.format_exc() if exc else "",
                "severity": severity,
            },
            timeout=2,
        )
    except Exception:
        pass  # Silent — never let reporting break the app
```

- [ ] **Step 2: Find the Interceptor's main error handling**

```bash
find ~/interceptor-app /home/lauchlandupreez/Operations -name "*.py" 2>/dev/null | head -20
# or check wherever the Interceptor app lives
ls ~/admin-center/  # check if interceptor is here
docker ps | grep interceptor
```

Note the path to the Interceptor's Python backend for the next step.

- [ ] **Step 3: Copy error_reporter.py to the Interceptor**

```bash
# Replace PATH_TO_INTERCEPTOR with the actual path found above
cp ~/Kingdom/council/shared/error_reporter.py PATH_TO_INTERCEPTOR/error_reporter.py
```

- [ ] **Step 4: Add VILLAGE_NAME to the Interceptor's environment**

In the Interceptor's `.env` or docker-compose environment:

```
KINGDOM_API=http://localhost:5001
VILLAGE_NAME=interceptor
```

- [ ] **Step 5: Wire error_reporter into one Interceptor endpoint**

In the Interceptor's main exception handler (typically in the Flask/FastAPI app):

```python
from error_reporter import report_error

# In your except block:
except Exception as e:
    report_error(f"Unhandled error in {request.path}", exc=e)
    raise  # still re-raise so the app returns 500 normally
```

- [ ] **Step 6: Test end-to-end — trigger an error in the Interceptor and verify it lands**

```bash
# Trigger a test error (or check recent errors after a real request)
sleep 5
curl -s http://localhost:5001/api/errors?village=interceptor | python3 -m json.tool
```

Expected: at least one error from village `interceptor` appears.

- [ ] **Step 7: Commit**

```bash
cd ~/Kingdom && git add council/shared/error_reporter.py
git commit -m "feat: add shared village error reporter for Kingdom Phase 1"
```

---

## Task 5: Dashboard — Sidebar Navigation

**Files:**
- Modify: `~/Kingdom/capital/dashboard/app/layout.tsx`

- [ ] **Step 1: Add Errors and To-Dos to sidebar**

In `layout.tsx`, find the `sections` array inside `Sidebar()`. Add a new section:

```typescript
{
  heading: "Kingdom Watch",
  items: [
    { label: "Errors", slug: "/errors" },
    { label: "To-Dos", slug: "/todos" },
  ],
},
```

Add it between "The Capital" and "The Realm" sections.

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Kingdom/capital/dashboard && npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd ~/Kingdom && git add capital/dashboard/app/layout.tsx
git commit -m "feat: add Errors and To-Dos to Kingdom dashboard sidebar"
```

---

## Task 6: Dashboard — Summary Cards Component

**Files:**
- Create: `~/Kingdom/capital/dashboard/components/kingdom/SummaryCards.tsx`

- [ ] **Step 1: Create the component**

```typescript
// ~/Kingdom/capital/dashboard/components/kingdom/SummaryCards.tsx
"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

interface Summary {
  openErrors: number;
  openTodos: number;
  linked: number;
  new24h: number;
}

export function SummaryCards() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/errors/summary`).then((r) => r.json()),
      fetch(`${API}/api/todos/summary`).then((r) => r.json()),
    ]).then(([errors, todos]) => {
      setSummary({
        openErrors: errors.open,
        openTodos: todos.open,
        linked: errors.linked,
        new24h: errors.new_24h,
      });
    });
  }, []);

  const cards = [
    { label: "Open Errors", value: summary?.openErrors ?? "—", color: "var(--color-error, #ef4444)" },
    { label: "Open To-Dos", value: summary?.openTodos ?? "—", color: "var(--color-accent)" },
    { label: "Errors → To-Dos", value: summary?.linked ?? "—", color: "var(--color-success, #22c55e)" },
    { label: "New (24h)", value: summary?.new24h ?? "—", color: "var(--color-warning, #f59e0b)" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="surface p-5">
          <div className="text-2xl font-bold" style={{ color: card.color }}>
            {card.value}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/Kingdom && git add capital/dashboard/components/kingdom/SummaryCards.tsx
git commit -m "feat: add SummaryCards component for error/todo counts"
```

---

## Task 7: Dashboard — Error Feed Component

**Files:**
- Create: `~/Kingdom/capital/dashboard/components/kingdom/ErrorFeed.tsx`

- [ ] **Step 1: Create the component**

```typescript
// ~/Kingdom/capital/dashboard/components/kingdom/ErrorFeed.tsx
"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

interface KingdomError {
  id: string;
  village: string;
  message: string;
  severity: string;
  status: string;
  linked_todo_id: string | null;
  created_at: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#6c63ff",
};

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ErrorFeed({ limit = 8 }: { limit?: number }) {
  const [errors, setErrors] = useState<KingdomError[]>([]);

  useEffect(() => {
    fetch(`${API}/api/errors?status=open&limit=${limit}`)
      .then((r) => r.json())
      .then((data) => setErrors(data.errors || []));
  }, [limit]);

  if (errors.length === 0) {
    return (
      <div className="surface p-6 text-center text-sm text-[var(--color-text-tertiary)]">
        No open errors — the realm is quiet.
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      {errors.map((err, i) => (
        <div
          key={err.id}
          className={`flex items-center gap-4 px-5 py-3 text-sm ${
            i < errors.length - 1 ? "border-b border-[var(--color-border)]" : ""
          }`}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: SEVERITY_COLOR[err.severity] || "#888" }}
          />
          <span className="text-xs text-[var(--color-text-tertiary)] w-24 flex-shrink-0 capitalize">
            {err.village}
          </span>
          <span className="flex-1 text-[var(--color-text-secondary)] truncate">
            {err.message}
          </span>
          {err.linked_todo_id && (
            <span className="text-xs bg-[var(--color-bg-subtle)] text-[var(--color-accent)] px-2 py-0.5 rounded flex-shrink-0">
              → TODO
            </span>
          )}
          <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
            {timeAgo(err.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/Kingdom && git add capital/dashboard/components/kingdom/ErrorFeed.tsx
git commit -m "feat: add ErrorFeed component for recent errors list"
```

---

## Task 8: Dashboard — Throne Room Updates

**Files:**
- Modify: `~/Kingdom/capital/dashboard/app/page.tsx`

- [ ] **Step 1: Import new components**

At the top of `page.tsx`, add:

```typescript
import { SummaryCards } from "../components/kingdom/SummaryCards";
import { ErrorFeed } from "../components/kingdom/ErrorFeed";
```

- [ ] **Step 2: Add summary cards and error feed to ThroneRoom**

In the `ThroneRoom` function, add after the `<Hero>` component:

```typescript
<section>
  <SectionHeading eyebrow="Kingdom Watch" title="Realm at a glance" />
  <div className="mt-4">
    <SummaryCards />
  </div>
  <div className="mt-4">
    <SectionHeading eyebrow="" title="Recent errors" />
    <div className="mt-3">
      <ErrorFeed limit={5} />
    </div>
  </div>
</section>
```

- [ ] **Step 3: Run dev server and verify visually**

```bash
cd ~/Kingdom/capital/dashboard && npm run dev
```

Open `http://GVDI-30:3000` — verify:
- 4 summary cards appear with numbers (or dashes if API unreachable)
- Recent errors feed appears below
- No console errors in the browser

- [ ] **Step 4: Commit**

```bash
cd ~/Kingdom && git add capital/dashboard/app/page.tsx
git commit -m "feat: add Kingdom Watch section to Throne Room"
```

---

## Task 9: Dashboard — Errors Page

**Files:**
- Create: `~/Kingdom/capital/dashboard/app/errors/page.tsx`

- [ ] **Step 1: Create the errors page**

```typescript
// ~/Kingdom/capital/dashboard/app/errors/page.tsx
"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

interface KingdomError {
  id: string;
  village: string;
  message: string;
  stack: string | null;
  severity: string;
  status: string;
  linked_todo_id: string | null;
  created_at: number;
}

const TABS = ["All", "By Village", "Linked to To-Do"] as const;
type Tab = (typeof TABS)[number];

const SEVERITY_COLOR: Record<string, string> = {
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#6c63ff",
};

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ErrorsPage() {
  const [tab, setTab] = useState<Tab>("All");
  const [errors, setErrors] = useState<KingdomError[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ status: "open", limit: "100" });
    if (tab === "Linked to To-Do") params.set("linked", "true");
    fetch(`${API}/api/errors?${params}`)
      .then((r) => r.json())
      .then((d) => setErrors(d.errors || []));
  }, [tab]);

  const byVillage = errors.reduce<Record<string, KingdomError[]>>((acc, e) => {
    (acc[e.village] = acc[e.village] || []).push(e);
    return acc;
  }, {});

  async function createTodo(error: KingdomError) {
    const title = prompt(`To-Do title for: ${error.message}`);
    if (!title) return;
    await fetch(`${API}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ village: error.village, title, source: error.id }),
    });
    // Refresh
    setErrors((prev) =>
      prev.map((e) => (e.id === error.id ? { ...e, linked_todo_id: "pending" } : e))
    );
  }

  async function resolve(id: string) {
    await fetch(`${API}/api/errors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }

  const renderError = (err: KingdomError) => (
    <div key={err.id} className="surface mb-2 overflow-hidden">
      <div
        className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-[var(--color-bg-subtle)]"
        onClick={() => setExpanded(expanded === err.id ? null : err.id)}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: SEVERITY_COLOR[err.severity] || "#888" }}
        />
        <span className="text-xs text-[var(--color-text-tertiary)] w-24 flex-shrink-0 capitalize">
          {err.village}
        </span>
        <span className="flex-1 text-sm text-[var(--color-text-secondary)] truncate">
          {err.message}
        </span>
        {err.linked_todo_id && (
          <span className="text-xs bg-[var(--color-bg-subtle)] text-[var(--color-accent)] px-2 py-0.5 rounded">
            → TODO
          </span>
        )}
        <span className="text-xs text-[var(--color-text-tertiary)]">{timeAgo(err.created_at)}</span>
      </div>
      {expanded === err.id && (
        <div className="border-t border-[var(--color-border)] px-5 py-4 bg-[var(--color-bg-subtle)]">
          {err.stack && (
            <pre className="text-xs text-[var(--color-text-tertiary)] overflow-x-auto mb-4 max-h-40">
              {err.stack}
            </pre>
          )}
          <div className="flex gap-3">
            {!err.linked_todo_id && (
              <button
                onClick={() => createTodo(err)}
                className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white hover:opacity-80"
              >
                Create To-Do
              </button>
            )}
            <button
              onClick={() => resolve(err.id)}
              className="text-xs px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
            >
              Mark Resolved
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border)] pb-6">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch
        </p>
        <h1 className="text-2xl font-semibold mt-2 text-[var(--color-text-primary)]">
          Errors
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {errors.length} open error{errors.length !== 1 ? "s" : ""} across the realm
        </p>
      </header>

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {tab === "By Village"
          ? Object.entries(byVillage).map(([village, errs]) => (
              <div key={village} className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 capitalize">
                  {village} ({errs.length})
                </h3>
                {errs.map(renderError)}
              </div>
            ))
          : errors.map(renderError)}
        {errors.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--color-text-tertiary)]">
            No open errors — the realm is quiet.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it loads**

Open `http://GVDI-30:3000/errors` — verify:
- Three tabs render (All, By Village, Linked to To-Do)
- Errors list populates from the API
- Clicking an error expands the stack trace and shows "Create To-Do" / "Mark Resolved" buttons

- [ ] **Step 3: Commit**

```bash
cd ~/Kingdom && git add capital/dashboard/app/errors/page.tsx
git commit -m "feat: add Errors page to Kingdom dashboard"
```

---

## Task 10: Dashboard — To-Dos Page

**Files:**
- Create: `~/Kingdom/capital/dashboard/app/todos/page.tsx`

- [ ] **Step 1: Create the todos page**

```typescript
// ~/Kingdom/capital/dashboard/app/todos/page.tsx
"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5001";

interface Todo {
  id: string;
  village: string;
  title: string;
  description: string | null;
  source: string;
  status: string;
  created_at: number;
}

const TABS = ["All", "By Village", "Linked", "Unlinked"] as const;
type Tab = (typeof TABS)[number];

const STATUS_COLOR: Record<string, string> = {
  open: "#6c63ff",
  "in-progress": "#f59e0b",
  done: "#22c55e",
};

export default function TodosPage() {
  const [tab, setTab] = useState<Tab>("All");
  const [todos, setTodos] = useState<Todo[]>([]);

  const fetchTodos = () => {
    const params = new URLSearchParams({ limit: "100" });
    if (tab === "Linked") params.set("linked", "true");
    if (tab === "Unlinked") params.set("linked", "false");
    fetch(`${API}/api/todos?${params}`)
      .then((r) => r.json())
      .then((d) => setTodos((d.todos || []).filter((t: Todo) => t.status !== "done")));
  };

  useEffect(() => { fetchTodos(); }, [tab]);

  async function updateStatus(id: string, status: string) {
    await fetch(`${API}/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchTodos();
  }

  const byVillage = todos.reduce<Record<string, Todo[]>>((acc, t) => {
    (acc[t.village] = acc[t.village] || []).push(t);
    return acc;
  }, {});

  const renderTodo = (todo: Todo) => (
    <div key={todo.id} className="surface flex items-center gap-4 px-5 py-3 mb-2">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: STATUS_COLOR[todo.status] || "#888" }}
      />
      <span className="text-xs text-[var(--color-text-tertiary)] w-24 flex-shrink-0 capitalize">
        {todo.village}
      </span>
      <span className="flex-1 text-sm text-[var(--color-text-secondary)]">{todo.title}</span>
      {todo.source !== "manual" && (
        <span className="text-xs bg-[var(--color-bg-subtle)] text-[var(--color-accent)] px-2 py-0.5 rounded flex-shrink-0">
          from Error
        </span>
      )}
      <select
        value={todo.status}
        onChange={(e) => updateStatus(todo.id, e.target.value)}
        className="text-xs border border-[var(--color-border)] rounded px-2 py-1 bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]"
      >
        <option value="open">Open</option>
        <option value="in-progress">In Progress</option>
        <option value="done">Done</option>
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--color-border)] pb-6">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] font-medium">
          Kingdom Watch
        </p>
        <h1 className="text-2xl font-semibold mt-2 text-[var(--color-text-primary)]">To-Dos</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {todos.length} open to-do{todos.length !== 1 ? "s" : ""} across the realm
        </p>
      </header>

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {tab === "By Village"
          ? Object.entries(byVillage).map(([village, items]) => (
              <div key={village} className="mb-6">
                <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2 capitalize">
                  {village} ({items.length})
                </h3>
                {items.map(renderTodo)}
              </div>
            ))
          : todos.map(renderTodo)}
        {todos.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--color-text-tertiary)]">
            No open to-dos — the realm is clear.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it loads**

Open `http://GVDI-30:3000/todos` — verify:
- Four tabs render (All, By Village, Linked, Unlinked)
- Status dropdown works inline

- [ ] **Step 3: Commit**

```bash
cd ~/Kingdom && git add capital/dashboard/app/todos/page.tsx
git commit -m "feat: add To-Dos page to Kingdom dashboard"
```

---

## Task 11: Telegram Morning Digest

**Files:**
- Create: `~/Kingdom/council/the-herald/morning_digest.py`
- Create: `~/.config/systemd/user/kingdom-morning-digest.service`
- Create: `~/.config/systemd/user/kingdom-morning-digest.timer`

- [ ] **Step 1: Find the existing Telegram bot token and chat ID**

```bash
cat ~/scripts/telegram_weekly/.env 2>/dev/null || \
cat ~/scripts/telegram_weekly/config.py 2>/dev/null | grep -E "TOKEN|CHAT"
```

Note the `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` values.

- [ ] **Step 2: Create the morning digest script**

```python
#!/usr/bin/env python3
# ~/Kingdom/council/the-herald/morning_digest.py
"""
Kingdom Morning Digest — delivered at 06:00 CAT by The Herald.
Queries the Kingdom API for errors and todos, sends a Telegram summary.
"""
import os
import sys
import requests
from datetime import datetime

KINGDOM_API = os.getenv("KINGDOM_API", "http://localhost:5001")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")


def send_telegram(message: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — printing instead:")
        print(message)
        return
    requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
        json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"},
        timeout=10,
    )


def fetch(path: str) -> dict:
    return requests.get(f"{KINGDOM_API}{path}", timeout=5).json()


def main():
    today = datetime.now().strftime("%-d %b %Y")

    try:
        error_summary = fetch("/api/errors/summary")
        todo_summary = fetch("/api/todos/summary")
        villages = fetch("/api/errors?status=open&limit=100")
    except Exception as e:
        send_telegram(f"⚠ Kingdom digest failed to fetch data: {e}")
        sys.exit(1)

    # Build village breakdown
    by_village: dict[str, int] = {}
    for err in villages.get("errors", []):
        by_village[err["village"]] = by_village.get(err["village"], 0) + 1

    village_lines = []
    for village, count in sorted(by_village.items(), key=lambda x: -x[1]):
        village_lines.append(f"  • {village.capitalize()} — {count} open error{'s' if count > 1 else ''}")

    # Build message
    lines = [
        f"⚔ <b>Kingdom Morning Brief — {today}</b>",
        "",
        f"🔴 <b>Errors</b> ({error_summary.get('open', 0)} open, {error_summary.get('new_24h', 0)} new since yesterday)",
    ]
    lines += village_lines if village_lines else ["  • No open errors — the realm is quiet."]
    lines += [
        "",
        f"✅ <b>To-Dos</b> ({todo_summary.get('open', 0)} open)",
        f"  • {todo_summary.get('linked', 0)} linked to errors",
        f"  • {todo_summary.get('open', 0) - todo_summary.get('linked', 0)} manual",
    ]

    send_telegram("\n".join(lines))
    print("Digest sent.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Test the script manually**

```bash
cd ~/Kingdom/council/the-herald
KINGDOM_API=http://localhost:5001 \
TELEGRAM_BOT_TOKEN=<your-token> \
TELEGRAM_CHAT_ID=<your-chat-id> \
python3 morning_digest.py
```

Expected: Telegram message received with error counts and village breakdown.

- [ ] **Step 4: Create the systemd service**

```ini
# ~/.config/systemd/user/kingdom-morning-digest.service
[Unit]
Description=Kingdom Morning Digest — The Herald delivers the daily brief

[Service]
Type=oneshot
WorkingDirectory=/home/lauchlandupreez/Kingdom/council/the-herald
Environment="KINGDOM_API=http://localhost:5001"
EnvironmentFile=/home/lauchlandupreez/.kingdom.env
ExecStart=/usr/bin/python3 /home/lauchlandupreez/Kingdom/council/the-herald/morning_digest.py
```

- [ ] **Step 5: Create the environment file for secrets**

```bash
cat > ~/.kingdom.env << 'EOF'
TELEGRAM_BOT_TOKEN=<paste-token-here>
TELEGRAM_CHAT_ID=<paste-chat-id-here>
EOF
chmod 600 ~/.kingdom.env
```

Replace placeholders with actual values from Step 1.

- [ ] **Step 6: Create the systemd timer (fires at 06:00 CAT = 04:00 UTC)**

```ini
# ~/.config/systemd/user/kingdom-morning-digest.timer
[Unit]
Description=Kingdom Morning Digest Timer

[Timer]
OnCalendar=*-*-* 04:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
```

- [ ] **Step 7: Enable and start the timer**

```bash
systemctl --user daemon-reload
systemctl --user enable kingdom-morning-digest.timer
systemctl --user start kingdom-morning-digest.timer
systemctl --user status kingdom-morning-digest.timer
```

Expected: `Active: active (waiting)` with next trigger shown.

- [ ] **Step 8: Commit**

```bash
cd ~/Kingdom && git add council/the-herald/morning_digest.py
git commit -m "feat: add Telegram morning digest for Kingdom Phase 1"
```

---

## Done — Phase 1 Measurable Outcome

When all tasks are complete:
- Open `http://GVDI-30:3000` — summary cards show live error and todo counts
- Open `http://GVDI-30:3000/errors` — all open errors across Interceptor, Gekko Tracks, AP Processing
- Next morning at 06:00 CAT — Telegram digest arrives automatically
- A village error that no user reported appears in the dashboard within seconds of occurring
