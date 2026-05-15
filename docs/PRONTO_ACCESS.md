# How the Kingdom talks to Pronto Xi

This document is the **single source of truth** for how the Kingdom reads from, writes to, or otherwise interacts with Pronto Xi.

If you are about to write code that touches Pronto, read this first. If the work fits an existing path, use it. If it doesn't, decide which path it belongs in — do not invent a new one.

---

## The short version

> **Pronto Xi is reached via Bender, a village of the realm.** The Interceptor handles a separate, narrow Pronto path that predates Bender and is not replaced by it. There is no `bridges/pronto/` folder. There never will be one unless Pronto gives us a real API.

---

## The two paths

### 1. Bender — the default path going forward

**What it is:** A village (`~/Operations/bender/`, repo `RSA-Omen/bender`) running on `gvdi-30:8092`. A headless Chromium session, driven by a service account (`gekko_flow`) that logs into Pronto autonomously via SAML/Keycloak, walks Pronto's menus by keyboard and click, and runs pre-written YAML recipes.

**What to use it for:**
- Any new "read from Pronto" task — supplier master, GL exports, work-order data, anything Pronto's UI can export
- Any new "write to Pronto" task — invoice entry, journal entry, transaction posting
- Anything that would have been "a Pronto integration" before Bender existed

**Why:** Pronto Xi has no production-grade REST API we can rely on. Bender is the realm's answer until that changes. It is unattended, repeatable, auditable (every recipe is YAML in git), and cross-platform (Linux, Windows, macOS).

**How to add a new flow:** Author the recipe once via Claude, save the YAML to `~/Operations/bender/recipes/`, validate with `--dry-run`, then trigger via Bender's HTTP API or the operator UI at `gvdi-30:8092`. The recipe runs forever without AI in the production hot path.

**How it surfaces in the Kingdom:**
- The Steward polls `:8092/health` every 5 minutes; failures fire action-only Telegram alerts at the 3-strike threshold
- Bender appears on `/villages`, on the Throne Room "Systems" hexagon, and on the Master of Works card — just like every other village
- The repo is registered in `github-repos.json` and carries all 8 standard Kingdom issue labels

### 2. The Interceptor — the implied-link path

**What it is:** A Flask app (`~/Operations/interceptor-app/`, repo `RSA-Omen/interceptor-app`) running on `gvdi-30:8001` (AU / L01) and `gvdi-30:8004` (ZA / L02), exposed via Azure App Proxy.

**What it does:** Pronto Xi emits "implied-link" URLs whenever a user clicks a documents-folder link from inside Pronto. Those URLs point at the Interceptor. The Interceptor catches them, ensures the matching NextCloud folder exists (creating it via WebDAV if needed), and 302-redirects the user to the folder.

**What to use it for:** Nothing new. The Interceptor handles exactly one Pronto integration concern — implied-link routing into NextCloud — and that is the only thing it should ever handle. Do not extend it with general-purpose Pronto reads or writes.

**Why it lives parallel to Bender:** The Interceptor is *triggered by Pronto* (Pronto fires the URL, the Interceptor responds). Bender *drives Pronto* (Bender logs in and clicks). Different direction, different mechanism — they don't overlap and they don't replace each other.

---

## What's NOT a Pronto bridge

There is no `bridges/pronto/` folder, and there isn't going to be one. Specifically:

- **`pronto-api-deployment`** — archived. Was a one-off scrape effort, superseded by Bender. (`~/Archive/`, 2026-05-07)
- **`pronto-api-scrape`, `pronto-help-scrape`, `pronto-designs`** — research dumps. Earmarked for `~/Scrapes/` cleanup. None of these are runtime components.

If Pronto ever ships a real REST API we can trust, *then* we revisit and build `bridges/pronto/` as a proper bridge. Until then, Bender is the path.

---

## What the kingdom analogy actually says about Pronto

Per `CLAUDE.md`:
- **Villages** are apps Gekko owns and runs. Bender is a village.
- **Bridges** are integrations to systems Gekko does *not* control.

Pronto Xi is a system Gekko does not control, so technically it sits on the far side of a bridge. But the *mechanism* of the bridge — the thing that does the actual talking — is Bender. That makes Bender both a village (a real running app inside the realm) and the carrier of Pronto traffic (the practical bridge mechanism).

Don't let the metaphor mislead you. Bender is a village. Pronto access goes through Bender. The Interceptor is its own thing.

---

## When this document is wrong

- If Pronto ships a real API: update this doc, add `bridges/pronto/`, decide on the migration plan from Bender's UI automation to API calls per flow.
- If the Interceptor's role expands: update the Interceptor section here and in its own `CLAUDE.md` first, before writing code.
- If a third Pronto access pattern emerges: stop and have a conversation with the king before merging. Two paths is a system; three is a swamp.
