# Operator Duties

What the king actually does (and should do) to keep the Kingdom running. Anything in here that is repeatable and observable is a candidate to become a member of the Royal Court.

This list is the brief that informs which agents we build, in what order. Inclusion here does not commit to building an agent — it commits to acknowledging the duty.

**Out of scope (handled elsewhere):** backups, SSL, and domains live with Barry. *Cost* monitoring of the GPU stack belongs to GK, not the Capital — but GPU *utilization* (whether the AI has headroom) is in scope.

---

## How attention works

The king does a **weekly review** — pull-based, from the Capital dashboard. Everything else runs silently in the background.

- **Telegram is for action, not information.** A duty's watcher only pings Telegram when the king needs to do something: approve a patch, restart a village, decide on a feedback cluster. Routine "everything is fine" never reaches Telegram.
- **No agent ships with a notification it doesn't need.** Every Telegram alert must justify itself with a specific action the king is being asked to take.
- **Weekly digests pull, not push.** The king goes to the dashboard to read what happened this week. The duties don't shout to be remembered.
- **Daily was a slip of phrase.** Whenever a duty below could be read as "daily," the right reading is weekly review + continuous background detection + action-only alerts.

This applies to every duty below.

---

## 1. Uptime

- **Beat:** Every village stays reachable and serves real traffic.
- **Today:** Manual weekly tour — hit every village's `/health` endpoint and eyeball the response.
- **Should be:** Continuous pinging in the background. Move from "is it up?" to "did it serve N successful requests in the last hour?" so a frozen-but-200 backend is caught. Weekly digest on the dashboard. Telegram only on action-required events: a village has been down >N minutes, or a sustained drop in success count.
- **Candidate council member:** A liveness watcher. Likely shares a body with the error-logging agent — same data pipeline, different question asked.

## 2. Error Logging

- **Beat:** Errors across villages are noticed, deduplicated, and either fixed or knowingly accepted.
- **Today:** Manual review of logs across villages — Graylog and ad-hoc tailing.
- **Should be:** Every village ships errors to the Capital. Agent groups by signature, marks new-vs-recurring, ranks by frequency and recency. Weekly digest of what happened. Telegram only when a *new* error class appears, or an existing one spikes — both action-required (decide: fix, suppress, accept).
- **Candidate council member:** An error-triage agent. Strong fit with the uptime watcher — likely the same agent reading the same firehose.

## 3. Dependencies & Security Patches

- **Beat:** No village runs known-vulnerable code, and no host runs unpatched OS or container images.
- **Today:** Occasional `npm audit`, `pip-audit`, `apt update` runs when I happen to think of them. No single view across villages.
- **Should be:** A weekly scan across every village repo (Node, Python, Docker base images) plus the host (apt, base containers on gvdi-30). One ranked report on the dashboard: severity, age, which village is exposed, suggested fix. Telegram only on **critical CVEs** that need an immediate decision — everything else waits for the weekly review. King approves; agent opens PRs.
- **Candidate council member:** A security warden. Reads from GitHub + the server. Output is a weekly report and PR drafts.

## 4. Server Health (gvdi-30)

- **Beat:** gvdi-30 has headroom (disk, memory, CPU). Containers and systemd services are not silently dying or restarting.
- **Today:** Manual ssh + `df -h`, `docker ps`, `systemctl --user status` when something feels off.
- **Should be:** Continuous resource monitoring with thresholds in the background. Weekly summary on the dashboard. Telegram only on action-required events: disk >85% (needs cleanup decision), repeated container restarts (needs investigation), failed systemd unit, OOM event.
- **Candidate council member:** A server-health watcher. A small daemon plus an agent that decides what's worth surfacing.

## 5. GPU Utilization (GK GPU)

