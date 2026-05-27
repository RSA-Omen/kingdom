# Status & Metrics Report

A plain-English breakdown of the custom tools we have built — what they do, who uses them, and the time they save. Numbers drawn directly from live databases. Last updated **May 2026**.

---

<style>
.sr-section { margin: 32px 0 0; padding-top: 28px; border-top: 1px solid var(--divider, #1a1d2e); }
.sr-section h2 { margin: 0 0 6px !important; }
.sr-tagline { color: var(--text-muted, #8892b0); font-size: 13px; margin: 0 0 20px; line-height: 1.5; }
.sr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 16px 0 20px; }
.sr-card { background: var(--bg-elev-1, #0d0d1a); border: 1px solid var(--border, #1e2235); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.sr-card .sr-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint, #4a5070); }
.sr-card .sr-value { font-size: 24px; font-weight: 700; color: var(--teal, #81e6d9); letter-spacing: -0.03em; line-height: 1.15; }
.sr-card .sr-sub { font-size: 11.5px; color: var(--text-dim, #6b7394); line-height: 1.4; margin-top: 2px; }
.sr-savings-total { display: flex; align-items: center; gap: 14px; background: rgba(129,230,217,0.06); border: 1px solid rgba(129,230,217,0.18); border-radius: 10px; padding: 14px 18px; margin: 20px 0; }
.sr-savings-total .st-hrs { font-size: 32px; font-weight: 700; color: var(--teal, #81e6d9); letter-spacing: -0.04em; flex-shrink: 0; }
.sr-savings-total .st-desc { font-size: 13px; color: var(--text-muted, #8892b0); line-height: 1.5; }
.sr-savings-total .st-desc strong { color: var(--text-strong, #e8eaf6); }
.sr-breakdown { margin: 14px 0; }
.sr-breakdown table { width: 100%; border-collapse: collapse; }
.sr-breakdown th { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint, #4a5070); padding: 0 0 8px; text-align: left; border-bottom: 1px solid var(--border, #1e2235); }
.sr-breakdown td { padding: 9px 0; font-size: 13px; color: var(--text, #c8cde8); border-bottom: 1px solid var(--divider, #1a1d2e); vertical-align: top; line-height: 1.45; }
.sr-breakdown td:last-child { text-align: right; color: var(--teal, #81e6d9); font-weight: 600; white-space: nowrap; }
.sr-breakdown td:first-child { color: var(--text-muted, #8892b0); }
.sr-gap-note { display: flex; align-items: flex-start; gap: 10px; background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.2); border-radius: 8px; padding: 10px 14px; color: #f59e0b; font-size: 13px; margin: 12px 0 16px; line-height: 1.5; }
.sr-status-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.sr-status-chip.live { background: rgba(52,211,153,0.12); color: #34d399; }
.sr-status-chip.testing { background: rgba(251,191,36,0.12); color: #f59e0b; }
.sr-reliability-note { display: flex; align-items: flex-start; gap: 10px; background: rgba(129,230,217,0.04); border: 1px solid rgba(129,230,217,0.12); border-radius: 8px; padding: 10px 14px; color: var(--text-muted, #8892b0); font-size: 13px; margin: 12px 0; line-height: 1.5; }
.sr-reliability-note strong { color: var(--text-strong, #e8eaf6); }
</style>

<div class="sr-section">

## Gekko Tracks — Expense Coding <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">Every month, staff with company credit cards code their transactions — what they spent, on what project, for what purpose — then their manager reviews and approves, and Finance exports the data into Pronto. Gekko Tracks replaced a manual spreadsheet-based process with a purpose-built online tool that each cardholder uses from their phone or computer.</p>

Two monthly cycles have completed. The April 2026 cycle was the first full end-to-end run with the full cardholder group.

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Completed Cycles</div>
    <div class="sr-value">2</div>
    <div class="sr-sub">Feb and Apr 2026 — May currently in progress</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Cardholders (Apr cycle)</div>
    <div class="sr-value">27</div>
    <div class="sr-sub">Coded their transactions online — each saved ~45 min vs. the old method</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Manager Approvals</div>
    <div class="sr-value">9</div>
    <div class="sr-sub">Completed in the April cycle — each saved ~15 min of manual review</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Batch Uploads</div>
    <div class="sr-value">3</div>
    <div class="sr-sub">Monthly CSV imports (Feb, Apr, May) — each saves Louise ~30 min</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Pronto Exports</div>
    <div class="sr-value">1</div>
    <div class="sr-sub">Data pushed into Pronto — saves Louise ~1 hr vs. manual entry</div>
  </div>
</div>

**Time saved — April 2026 cycle breakdown:**

<div class="sr-breakdown">
<table>
<tr><th>Action</th><th>Count</th><th>Rate</th><th>Time Saved</th></tr>
<tr><td>Cardholders coding expenses online</td><td>27 people</td><td>45 min each</td><td>20.25 hrs</td></tr>
<tr><td>Manager approvals</td><td>9 approvals</td><td>15 min each</td><td>2.25 hrs</td></tr>
<tr><td>Batch upload (Louise)</td><td>3 uploads</td><td>30 min each</td><td>1.5 hrs</td></tr>
<tr><td>Pronto export (Louise)</td><td>1 export</td><td>60 min each</td><td>1.0 hr</td></tr>
</table>
</div>

<div class="sr-savings-total">
  <div class="st-hrs">~25 hrs</div>
  <div class="st-desc">saved in the April cycle alone. Across the two completed cycles the running total is estimated at <strong>~45 hours</strong> — and the May cycle is currently underway with 9 of 28 cardholders already submitted.</div>
</div>

Total transactions loaded across both cycles: **4,205** — covering Jan 2025 through May 2026, giving Finance a searchable, auditable record for the first time.

</div>

---

<div class="sr-section">

## The Interceptor — Pronto Document Links <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">Pronto displays links to files stored in our document system (NextCloud). Without this tool, clicking those links did nothing — staff had to navigate manually to the right folder. The Interceptor catches those clicks and redirects to exactly the right folder automatically.</p>

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Total Redirects</div>
    <div class="sr-value">337</div>
    <div class="sr-sub">Successful link resolutions since November 2025</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">May 2026 Alone</div>
    <div class="sr-value">194</div>
    <div class="sr-sub">Redirects in the most active month — 16 distinct staff members</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Staff Users</div>
    <div class="sr-value">16</div>
    <div class="sr-sub">Across Debtors and Purchase-Order workflows</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Time Saved</div>
    <div class="sr-value">~28 hrs</div>
    <div class="sr-sub">337 redirects × 5 min each — and growing fast</div>
  </div>
</div>

**Time saved breakdown:**

<div class="sr-breakdown">
<table>
<tr><th>Action</th><th>Count</th><th>Rate</th><th>Time Saved</th></tr>
<tr><td>Document link redirected to correct NextCloud folder</td><td>337 uses</td><td>5 min each</td><td>~28 hrs</td></tr>
</table>
</div>

<div class="sr-reliability-note">
  <strong>Beyond time savings:</strong>&nbsp; Before this tool, a broken link meant the document was either not found or staff navigated manually and sometimes landed in the wrong place. The Interceptor guarantees every link resolves correctly — no missed documents, no wrong-folder errors. This matters especially in the Purchase-Order workflow where finding the right supporting document quickly has a direct effect on how fast approvals happen.
</div>

Usage grew sharply in May (194 of the total 337 logged redirects). The usage logger did not capture events January–April 2026 — the tool was running throughout that period, so actual total use since launch is higher than 337.

</div>

---

<div class="sr-section">

## PDF Page Removal Tool <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">A simple tool that removes specified pages from a PDF — available as a web interface anyone can use in a browser, and as an API for automated use. Replaces a manual process that previously took Acrobat Pro or equivalent.</p>

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Uptime</div>
    <div class="sr-value">100%</div>
    <div class="sr-sub">Always-on — both web and API interfaces</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Time Saved per Use</div>
    <div class="sr-value">30 min</div>
    <div class="sr-sub">vs. manually editing or waiting for someone with Acrobat</div>
  </div>
</div>

<div class="sr-gap-note">
  ⚠ <strong>Usage count not tracked.</strong> The tool is live but does not currently log how many PDFs have been processed. We cannot give Barry a specific job count today. Two options: (1) estimate manually from memory — multiply by 30 min per job; (2) we add logging in one session and the number appears automatically from here on. Flagged for the next development cycle.
</div>

</div>

---

<div class="sr-section">

## Reception Voicemail Routing <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">An automated flow that picks up voicemails left on the reception line and routes them directly to the right person — without anyone needing to check a shared inbox and manually forward.</p>

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Typical Volume</div>
    <div class="sr-value">~2×/wk</div>
    <div class="sr-sub">~8 voicemails routed per month</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Time Saved per Route</div>
    <div class="sr-value">5 min</div>
    <div class="sr-sub">Roughly 40 min per month of admin time recaptured</div>
  </div>
</div>

<div class="sr-reliability-note">
  <strong>The main value is not the 5 minutes.</strong>&nbsp; It is that a voicemail left on the reception line can no longer go unnoticed. Before this flow, if nobody checked the shared inbox in time, the caller never got a response. Now every voicemail is delivered directly to the person it was intended for, every time.
</div>

</div>

---

<div class="sr-section">

## Bender — Automated Pronto Data Access <span class="sr-status-chip testing">⬡ In Testing</span>

<p class="sr-tagline">A way to get data into and out of Pronto automatically — without needing Pronto's API licence, which is separately licensed and expensive. Instead, Bender operates Pronto the same way a user would, navigating screens and entering data, but at machine speed and without errors.</p>

Bender is currently in its first testing cycle alongside the accounts payable process. It is not yet in production.

**Why this matters:** Any repetitive task that currently requires someone to log into Pronto and perform the same sequence of steps manually is a candidate for Bender automation. The AP supplier export — which is what is being tested now — would normally be done by hand each time it is needed. With Bender it runs on demand, unattended.

This is also an entirely new way of working with Pronto that does not depend on obtaining or waiting for a formal API integration. If there is a workflow in Pronto that is done repeatedly and takes meaningful time, we can script it.

</div>

---

<div class="sr-section">

## Internal Platform & Documentation System <span class="sr-status-chip live">● Live</span>

<p class="sr-tagline">The infrastructure that watches all of the above — and the system that keeps institutional knowledge written down rather than in people's heads.</p>

We have built an internal platform that runs continuously in the background, watching every tool and system we operate. Every five minutes it checks whether each tool is up and responding. If something fails repeatedly, it notifies automatically. Every morning it sends a consolidated briefing covering what happened overnight — uptime, resource usage, any issues that came up, and what's on the priority list for the day.

This exists so that:

- **We know immediately when something is wrong**, rather than finding out when a staff member raises a ticket.
- **The operator has a clear picture every morning** without manually checking anything.
- **Nothing that happens in these systems is invisible** — incidents are logged, approvals are tracked, resource usage is trending in a known direction.

Alongside the monitoring, we built a documentation portal — the site you are reading now. Every tool we build earns a page here explaining what it does, how it connects to everything else, and who uses it. The goal is that a new team member (or any manager) can understand the full picture without asking anyone. Standards for what every tool must do before it is considered complete are written down and enforced automatically.

This is not a product we will ever sell — it is the infrastructure that makes everything else more reliable and easier to manage as the portfolio grows.

<div class="sr-grid">
  <div class="sr-card">
    <div class="sr-label">Systems Monitored</div>
    <div class="sr-value">9</div>
    <div class="sr-sub">Checked every 5 minutes, 24/7</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Average Uptime</div>
    <div class="sr-value">99.7%</div>
    <div class="sr-sub">Across all monitored tools</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Automated Checks Run</div>
    <div class="sr-value">10,800+</div>
    <div class="sr-sub">Health checks completed since monitoring began</div>
  </div>
  <div class="sr-card">
    <div class="sr-label">Incidents Tracked</div>
    <div class="sr-value">61</div>
    <div class="sr-sub">Automatically detected, classified, and logged</div>
  </div>
</div>

</div>
