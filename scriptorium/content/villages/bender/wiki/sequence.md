# Sequence

A typical Bender call has five stages. The caller does not see most of them — they just hand over a script name and parameters and get JSON back.

## Stages

1. **Request arrives.** Caller hits Bender's API with `{ script, parameters, credential_profile }`.
2. **Session opens.** Bender starts (or reuses) a Pronto Xi session under the named credential profile. Sessions are per-profile, not per-request.
3. **Keystrokes play.** Bender executes the recorded keystroke sequence for the named script. Each script is a small file in Bender's script library — a sequence of key codes, with named pauses where Pronto needs to load.
4. **Result is read.** Bender screen-scrapes the relevant fields from Pronto's UI and parses them into structured values. Field positions are defined per-script.
5. **JSON returns.** Bender returns the structured result to the caller and releases its lock on the session (the session itself stays warm for the next call).

## Failure handling

- If Pronto shows an unexpected modal, Bender currently aborts and returns an error. Automatic dismissal of expected modals is on the roadmap.
- If the session has been killed externally, Bender re-establishes it transparently — the caller does not see the difference.

A sequence diagram of this flow will live in `demos/` once drawn.
