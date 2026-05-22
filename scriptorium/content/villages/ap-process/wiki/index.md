# AP Process

An autonomous pipeline from inbound invoice email to a posted AP entry in Pronto Xi, with Finance keeping the final approval. The pipeline does the mechanical work — unwrap, classify, extract, supplier-match — and surfaces the cases that need a human to a finance-facing inbox.

This is **active design work**. The pipeline is being built in stages, and the flow on this page will change as decisions land. Each meaningful iteration drops a fresh HTML demo into `demos/` so the design history stays browseable.

## The shape today

- **Input:** invoice PDFs arriving as email attachments, plus the docket emails that accompany them.
- **Output (eventually):** an AP entry posted into Pronto Xi via [[bender]].
- **Humans in the loop:** Finance reviews everything Bender posts before it's final.

See [[ap-process/flow]] for the pipeline stages, [[ap-process/subprocesses]] for the human loops that branch off it (manager comment, supplier onboarding, etc.), and [[ap-process/integrations]] for the systems involved.

## Where to read more

The full status reports live as demos on this page:

- **AP Processing — Status** — the current pipeline, what's working, what's pending.
- **Data Handling Notice** — the formal memo on data sent to Anthropic during processing.

Both were previously published to `/ap-processing/` on the reports server and are now pinned to this village.
