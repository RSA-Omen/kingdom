# User journeys

Four people, four different journeys, one set of transactions evolving through them.

## Cardholder: classify my own card

The cardholder is the person who actually made the purchases. They know what each transaction was for.

1. **Sign in** with their corporate Azure AD account.
2. **Land on Classify**, the only screen they have full access to.
3. **See their unclassified rows** — pre-filled with the ML model's best guess where there's a high-confidence prediction.
4. **For each row:** accept the prediction (one click) or override Project / Cost Category / GL Account / Description.
5. **Submit the batch.** Status flips from `predicted` to `user_confirmed`. Their manager is notified the batch is ready to review.

The cardholder never sees Format 1 raw data or Format 3 Pronto fields — those aren't their concern.

## Manager: approve my team

The manager reviews the work their assigned cardholders submit.

1. **Sign in** as themselves.
2. **Land on Approve**, scoped to the cardholders linked to them in `CardholderManager`.
3. **See submitted batches** ordered by cardholder and date.
4. **Approve, reject, or edit** each row. Edits are tracked; rejections send the row back to the cardholder with a reason.
5. **Approve the batch.** Status flips from `user_confirmed` to `manager_approved`. The batch becomes visible to Finance.

The manager has read-only access to their team's Format 1 rows for context, but they don't classify themselves.

## Finance: export to Pronto

Finance closes the loop at month-end.

1. **Sign in** with Admin / Finance role.
2. **Open the Finance screen** — sees every manager-approved batch ready for finalisation.
3. **Add the Format-3-only fields** that cardholders and managers don't see: Account, Reference, Tax fields, CBS, Tax Code.
4. **Generate the export** — an `ExportBatch` row is created and a Pronto-shaped file is produced.
5. **Hand off to Pronto.** Today that hand-off is manual; the road map is to wire it through [[bender]] so the export drops straight into Pronto AP Entry under Finance's eyes.

## Admin: import a new month

Admin work bookends the cardholder-manager-finance cycle.

1. **Sign in** with Admin role.
2. **Open Import.**
3. **Upload the month's bank CSVs** (one per account or one combined file).
4. **Watch the `ImportJob`** progress and audit log — the system de-duplicates against prior imports.
5. **Confirm the new transactions** appear on each cardholder's Classify screen. The cycle starts again.

## The full cycle

```
Admin imports CSV
        ↓
Cardholder classifies (Format 2)
        ↓
Manager approves (Format 2)
        ↓
Finance enriches (Format 3)
        ↓
Pronto export ready
        ↓
[future] Bender posts into Pronto AP Entry
```

Every step is human-driven. The ML predictor speeds the cardholder up but never decides on their behalf.
