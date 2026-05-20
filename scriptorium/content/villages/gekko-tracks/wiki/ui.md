# UI

Gekko Tracks is a React + TypeScript SPA backed by a FastAPI service. The same app serves four roles — the navigation and screen set shown depends on the user's Azure AD identity, and the **layout switches between desktop and mobile** based on viewport width.

The interaction shape on every screen: a **filtered table of transactions** at the centre, an **inline editing surface** for whatever the user is allowed to change, and a **status pill** showing where each row sits in the classification flow. Mobile collapses the table to a stacked card view.

## The main screens (desktop)

| Screen | Primary role | What it does |
|---|---|---|
| **Import** | Admin / Finance | Upload bank CSVs. Each upload becomes an `ImportJob` row with audit metadata. |
| **Ledger (Format 1)** | Admin / Finance | The raw bank ledger view — read-only inspection. |
| **Classify (Format 2)** | Cardholder | The cardholder works through their own unclassified rows: pick a Project, Cost Category, GL Account, and (optional) Description per transaction. ML pre-fills predictions where available. |
| **Approve (Format 2)** | Manager | The manager sees the classifications submitted by their assigned cardholders, with the ability to approve, reject, or edit before approving. |
| **Finance (Format 3)** | Admin / Finance | Once a batch is manager-approved, Finance adds the Pronto-export-only fields (Account, Reference, Tax fields, CBS, Tax Code) and generates the export. |
| **Exports** | Admin / Finance | History of `ExportBatch` rows — what was exported, when, what's still pending. |

A UI mockup of the Classify screen — the heart of the desktop flow — lives in `demos/`.

## Receipt screens

Receipts get their own surface area because the workflow is different from classification.

| Screen | Primary role | What it does |
|---|---|---|
| **Unified Receipts** | Cardholder | The cardholder's receipts inbox — uploads pending OCR, auto-matched receipts ready to confirm, and `manual_review` cases that need a transaction picked manually. |
| **Receipt Management** | Cardholder | Detail view of a single receipt — preview, OCR'd fields, candidate transactions with match scores, attach / reject / reassign actions. |
| **Admin Receipts** | Admin / Finance | All receipts across all cardholders. Used for cross-cardholder reassignment (when someone else used the card) and for spotting orphaned receipts. |

Receipts are uploaded through one shared component — `ReceiptUpload` — that accepts file picks on desktop and shows a "Take a photo" action on mobile that hits the device camera directly (HTML `capture="environment"`).

## The mobile interface

The cardholder's day-to-day work happens on the phone — that's where receipts are taken in the first place, and the same screen lets them classify on the move.

- A `useIsMobile()` hook flips the layout at ≤768 px viewport.
- The Cardholder Dashboard exposes three view modes via tabs: **Inbox**, **Ledger**, and **Receipts** — instead of the desktop's full table.
- Each transaction becomes a stacked card with the same inline editors, sized for thumb input.
- The "Take a photo" capture button on the Receipts tab opens the phone's camera directly; no native app needed.

A UI mockup of the mobile cardholder view lives in `demos/`.

## How the screens evolve a transaction

Each transaction starts in Format 1 (raw bank data) and is enriched as it passes through the screens above. The same row appears at different stages on different screens — never duplicated, just progressively annotated through the underlying database views. Once a receipt attaches to a transaction, the receipt thumbnail appears next to that row everywhere it's shown.

## ML predictions

When the Classify screen loads transactions for a cardholder, the backend calls the internal ML service (`POST /internal/ml/predict`) and stores the predictions in `MLPrediction`. Predictions show up in the UI as soft-fill values the cardholder can either accept (one click) or override.

The ML model is trained on historic Excel workbooks of approved classifications (`Historic Credit Card Employees Upload files/`).

## Auth and visibility

Every page checks the user's roles. Cardholders see only their own card's transactions and receipts. Managers see only the cardholders assigned to them via the `CardholderManager` join table. Admin / Finance see everything.

There is no local user table — identity comes entirely from Azure AD's `oid` claim.
