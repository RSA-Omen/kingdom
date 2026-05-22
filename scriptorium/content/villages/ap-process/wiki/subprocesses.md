# Subprocesses

The pipeline closes most invoices mechanically. A handful require a human loop that branches off the main flow — usually because Finance can't decide alone whether to approve an invoice or how to code it. These are the subprocesses that wrap around the main pipeline.

## Send for review (clarification from a colleague)

Today, when Finance can't tell what an invoice is for, whether it's legitimate, or how it should be coded, they print it, scribble a note, and leave it on someone's desk. This subprocess is the digital version of that hand-off, with the conversation captured against the invoice forever.

The reviewer is whichever colleague is most likely to know:

- The person who probably ordered it — for *"what is this?"*
- A department head or project manager — for *"is this legit?"*
- A cost-centre owner — for *"how do I code it?"*

Finance assigns the invoice from the review inbox, writes the question as a note, and the assignee gets a notification (email, eventually Telegram). The reviewer opens the PDF, reads the note, and replies. The invoice flips back into Finance's queue with the answer visible inline, and the whole exchange stays attached as audit trail.

Three reply shapes are worth distinguishing — free-text comment, **approve / reject + reason**, and **structured GL + project + split %**. The third is the most valuable to make a first-class form rather than free text, because Finance can apply the suggestion with one click instead of re-typing.

Flow sketch: 2026-05-21 `internal-review-share` demo.

### Smallest useful first slice

Assignee + free-text thread + email notification + Approve/Reject/Comment buttons + audit log. No PDF annotation, no structured GL replies, no external reviewers. Covers ~80% of the current paper-and-desk workflow and is the right thing to ship first.

### Open questions before building

- **Internal-only or also external reviewers?** Contractor PMs would need magic-link email rather than full logins.
- **One reviewer or many?** Sequential approval chain vs. parallel "anyone can answer."
- **SLA?** Whether to nudge the assignee after 2 days and escalate after 5.
- **Scope creep:** the inbox + thread model is not AP-specific — once built, the same pattern could carry expense queries, PO approvals, vendor onboarding.

## Other subprocesses (not yet designed)

- **Supplier onboarding** — when the matcher returns no candidate, who decides whether a new supplier record should be created in Pronto and on what evidence.
- **Recurring-invoice approval** — when an invoice looks identical to a previously-approved one from the same supplier, can it skip review.
- **Dispute handling** — when Finance rejects an invoice, what the path back to the supplier looks like and where the correspondence lives.

These are placeholders. Each will get its own section here once it's designed.
