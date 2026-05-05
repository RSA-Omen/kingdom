# Update from the Kingdom — 5 May 2026

**TL;DR.** This morning we discovered the system that watches our apps was lying about whether they were healthy. The apps themselves (Gekko Tracks, PDF Removal, Interceptor) are fine. The watcher was broken. We've replaced it with a small team of automated helpers that investigate problems honestly, propose fixes, and double-check that fixes actually worked. The team runs every hour without anyone telling it to.

---

## A quick orientation

"The Kingdom" is the in-house platform we're building to keep an eye on every app Gekko runs — Gekko Tracks, the PDF page-removal tool, the email Interceptor, Reception Flow, and others. Its job is to know, every minute of every day, whether each of those is working, and to tell us early when something isn't.

Until today, that watcher was a bit like a security guard who sometimes nodded off but kept telling head office "all clear." We've started fixing that.

---

## What was wrong

Every morning a status briefing has been landing in the Director's Telegram — six separate messages from different parts of the system. Read together, they didn't agree:

- One section confidently said "all services healthy."
- Another listed two services as broken.
- A third had data that was six days old, and didn't admit it.

The worrying part wasn't the disagreement — it was the *confidence* of the wrong message. The piece labelled "all healthy" was the system's official summary. It looked authoritative. It also wasn't actually checking the data it was supposed to check, so when something really broke, the summary kept saying things were fine.

**Important point for the team:** the apps themselves have been working the whole time. We confirmed each one directly. Gekko Tracks is healthy and serving real user traffic. The Interceptor is up and configured. The PDF tool is processing requests. What was broken was the *reporting* about them.

---

## What we built today

A small council of automated helpers, each with one clearly defined job. They're modelled on roles a king's court might have — that's just a friendly mental picture, not anything mystical.

- **The Scout** investigates problems. When a new issue is filed, the Scout pulls up the relevant code, runs tests, and writes a clear note in plain English: what's actually wrong, why, how to fix it, and how sure it is. Today it investigated eight separate problems.
- **The Marshal** routes the work. After someone reads a Scout note and approves it, the Marshal decides which part of the system owns it, who should fix it, how urgent it is, and whether other issues need to land first.
- **The Smith** does the fix. Once a fix is authorised, the Smith opens a small, focused code change for review. It strictly applies what was recommended — no "while I'm here" extras that introduce new bugs.
- **The Inspector** verifies. After a fix is merged, the Inspector independently re-runs the original test to confirm the symptom is actually gone. If it's not, the issue reopens. No silent victories.

These four helpers run together, automatically, every hour.

---

## What this means in practice

- **When something breaks, we'll know quickly.** Within the hour, a written explanation will appear, in plain language, on our issue tracker.
- **Fixes will be smaller and easier to review.** Each one is a single focused change, not a sprawling rewrite.
- **No silent recoveries.** Every fix is independently re-verified before the issue closes. We've been burned by "looks fine to me" reports — those are gone.
- **Less morning Telegram noise.** The old six-message briefing has been turned off while we redesign it as one cleaner message.

The Director's role is now mostly approval, not babysitting: read the Scout's note, click "approved" if the diagnosis sounds right, click "ready-to-fix" when you want a fix attempted, review and merge the pull request. Three clicks per issue, spread across days.

---

## Where we are right now

In our issue tracker (github.com/RSA-Omen/kingdom/issues), as of this update:

- **8 problems** have been investigated and have written diagnoses
- **2** have been routed for action
- **1 fix** is sitting in a pull request awaiting review — a small but important correction to how the morning briefing gathers its data
- **6 new follow-up issues** were surfaced during this work (the Scout has a habit of finding related problems while investigating one — those get tracked rather than swept up in scope creep)

Nothing has been silently fixed and nothing has been silently broken. Every action above has a written trail you can read.

---

## How you can see progress without being a developer

Everything is in one place: **github.com/RSA-Omen/kingdom/issues**

You don't need to write code, and you don't need to read code, to follow what's happening. Each issue has a Scout note near the top of its comments, written in clear English: what's broken, why, what we plan to do about it. As issues progress, the labels on them change. Closed issues mean a fix has been verified.

If, in your day-to-day work, you notice something that feels off — a Gekko Tracks page slow to load, an email that didn't get intercepted, a PDF page that wasn't removed correctly, a Power Automate flow that seems silent — please tell us, or file an issue directly. The Scout will pick it up within the hour.

---

## What's next

- A redesigned morning summary, delivered as one clean message instead of six
- Reception Flow's status looked into — it has been silent for five months and that probably isn't right
- The Bureau's status display fixed so "error" shows as error, not "unknown"
- A single consolidated to-do list across the kingdom (currently the same to-do can live in four different places)

Steady progress. No surprises. No silent failures.

— *Update for the Subjects, 5 May 2026*
