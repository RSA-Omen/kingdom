# Status & Metrics Report

Custom-built systems and automation tools delivered by the internal development programme. Numbers are drawn directly from live databases and monitoring records. Last updated **May 2026**.

---

<style>
.sr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
  margin: 20px 0 28px;
}
.sr-card {
  background: var(--bg-elev-1, #0d0d1a);
  border: 1px solid var(--border, #1e2235);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sr-card .sr-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint, #4a5070);
}
.sr-card .sr-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--teal, #81e6d9);
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.sr-card .sr-sub {
  font-size: 11.5px;
  color: var(--text-dim, #6b7394);
  line-height: 1.4;
  margin-top: 2px;
}
.sr-section {
  margin: 32px 0 0;
  padding-top: 24px;
  border-top: 1px solid var(--divider, #1a1d2e);
}
.sr-section h2 {
  margin: 0 0 4px !important;
}
.sr-section .sr-tagline {
  color: var(--text-muted, #8892b0);
  font-size: 13px;
  margin: 0 0 16px;
}
.sr-monthly {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
  margin: 16px 0;
}
.sr-monthly-cell {
  background: var(--bg-elev-1, #0d0d1a);
  border: 1px solid var(--border, #1e2235);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
}
.sr-monthly-cell .m-month {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint, #4a5070);
}
.sr-monthly-cell .m-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-strong, #e8eaf6);
  margin-top: 2px;
}
.sr-monthly-cell .m-sub {
  font-size: 10px;
  color: var(--text-dim, #6b7394);
}
.sr-gap-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(251,191,36,0.06);
  border: 1px solid rgba(251,191,36,0.2);
  border-radius: 8px;
  padding: 10px 14px;
  color: #f59e0b;
  font-size: 13px;
  margin: 12px 0 16px;
  line-height: 1.5;
}
.sr-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.sr-status-chip.live { background: rgba(52,211,153,0.12); color: #34d399; }
.sr-status-chip.testing { background: rgba(251,191,36,0.12); color: #f59e0b; }
.sr-status-chip.planned { background: rgba(107,114,148,0.12); color: #6b7394; }
</style>

## Portfolio Overview

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Services Monitored</div>
    <div class="sr-value">9</div>
    <div class="sr-sub">Active villages under continuous health monitoring</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Platform Uptime</div>
    <div class="sr-value">99.7%</div>
    <div class="sr-sub">Average across all monitored services</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Incidents Tracked</div>
    <div class="sr-value">61</div>
    <div class="sr-sub">1 high · 8 medium · 52 low — since monitoring began</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Royal Court Agents</div>
    <div class="sr-value">16</div>
    <div class="sr-sub">Running autonomously — alerting only when action is required</div>
  </div>
</div>

---

<div class="sr-section">

## Gekko Tracks <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">Credit-card coding system — bank statement → cardholder classification → manager approval → Pronto export.</p>

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Total Transactions</div>
    <div class="sr-value">4,205</div>
    <div class="sr-sub">Loaded across all import cycles (Jan 2025 – May 2026)</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Cardholders</div>
    <div class="sr-value">35</div>
    <div class="sr-sub">Registered; 29 system users with login access</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Manager Approved</div>
    <div class="sr-value">1,228</div>
    <div class="sr-sub">Transactions through the full classification and approval flow</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Receipts Captured</div>
    <div class="sr-value">278</div>
    <div class="sr-sub">Uploaded and OCR-processed (phone + desktop)</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Classification Batches</div>
    <div class="sr-value">131</div>
    <div class="sr-sub">Monthly batches created by cardholders and managers</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Audit Log Events</div>
    <div class="sr-value">1,685</div>
    <div class="sr-sub">Every batch action, approval, and reassignment is recorded</div>
  </div>
</div>

**Monthly transaction volume (recent months):**

<div class="sr-monthly">
  <div class="sr-monthly-cell"><div class="m-month">Jan 26</div><div class="m-value">468</div><div class="m-sub">transactions</div></div>
  <div class="sr-monthly-cell"><div class="m-month">Feb 26</div><div class="m-value">149</div><div class="m-sub">transactions</div></div>
  <div class="sr-monthly-cell"><div class="m-month">Mar 26</div><div class="m-value">218</div><div class="m-sub">transactions</div></div>
  <div class="sr-monthly-cell"><div class="m-month">Apr 26</div><div class="m-value">317</div><div class="m-sub">transactions</div></div>
  <div class="sr-monthly-cell"><div class="m-month">May 26</div><div class="m-value">189</div><div class="m-sub">transactions</div></div>
</div>

The system covers 18 months of transaction history (Jan 2025 onward) across 5 monthly import cycles. The Pronto export pipeline is wired; the hand-off to Bender for automated Pronto entry is the next stage. AP process batch workflows (supplier assignment, cost-code coding) are currently in first-cycle testing — not yet counted in production throughput.

</div>

---

<div class="sr-section">

## The Interceptor <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">Narrow Pronto URL routing — staff click an implied link in Pronto and land directly on the right NextCloud folder.</p>

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Total Redirects</div>
    <div class="sr-value">337</div>
    <div class="sr-sub">Successful path resolutions since Nov 2025</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">May 2026 Redirects</div>
    <div class="sr-value">194</div>
    <div class="sr-sub">Most active month to date — 16 distinct staff</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Unique Staff Users</div>
    <div class="sr-value">16</div>
    <div class="sr-sub">Named users tracked across Debtors and Purchase-order paths</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Uptime (AU)</div>
    <div class="sr-value">100%</div>
    <div class="sr-sub">AU instance — ZA at 99.2% (386 health checks each)</div>
  </div>
</div>

**Monthly redirect volume:**

<div class="sr-monthly">
  <div class="sr-monthly-cell"><div class="m-month">Nov 25</div><div class="m-value">30</div><div class="m-sub">redirects</div></div>
  <div class="sr-monthly-cell"><div class="m-month">Dec 25</div><div class="m-value">108</div><div class="m-sub">redirects</div></div>
  <div class="sr-monthly-cell"><div class="m-month">May 26</div><div class="m-value">194</div><div class="m-sub">redirects</div></div>
</div>

Redirect paths are split between **Debtors** and **Purchase-order** folders under `ProntoDocs_L01`. Staff who use it span accounts, operations, and purchasing — 16 named users tracked since November. The ZA instance runs independently at 99.2% uptime and is monitored separately by the Steward.

</div>

---

<div class="sr-section">

## PDF Removal Tool <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">Removes specified pages from PDFs — runs via a web interface and an API, both containerised and always-on.</p>

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Service Uptime</div>
    <div class="sr-value">100%</div>
    <div class="sr-sub">Both web and API containers — 7,241 health checks recorded</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Running Since</div>
    <div class="sr-value">Nov 2025</div>
    <div class="sr-sub">Containerised and continuously available</div>
  </div>
</div>

<div class="sr-gap-note">
  ⚠ <span><strong>Usage telemetry not yet instrumented.</strong> The tool is live and healthy but does not currently emit usage events to the monitoring pipeline. We cannot report a real job count. Adding instrumentation is a one-session task — flagged for the next development cycle.</span>
</div>

Usage is ad hoc and user-driven. If you have a rough usage count from the team, it can be added here manually until instrumentation lands.

</div>

---

<div class="sr-section">

## Reception Voicemail Routing <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">Power Automate flow — routes voicemails left on the reception line to the right person automatically.</p>

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Typical Usage</div>
    <div class="sr-value">~2×/wk</div>
    <div class="sr-sub">Approximately 8 routed voicemails per month</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Platform</div>
    <div class="sr-value">Power Automate</div>
    <div class="sr-sub">Runs in the Microsoft 365 environment — no server required</div>
  </div>
</div>

A lightweight automation that removes a manual step from reception operations. When a voicemail comes in, the flow identifies the intended recipient and routes it — no one needs to check a shared inbox and forward manually. Usage is steady at roughly twice per week.

</div>

---

<div class="sr-section">

## Bender — Pronto AP Automation <span class="sr-status-chip testing">⬡ Testing</span>

<p class="sr-tagline">Headless-Chrome automation that drives Pronto Xi by keystroke — the only general-purpose path to Pronto for scripted workflows.</p>

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Status</div>
    <div class="sr-value">Testing</div>
    <div class="sr-sub">First cycle of AP process testing — not yet in production</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Recipe Runs (Testing)</div>
    <div class="sr-value">31</div>
    <div class="sr-sub">export-suppliers recipe — all AP process test runs, May 2026</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Uptime</div>
    <div class="sr-value">100%</div>
    <div class="sr-sub">74 health checks since onboarding to Steward monitoring</div>
  </div>
</div>

Bender holds a persistent Pronto session in a headless Chrome and executes declarative YAML recipes — navigate, export, scrape — without a staff member performing the clicks manually. Currently being tested as the automation layer for the AP process (supplier export from Pronto to feed the matching workflow). Production use follows completion of AP testing.

</div>

---

<div class="sr-section">

## The Kingdom Platform & Scriptorium <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">The infrastructure behind every number on this page — and the system that documents and governs all of it.</p>

The Kingdom exists to answer a question every growing organisation eventually faces: *how do we know what we've built, whether it's working, and what it should do next?*

**What the platform does:**

The Steward, Master of Works, and Captain of the Guard run every 5 minutes — polling health endpoints, watching infrastructure resources, classifying incidents, and escalating only what genuinely requires human attention. Over 10,800 automated health checks have been recorded. The operator wakes up each morning to a Telegram digest (the Telegraph) that covers everything that happened overnight: service status, resource forecasts, incident summary, AI intelligence, and the day's priorities.

**Why Scriptorium:**

Code is the what. The Scriptorium is the *why* — a documentation portal where every village earns a page explaining what it does, how it connects, and what its failure modes look like. Standards are written before they are enforced. Every new app onboards against the Gekko Standard (§15) and earns its Scriptorium presence before it's considered complete.

The goal: a new team member can understand the full platform — every app, every integration, every agent — without asking anyone. That knowledge lives in the Scriptorium, not in someone's head.

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Health Checks Run</div>
    <div class="sr-value">10,800+</div>
    <div class="sr-sub">Automated checks across 9 services since monitoring began</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Royal Court Agents</div>
    <div class="sr-value">16</div>
    <div class="sr-sub">Each with a single narrow beat — observe, report, escalate</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Villages in Scriptorium</div>
    <div class="sr-value">4</div>
    <div class="sr-sub">Gekko Tracks · The Interceptor · AP Process · Bender</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Gekko Standard</div>
    <div class="sr-value">v1.4</div>
    <div class="sr-sub">The contract every village must meet — enforced by Master of Laws</div>
  </div>
</div>

</div>
