# Capabilities

What Bender can do today, and what it can't.

## Today

- **Open Pronto Xi screens** under named credential profiles. Each profile has its own session.
- **Execute pre-recorded keystroke sequences** — Bender's script library.
- **Capture screen output** and parse it into structured JSON values per script-defined field positions.
- **Export the supplier master** — a regular dump used by [[ap-process]] (3,184 suppliers in the most recent export).
- **Recover from killed sessions** by re-establishing them transparently to the caller.

## Not today

- **Anything Pronto cannot do via its UI.** Bender has no privileged access — if a human operator can't do it from a screen, Bender can't either.
- **Concurrent scripts in the same session.** A session executes one script at a time.
- **Automatic recovery from unexpected modal dialogs.** Bender aborts and returns an error; expected-modal dismissal is on the roadmap.
- **Bidirectional sync.** Bender is a request-response harness, not a continuous integration. Changes inside Pronto are not pushed out — callers pull.

## Boundaries

Bender does not own the data it surfaces. The source of truth for everything Bender reads is Pronto Xi. The source of truth for everything Bender writes (when it writes) is also Pronto Xi — Bender is just the conduit.
