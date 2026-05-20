# Gekko Tracks

A full-stack **Credit Card Coding (CCC)** system. Bank statements come in as CSV, transactions are classified against a chart of accounts by the people who actually spent the money, managers approve the classifications, and Finance exports a Pronto-ready file at the end of the month.

It is the biggest village in the realm by code volume and the only one with a real user base across four distinct roles.

## What it does

Gekko Tracks turns this:

> a 200-row bank statement nobody wants to manually code

into this:

> a Pronto-ready export with every line carrying the right project, GL account, cost category, and tax code — checked by the cardholder, approved by their manager, signed off by Finance.

## The three format views

The system progressively enriches transactions through three database views. Each view is exposed as its own API endpoint and its own screen, with role-based access.

| Format | What's in it | Who sees it |
|---|---|---|
| **Format 1 — Raw Bank Ledger** | Bank account, date, narrative, debit, credit, balance | Admin / Finance (imports + inspection) |
| **Format 2 — Classified Business View** | + Description, Project, Cost Category, GL Account, status | Cardholders (classify own), Managers (approve assigned) |
| **Format 3 — Finance / Pronto Export** | + Account, Reference, Tax fields, CBS, Tax Code | Admin / Finance only |

A transaction moves through these states: `unclassified` → `predicted` (ML) → `user_confirmed` (Cardholder) → `manager_approved` (Manager). Format 3 is only generated once Format 2 is approved.

## The four roles

| Role | What they do |
|---|---|
| **Admin / Finance** | Import bank CSVs, oversee everything, run Pronto exports |
| **Cardholder** | Classify the transactions on their own card |
| **Manager** | Review and approve the classifications their assigned cardholders submit |
| **(ML predictor)** | Pre-fills suggested classifications based on history — not a person, but a participant |

## Where it fits in the kingdom

- **Inputs:** bank CSVs (manual upload today); historic Excel workbooks fed the ML training set.
- **Outputs:** Pronto-ready exports. The hand-off to [[bender]] (so Bender can drive Pronto AP Entry) is the next big piece.
- **Identity:** Azure AD via MSAL — no local user table.
- **Kingdom integration:** Admin Center endpoints (`/api/admincenter/health`, `/api/admincenter/usage`) feed dashboard tiles.

See [[gekko-tracks/ui]] for the screens and [[gekko-tracks/journeys]] for the user flows.
