# Integrations

The Interceptor sits between two systems and touches almost nothing.

## Inputs

| Source | What arrives |
|---|---|
| **Pronto Xi** | HTTP requests for URLs that Pronto has generated — most pass through, a specific subset is routed to NextCloud |

## Outputs

| Target | What goes |
|---|---|
| **NextCloud** | A redirect to the resolved document URL for matched requests |
| **Pronto Xi** | The original, unmodified request for non-matched URLs |

## What it does not touch

- No database. The Interceptor holds no state across requests.
- No event stream. It does not emit usage or telemetry beyond standard request logs.
- No interaction with [[bender]] — the two villages do unrelated jobs on the Pronto path.
