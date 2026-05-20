# UI

Gekko Tracks is a React + TypeScript SPA backed by a FastAPI service. The same app serves four roles — the navigation and screen set shown depends on the user's Azure AD identity.

The interaction shape is the same across every screen: a **filtered table of transactions** at the centre, an **inline editing surface** for whatever the user is allowed to change, and a **status pill** showing where each row sits in the classification flow.

## The main screens

| Screen | Primary role | What it does |
|---|---|---|
| **Import** | Admin / Finance | Upload bank CSVs. Each upload becomes an `ImportJob` row with audit metadata. |
| **Ledger (Format 1)** | Admin / Finance | The raw bank ledger view — read-only inspection. |
| **Classify (Format 2)** | Cardholder | The cardholder works through their own unclassified rows: pick a Project, Cost Category, GL Account, and (optional) Description per transaction. ML pre-fills predictions where available. |
| **Approve (Format 2)** | Manager | The manager sees the classifications submitted by their assigned cardholders, with the ability to approve, reject, or edit before approving. |
| **Finance (Format 3)** | Admin / Finance | Once a batch is manager-approved, Finance adds the Pronto-export-only fields (Account, Reference, Tax fields, CBS, Tax Code) and generates the export. |
| **Exports** | Admin / Finance | History of `ExportBatch` rows — what was exported, when, what's still pending. |

A UI mockup of the Classify screen — the heart of the app — lives in `demos/`.

## How the screens evolve a transaction

Each transaction starts in Format 1 (raw bank data) and is enriched as it passes through the screens above. The same row appears at different stages on different screens — never duplicated, just progressively annotated through the underlying database views.

## ML predictions

When the Classify screen loads transactions for a cardholder, the backend calls the internal ML service (`POST /internal/ml/predict`) and stores the predictions in `MLPrediction`. Predictions show up in the UI as soft-fill values the cardholder can either accept (one click) or override.

The ML model is trained on historic Excel workbooks of approved classifications (`Historic Credit Card Employees Upload files/`).

## Auth and visibility

Every page checks the user's roles. Cardholders see only their own card's transactions. Managers see only the cardholders assigned to them via the `CardholderManager` join table. Admin / Finance see everything.

There is no local user table — identity comes entirely from Azure AD's `oid` claim.
