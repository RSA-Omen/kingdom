# DREAMBOARD — Kingdom

Ideas worth keeping warm. Not on TODO.md because they aren't ready to be specced, but too good to forget. Each entry says **what**, **why warm not hot**, and **what would unlock it**.

When an idea graduates, it moves to TODO.md (or straight to a GitHub Issue) with a real priority.

---

## The Master of Letters

**What.** A Royal Court agent that reads correspondence from Outlook and Teams via Microsoft Graph, classifies each new message into one of four buckets — Noise, Awareness, King-must-act, Agent-can-attempt — and routes it. The king wakes up to a triaged inbox, GitHub Issues already filed in the right village repo, and draft PRs ready to review on the Bucket-4 items. Cocked guns instead of an inbox.

**Why warm not hot.**

- Requires standing up public HTTPS on `gvdi-30` (nginx + Let's Encrypt + firewall rule + public DNS). That's a real piece of infrastructure work before the agent itself starts.
- Needs MSAL delegated auth wired into the Capital — a new pattern for the Kingdom even though admin-center has the precedent.
- Needs routing rules per village before Bucket 3 (Issue creation) is useful — premature without more villages graduating.
- Bucket 4 (auto-draft PRs) is only safe once the king trusts the Chamberlain's classification, which means we need months of Bucket 1–3 history first.

**What would unlock it.**

1. A public hostname for the Capital (e.g. `capital.gekko.dev`) — must point at gvdi-30 with port 443 open.
2. Certbot in place on the box for Let's Encrypt renewal.
3. MSAL app registration in the Gekko tenant with `Mail.Read`, `Mail.Send` (draft), `ChannelMessage.Read.All`, and the king's consent.
4. The Steward's GitHub-Issue-creation pattern reused as the destination for Bucket 3.

**Visual.** [the-master-of-letters.html](http://localhost:8095/Kingdom/the-master-of-letters.html) — full dataflow, four buckets, components, decisions, phasing.

**Phasing when it goes hot.**

1. Bridge + webhook ingress + classification to dashboard (read-only).
2. Routing rules + GitHub Issue creation + Telegram on Bucket 3.
3. Draft PR / draft reply generation on Bucket 4.

**Status:** dreaming · 2026-05-14.

---
