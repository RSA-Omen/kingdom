# Bender

A keystroke-level automation harness for Pronto Xi. Bender turns Pronto's screens into a scriptable interface — other systems can ask Bender to do something in Pronto, and Bender drives the UI by sending the same keystrokes a human operator would. Results are captured by screen-scraping and returned as structured JSON.

Bender is **how the Kingdom talks to Pronto Xi** for everything beyond URL routing (which is [[the-interceptor]]'s job).

## Why a keystroke harness instead of an API

Pronto does not expose the operations the Kingdom needs through a public API at a useful granularity. Bender exists because the UI is the only stable surface area. The cost of this design is that every script is fragile against UI changes; the benefit is that anything an operator can do, Bender can do.

## Who uses Bender today

- **[[ap-process]]** — for reading the supplier master and (in future) posting AP entries.
- Other villages register their needs by writing new Bender scripts.

See [[bender/sequence]] for how a typical call flows and [[bender/capabilities]] for what Bender can and can't do today.