- **Beat:** The GK GPU has headroom for the AI workloads running on it — utilization, VRAM, thermal, and inference queue depth all stay in a healthy band.
- **Today:** Not monitored. We notice when something slows down or fails.
- **Should be:** Continuous telemetry from the GPU host — GPU utilization %, VRAM use, thermals, queue depth on the inference service. Thresholds: sustained >85% utilization for >10 min, VRAM >90%, queue backlog above a chosen N. Weekly digest. Telegram only on sustained breach (action: downsize a workload, move a model, restart inference).
- **Candidate council member:** A GPU watcher. Sibling of the server-health watcher — same daemon-plus-agent shape, different telemetry source. May literally be the same agent with two telemetry inputs.
- **Note on scope:** This is *utilization*, not *cost*. Cost remains with GK.

## 6. GPU Workload & Local Models

- **Beat:** The GPU is being used for queries that are real and needed, against the right local models for those queries. (The GPU exists to serve a local model — its purpose only holds if both halves are healthy.)
- **Today:** Not done. We don't tag GPU calls by source — we can't tell which village/app is hitting it for what. We picked the current model(s) when we set this up; there's no systematic comparison against newer releases, and they're dropping almost daily now.
- **Should be:**
  - **Workload visibility.** Every call to the inference service is tagged: which village/app, what kind of query (chat, embedding, summarisation, etc.), tokens, latency. Weekly view shows usage by app and by query type. The king can ask *"is this app's GPU usage real and necessary?"* and get a real answer instead of a shrug.
  - **Model curation.** A catalog of local models we serve. When a notable model drops, an eval pipeline runs a representative sample of recent queries through it and compares quality, latency, and VRAM cost against the incumbent. King sees a side-by-side and decides whether to swap. No upgrade happens without an eval that justifies it.
- **Telegram:** Action-only — an unknown caller appears on the GPU (untagged or new village), or a model eval produces a clear recommendation worth deciding on.
- **Candidate council member(s):** Likely two agents sharing a surface:
  - A *workload attributor* — lives in or beside the inference proxy, captures tagged metrics
  - A *model-eval orchestrator* — runs new-model benchmarks against the captured query sample
  - Both report into the same dashboard view so the king sees usage and model decisions together
- **Build prerequisite:** the inference proxy must accept and propagate caller tags. Without that, neither half of this duty works.

## 7. Subject Feedback

- **Beat:** Users (subjects) of each village tell us how it's feeling, and we actually hear them.
- **Today:** Nothing systematic. No feedback widget on any village. Signal is entirely informal — someone tells me in passing.
- **Should be:**
  - Each village shows a small "How is this feeling?" widget anchored bottom-right.
  - Widget collects: sentiment (one tap), optional free-text, and the page/context where it was opened.
  - Submissions post to the Capital API as feedback events.
  - Agent groups by village, sentiment trend, feature mentioned. Weekly digest on the dashboard. Telegram only on a sudden negative cluster — action: investigate before more arrive.
- **Candidate council member:** A feedback agent. Requires a feedback-widget component (shared, lives in the design system) before the agent has anything to read.
- **Build prerequisite:** the widget must exist before the agent is meaningful. Two pieces of work, not one.

## 8. Management Communications

- **Beat:** When Barry, Wayne, or Mark needs something from me, I know fast — and their asks are not buried under user noise.
- **Today:** Manual monitoring of Teams and Outlook. Their messages compete for attention with everything else in my inbox. Things get missed.
- **Should be:**
  - Bot watches Teams threads and Outlook inbox for messages from those three.
  - Distinguishes actionable asks from FYI and from conversation passing through.
  - Surfaces with explicit priority. Weekly digest captures the pattern: *"Barry asked for X, Wayne asked for Y."*
- **Telegram:** Always, on a direct ask from any of the three. This is the explicit, planned priority channel — exactly what Telegram-action-only is for.
- **Candidate council member:** A chamberlain agent for management comms. Identity-aware: knows the names, knows the asks, knows the difference between an ask and chatter.
- **Build prerequisites:** MS Teams + Outlook connectors in `bridges/`, authenticated as the automation account.

## 9. User Request Triage

