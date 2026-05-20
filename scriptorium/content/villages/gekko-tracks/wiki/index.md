# Gekko Tracks

A full-stack **Credit Card Coding (CCC)** system. Bank statements come in as CSV, transactions are classified against a chart of accounts by the people who actually spent the money, **receipts** are captured (often from a phone), matched to transactions, and the whole set is approved up the chain and exported to Pronto Xi at the end of the month.

It is the biggest village in the realm by code volume and the only one with a real user base across four distinct roles.

## What it does

Gekko Tracks turns this:

> a 200-row bank statement + a pile of paper receipts nobody wants to manually code or chase

into this:

> a Pronto-ready export with every line carrying the right project, GL account, cost category, and tax code — backed by the original receipt image, checked by the cardholder, approved by their manager, signed off by Finance.

## The three format views

The system progressively enriches transactions through three database views. Each view is exposed as its own API endpoint and its own screen, with role-based access.

| Format | What's in it | Who sees it |
|---|---|---|
| **Format 1 — Raw Bank Ledger** | Bank account, date, narrative, debit, credit, balance | Admin / Finance (imports + inspection) |
| **Format 2 — Classified Business View** | + Description, Project, Cost Category, GL Account, status | Cardholders (classify own), Managers (approve assigned) |
| **Format 3 — Finance / Pronto Export** | + Account, Reference, Tax fields, CBS, Tax Code | Admin / Finance only |

A transaction moves through these states: `unclassified` → `predicted` (ML) → `user_confirmed` (Cardholder) → `manager_approved` (Manager). Format 3 is only generated once Format 2 is approved.

## Receipts

Alongside the classification flow, **receipts** are a parallel system that runs from the moment a card is swiped to the moment Finance signs the batch off.

- **Captured on the phone or uploaded** — the mobile UI takes a photo directly using the back-facing camera; the desktop UI accepts JPEG, PNG, or PDF up to 10 MB.
- **OCR'd** — pytesseract / pdf2image extracts amounts, dates, and merchant tokens.
- **Auto-matched to transactions** — the matcher scores receipts against unmatched transactions using amount, date, merchant name, and line-item overlap; high-score matches attach automatically, low-score matches land in a manual-review queue.
- **Reassignable** — receipts can move between cardholders if a card was used for someone else's purchase.
- **Status tracked** — each receipt is `unassigned`, `processing`, `matched`, `manual_review`, or `error`, with `ReceiptMatch` rows recording score and which match was selected.
- **Line-level matching** — for itemised receipts, individual lines can match against classified transactions for stronger evidence.

Receipts attach to transactions; they don't replace classification. A row needs both a classification *and* an attached receipt before Finance is happy to export it.

## The four roles

| Role | What they do |
|---|---|
| **Admin / Finance** | Import bank CSVs, oversee everything, run Pronto exports |
| **Cardholder** | Classify the transactions on their own card; capture and attach receipts (typically from a phone) |
| **Manager** | Review and approve the classifications their assigned cardholders submit |
| **(ML predictor)** | Pre-fills suggested classifications based on history — not a person, but a participant |

## Where it fits in the kingdom

- **Inputs:** bank CSVs (manual upload today); historic Excel workbooks fed the ML training set; receipts from cardholders' phones.
- **Outputs:** Pronto-ready exports. The hand-off to [[bender]] (so Bender can drive Pronto AP Entry) is the next big piece.
- **Identity:** Azure AD via MSAL — no local user table.
- **Kingdom integration:** Admin Center endpoints (`/api/admincenter/health`, `/api/admincenter/usage`) feed dashboard tiles.

See [[gekko-tracks/ui]] for the screens (desktop and mobile) and [[gekko-tracks/journeys]] for the user flows.
