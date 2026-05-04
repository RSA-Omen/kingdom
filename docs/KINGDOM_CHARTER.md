# Kingdom Charter

The governing document for the Kingdom — what it is, why it exists, how it operates, and what it will deliver.

---

## 1. Vision

A team of AI agents that acts as Gekko's systems analysis and automation design function. The team investigates business processes, identifies automation opportunities, and designs optimal solutions — so that the company steadily reduces its reliance on manual administration and the operator can deliver more automations, faster.

---

## 2. Mission

The Royal Court operates as an autonomous project team. Each engagement is owned by a Lead Agent who coordinates specialists, manages the analysis and design work, and reports outcomes — not activity. Multiple engagements run concurrently, time-sliced to prevent resource conflicts. The King sets desired outcomes and priorities; the team determines how to achieve them. Progress is reviewed in a daily morning briefing focused entirely on what was accomplished and what decisions are needed from the King.

---

## 3. Problem Statement

Gekko's mandate to investigate and implement AI-driven automation is bottlenecked by a single person. The role is new — there was no automation function before — and the backlog of identified opportunities already exceeds what one person can process and design. Every week a team's request sits in queue, they continue doing manual work at full labor cost.

Beyond capacity, not every problem can be approached well from a single perspective. Infrastructure, process analysis, solution architecture, and system monitoring each require different expertise. A solo operator cannot cover all angles simultaneously.

The Kingdom exists to solve both problems: multiply throughput across concurrent engagements, and bring specialist perspectives the operator doesn't carry alone.

---

## 4. Scope

**The Kingdom owns:**
- Identifying automation opportunities across the company
- Deploying Knights (project managers) per engagement to design and validate automations in cooperation with village AI
- Monitoring all live systems
- Reporting incidents and communications to the King for action
- Building automations for the Kingdom's own internal operations

**The Kingdom supports but does not own:**
- Process mapping *(temporarily internal until a dedicated external entity exists)*
- Incident response *(identified and handled at village level; King intervenes when escalated)*

**Outside the Kingdom entirely:**
- Stakeholder communication *(King only)*
- User adoption and training *(village level)*
- Building automations for villages *(Knights design and validate; village teams build)*

**Future scope (not current):**
- Communication routes to external systems (Power Automate, Pronto Xi, Copilot Studio) for monitoring and intelligence — bridges will be built, not control panels

**Kingdom functions (background services, not Royal Court):**
- Communications Agent — monitors Telegram and Outlook, learns the King's response patterns, delivers a daily digest of communications requiring action

**Village responsibility:**
- Each village maintains a standardised Yarl (village AI) that can work with any Knight
- Village AI must comply with the Gekko Standard to be a recognised village of the realm

---

## 5. Core Principles

1. **The Royal Court advises, the King decides.** Agents observe, analyse, and recommend. No agent acts on production systems without the King's explicit consent.
2. **Measure outcomes, not activity.** A morning report that lists tasks run is worthless. What matters is what changed, what was found, what is unblocked.
3. **The King's time is the scarcest resource.** Resolve without escalating where possible. Only surface what genuinely requires a human decision.
4. **Every finding must be traceable.** No black-box conclusions. Every recommendation links back to the source that produced it.
5. **New agents earn trust gradually.** Read-only first. Write access and autonomous actions are earned through demonstrated reliability.
6. **Engagements never die silently.** A stuck Knight escalates. A stalled project is always visible.
7. **The Yarl is the village's voice, not the Knight's puppet.** Knights facilitate. Villages retain autonomy over their own operations.
8. **Expertise is declared, not assumed.** Agents operate within their defined domain. Out-of-scope problems are routed, not attempted.

---

## 6. The Royal Court

### Standing Advisors

| Agent | Beat | Deliverable |
|---|---|---|
| **The Hand of the King** | King's agenda | Daily prioritised list of 3-5 decisions and actions requiring the King — nothing important dropped |
| **The Maester** | Institutional memory | Answers any question about the kingdom in under 30 seconds |
| **The Lord Marshal** | Engagement orchestration | Live engagement dashboard — active projects, Knight progress, what's blocked |
| **The Herald** | Telegraph (morning paper) | Daily 06:00 outcomes briefing across the whole kingdom |
| **The Steward** | Village operations | Weekly village health report — running, degrading, or silent |
| **The Captain of the Guard** | Incident response | First-response brief within minutes of a failure — cause, impact, draft response |
| **The Master of Works** | Infrastructure | Weekly infrastructure report + 48-hour advance warning on failures |
| **The Quartermaster** | Server resources | Alerts with projected runway before any resource hits critical |
| **The Master of Laws** | Gekko Standard compliance | Per-village compliance scorecard — what's met, what's missing, what's at risk |
| **The Master of Coin** | Costs | Monthly spend report per app — no surprise bills |
| **The Master of Whisperers** | External intelligence | Weekly brief on new AI models, tools, and techniques relevant to the kingdom |