- **Beat:** Every inbound user message — Teams, email, the `flow.Sentinel` mailbox, eventually the in-app widget — gets read, classified, and routed to the right pipeline. Off-peak, the agent may draft a solution so the king wakes up to a PR ready to approve rather than a fresh issue.
- **Today:** Manual triage. I read every message, decide what it is (bug? feature? feedback? automation idea?), assign it somewhere or fix it myself. Nothing automated.
- **Should be:**
  - **Classify & route.** Bot reads all inbound user channels (Teams, Outlook user threads, the `flow.Sentinel` mailbox). Classifies each message — report, feedback, automation request, question, FYI — and routes into to-dos, GitHub issues, the automation backlog, or "no action."
  - **Off-peak autonomy.** Outside working hours, the agent may *draft* a solution — branch + open PR — for issues it has high confidence in. King wakes up to a ready-to-review PR. Strictly PRs: no autonomous merges, no deploys. Human-in-the-loop is the bargain.
- **Telegram:** Action-only — a PR is ready for review, or a request needs the king's judgement (high stakes, novel, or low-confidence to auto-draft).
- **Candidate council member(s):** A *triage agent* (reads, classifies, routes), optionally paired with a *night worker* (drafts PRs off-peak, hands off to the triage agent's surface). Could be one agent or two — judgement call when we build it.
- **Build prerequisites:**
  - MS Teams + Outlook connectors in `bridges/` — shared with Management Comms, same module.
  - Read access to the `flow.Sentinel` mailbox. Today Power Automate distributes from there to email + an Asana task (e.g. reception calls get transcribed → emailed in → routed out). The king wants a peek into that flow for anything actionable on his side.
  - All authenticated as the automation account.

## 10. Backlog Self-Maintenance

- **Beat:** The king's todo list and GitHub issues stay accurate without him grooming them. Done work auto-closes. Observed work auto-opens. Low-stakes work gets attempted by the Night Worker; king approves on arrival.
- **Today:** Manual. The Hand of the King (already built) reads the list and surfaces priorities, but does not yet close, open, or attempt items. The king still curates.
- **Should be:**
  - **Auto-close.** When a commit, merged PR, or deploy references a TODO item or GitHub issue (by id, by signature, or by "fixes #N"), the agent closes the item with the artefact linked.
  - **Auto-open.** When an agent observes work that should exist — a recurring error class from #2, a security finding from #3, a stale-but-still-needed item — it opens a TODO or GitHub issue with the right Standard v1.1 labels (`agent-raised`, severity, source agent).
  - **Auto-attempt.** Items the classifier marks low-stakes get a PR draft attempted by the Night Worker (shared with #9). King approves on arrival.
- **Telegram:** Action-only — a PR draft is ready for review, or an item has gone stale beyond SLA and needs a decision.
- **Candidate council member:** Extension of The Hand of the King. May spawn a "Scribe" sub-agent for the close/open mechanics. Shares the Night Worker with #9.
- **Build prerequisites:** The Hand is built; Standard v1.1 GitHub labels exist; villages registered in `github-repos.json`. The new work is the auto-close detector, the auto-open hook (so other agents can file items), and the low-stakes classifier.

## 11. Data Hygiene

- **Beat:** Old logs, abandoned containers, orphaned files, and dead user data don't accumulate without anyone noticing.
- **Today:** Not done. Things accumulate.
- **Should be:** Quarterly sweep — old rotated logs, stopped containers no one needs, large unused Docker volumes, scratch directories, dead user accounts. Agent reports candidates on the dashboard; king approves deletions. **No Telegram alerts** — this duty never produces an interrupt.
- **Candidate council member:** A janitor. Lowest priority of the eleven.

---

## Next step: prioritise for automation

The eleven duties are not equal. Some are urgent and high-leverage; some are low priority. The next conversation is which to automate first — and which to leave manual on purpose because the king should still feel them.

Telegram alert design for each agent follows from this doc: action-only, never informational. The Capital dashboard is where the king goes to *look*; Telegram is where the agents come to *get help*.
