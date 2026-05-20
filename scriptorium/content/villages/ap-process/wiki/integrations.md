# Integrations

The AP Process pipeline reads from a small set of inputs and writes to a single target. Most of the surface area is the human review step in the middle.

## Inputs

| Source | What arrives | Notes |
|---|---|---|
| **Email inbox** | Invoice PDFs and docket attachments | Inbound channel; one email may contain multiple documents |
| **[[bender]]** | Pronto supplier master export | Used by the supplier-match stage; 3,184 suppliers in the recent export |
| **Claude (Anthropic API)** | Document extraction | Sends invoice content to Anthropic for parsing; see the Data Handling Notice demo for the formal scope |

## Outputs

| Target | What goes | Status |
|---|---|---|
| **Finance inbox (in-app)** | "Needs review" cases with candidate matches and reasons | Active; Finance approves or rejects |
| **Pronto Xi** (via [[bender]]) | AP entry posting | Pending — happens once Finance approves an invoice |
| **Status reports** | Pipeline state, daily benchmark on a real email | Published as demos on this village page |

## Sensitive data flow

Invoice content is sent to Anthropic for extraction. The data-handling scope and controls are documented in the **Data Handling Notice** demo on this page — formal memo to Barry & management.