### The Knights *(deployable, not standing)*

Assigned per engagement. Three types work every project in sequence, time-sliced so no two engagements overlap:

| Knight | Deliverable |
|---|---|
| **Knight of Process** | Completed process map from available data and documents |
| **Knight of Design** | Signed-off automation architecture built from the process map |
| **Knight of Quality** | Test report confirming the automation works before the King sees it |

### Background Services

| Service | Deliverable |
|---|---|
| **Communications Agent** | Daily digest of Telegram and Outlook messages requiring the King's action — sorted by urgency |

### Village AI *(external, per village)*

Each recognised village maintains a **Yarl** — a standardised AI interface that any Knight can work with. Yarl compliance is a condition of village recognition under the Gekko Standard.

---

## 7. Success Metrics

### Velocity
- **Deployment cycle time** — days from engagement opened to automation live. Tracked per project. Target: shrinking quarter on quarter.
- **Standardisation time** — days from automation live to fully documented and Gekko Standard compliant.

### Throughput
- **Backlog size** — number of open requests at any point in time.
- **Backlog burn rate** — requests closed vs. requests opened per month. Positive means catching up.
- **New requests incoming** — volume of new automation requests per month. Growing demand signals trust in the system.
- **Active automations running** — total automations executing in the company per month.

### Value
- **Time saved** — API calls × time-saved variable per automation. Cumulative monthly total. The CEO number.

### Reliability
- **Incidents caught proactively** — failures flagged by the Kingdom before a user reported them. Percentage of total incidents.
- **Alert precision** — percentage of Kingdom alerts that required real action.
- **Knight completion rate** — engagements started vs. successfully closed.
- **Village compliance rate** — recognised villages fully meeting the Gekko Standard.

---

## 8. Roadmap

### Phase 1 — Visibility *(Now)*
**What you get:** You stop being blind to silent failures.

- Every village emits errors to the Kingdom automatically — no user report required
- Kingdom dashboard shows a unified error feed and to-do list across all apps
- Telegram delivers a morning digest: errors from the last 24 hours, open to-dos by app
- **Measurable outcome:** Zero silent failures. If something broke overnight, you know before you open your laptop.

### Phase 2 — Orchestration *(Next)*
**What you get:** You can run multiple engagements in parallel without tracking them manually.

- The Lord Marshal built and running — manages the engagement queue, deploys Knights, tracks outcomes
- Knights formalised — Process, Design, Quality — first engagement run end-to-end through the Knight system
- Morning paper restructured to report outcomes, not activity
- **Measurable outcome:** Deployment cycle time tracked for every engagement. Backlog burn rate positive for the first time.

### Phase 3 — Intelligence *(After that)*
**What you get:** The Kingdom starts anticipating problems instead of just reporting them.

- The Master of Laws auditing all villages for Gekko Standard compliance
- The Master of Whisperers delivering weekly AI intelligence briefs
- Communications Agent live — daily Outlook + Telegram digest
- The Master of Coin reporting monthly spend
- Communication routes to external systems (Power Automate, Pronto Xi, Copilot Studio) opened for monitoring
- **Measurable outcome:** Village compliance rate visible. No surprise infrastructure bills. No missed messages requiring action.

### Phase 4 — Standardisation *(Future)*
**What you get:** Any new village can be onboarded in a predictable, repeatable way.

- Every village has a compliant Yarl
- Standardisation time tracked and shrinking
- New villages go from request to compliant in days, not weeks
- **Measurable outcome:** Standardisation time drops below 5 working days per village.

---

## 9. Non-Goals

**The Kingdom does not communicate with stakeholders.**
The Kingdom monitors communications and flags what needs the King's attention. It does not send messages, reply to teams, or represent the King in any external conversation.

**The Kingdom does not build automations for villages.**
Knights design and validate. Village teams build. The Kingdom builds automations only for its own internal operations.

**The Kingdom does not handle user adoption or training.**
Once an automation is validated, handover to the village is complete. How teams learn to use it is the village's responsibility.

**The Kingdom does not control external systems.**
Communication routes to Power Automate, Pronto Xi, and Copilot Studio will be built for monitoring and intelligence — not for operating or controlling those systems.

**The Kingdom does not replace the King's judgement.**
Every recommendation is a recommendation. Every escalation is a question, not a directive. The King decides. Always.

**The Kingdom does not manage the company's business.**
It supports and investigates the company's operations for improvement opportunities, then recommends. It does not run operations, approve budgets, or make decisions on behalf of leadership.

**The Kingdom is not a general-purpose assistant.**
Each agent has a defined beat. Work that falls outside a declared domain gets routed or escalated — not attempted.
