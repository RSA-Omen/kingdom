# Flow

Every invoice passes through five stages once it lands in the pipeline. The pipeline's job is to close as many cases as possible without a human, then surface the ones that genuinely need attention.

## The five stages

1. **Unwrap** — open the email, extract the invoice PDF and any docket attachments.
2. **Classify** — decide what kind of document each attachment is (invoice, docket, statement, other) so each is routed to the right handler.
3. **Extract** — pull line items, totals, supplier identifiers, dates from the invoice and (if present) the matching docket.
4. **Supplier-match** — match the extracted supplier identity against the Pronto supplier master. The master is exported by [[bender]] — most recent export has 3,184 suppliers.
5. **Review or post** — if the match is high-confidence and the values reconcile, the invoice is ready to post. Otherwise it surfaces in the Finance inbox with the candidate matches and the reason for review.

## Match quality (recent benchmark)

The two best invoice ↔ docket matches in the recent test ran at **99.2%** and **98.9%** confidence (iLASER and Elgas Limited). The matcher deliberately refuses to guess when confidence is low — Finance sees the candidates and decides.

## The four "needs review" cases

When the pipeline can't close an invoice automatically, it lands in one of four review buckets. Each bucket has a primary action surfaced inline.

The current categories are documented in the `2026-05-17` status demo. They will change as Finance gives feedback on what's actually useful to triage.

## Design principle

> The pipeline does the mechanical work. It does not — and should not — guess your AP policy.

A flow diagram of this pipeline is pending. Each iteration will live in `demos/`.
