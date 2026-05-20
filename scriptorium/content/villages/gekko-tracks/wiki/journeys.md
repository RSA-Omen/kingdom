# User journeys

Four people, four different journeys, one set of transactions evolving through them — plus a parallel **receipt journey** that runs from the moment a card is swiped.

## Cardholder: capture a receipt (mobile)

The cardholder is the person who actually made the purchase. The phone is the right place to deal with the receipt — it's where the receipt physically is, on a piece of paper or in an SMS.

1. **Open Gekko Tracks on the phone**, signed in with their corporate Azure AD account.
2. **Tap the Receipts tab** on the mobile cardholder view.
3. **Tap "Take a photo"** — the back-facing camera opens directly. Snap the receipt. (Or pick a file if it's already on the device.)
4. **Upload progress** runs in-app. Status starts at `unassigned`.
5. **OCR runs server-side** — pytesseract extracts amount, date, merchant tokens. Status flips to `processing`, then to `matched` (auto-attached to a transaction) or `manual_review` (needs the cardholder to pick).
6. **Confirm or pick.** If auto-matched, the cardholder taps "Looks right" to confirm. If `manual_review`, they see candidate transactions ranked by score and pick one.

The receipt is now bound to the transaction and travels with it through approval and export.

## Cardholder: classify my own card

The cardholder also has to classify what each transaction was for. Most of this happens on the phone too, often immediately after capturing the receipt.

1. **Open the Inbox or Ledger tab** of the mobile cardholder view (or sit at the desktop Classify screen).
2. **See their unclassified rows** — pre-filled with the ML model's best guess where there's a high-confidence prediction.
3. **For each row:** accept the prediction (one tap) or override Project / Cost Category / GL Account / Description.
4. **Submit the batch.** Status flips from `predicted` to `user_confirmed`. Their manager is notified the batch is ready to review.

Transactions with an attached receipt show a thumbnail in the row — visual confirmation the row has proof behind it.

## Manager: approve my team

The manager reviews the work their assigned cardholders submit.

1. **Sign in** as themselves.
2. **Land on Approve**, scoped to the cardholders linked to them in `CardholderManager`.
3. **See submitted batches** ordered by cardholder and date. Rows with attached receipts show a thumbnail; rows without are flagged so the manager can chase.
4. **Approve, reject, or edit** each row. Edits are tracked; rejections send the row back to the cardholder with a reason.
5. **Approve the batch.** Status flips from `user_confirmed` to `manager_approved`. The batch becomes visible to Finance.

The manager has read-only access to their team's Format 1 rows for context, but they don't classify themselves.

## Finance: export to Pronto

Finance closes the loop at month-end.

1. **Sign in** with Admin / Finance role.
2. **Open the Finance screen** — sees every manager-approved batch ready for finalisation, with each row's attached receipt visible inline as evidence.
3. **Add the Format-3-only fields** that cardholders and managers don't see: Account, Reference, Tax fields, CBS, Tax Code.
4. **Generate the export** — an `ExportBatch` row is created and a Pronto-shaped file is produced.
5. **Hand off to Pronto.** Today that hand-off is manual; the road map is to wire it through [[bender]] so the export drops straight into Pronto AP Entry under Finance's eyes.

## Admin: import a new month, deal with orphans

Admin work bookends the cardholder-manager-finance cycle.

1. **Sign in** with Admin role.
2. **Open Import.**
3. **Upload the month's bank CSVs.**
4. **Watch the `ImportJob`** progress and audit log — the system de-duplicates against prior imports.
5. **Open Admin Receipts** to spot orphans — receipts whose cardholder went on leave, or receipts that match a transaction on a different cardholder's card. Reassign as needed.

## The full cycle

```
Admin imports CSV ────────────────────────────────────────────────┐
                                                                  ▼
Cardholder takes photo (mobile) ──┐                    Cardholder classifies (Format 2)
                                  ▼                              │
                            OCR + auto-match                     │
                                  │                              │
                                  ▼                              ▼
                            Receipt attached ←─── ties to ──→ Manager approves (Format 2)
                                                                 │
                                                                 ▼
                                                       Finance enriches (Format 3)
                                                                 │
                                                                 ▼
                                                       Pronto export ready
                                                                 │
                                                                 ▼
                                              [future] [[bender]] posts into Pronto AP Entry
```

Every step is human-driven. The ML predictor speeds the cardholder up. The receipt-matcher attaches images automatically. Neither decides — every row still passes through human eyes before it leaves the system.
