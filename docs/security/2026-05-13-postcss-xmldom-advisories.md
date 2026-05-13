# Security advisory forensic report — 2026-05-13

**Status:** All advisories cleared. No evidence of compromise. Build-time-only exposure across all 10 findings.

---

## In plain English

The Bureau briefing this morning said **8 high / 6 medium / 14 total** security findings. Three things turned out to be true:

1. **The 14 was wrong.** The system had a counting bug that double-counted some findings. There were really **10 unique findings**, not 14.
2. **All 10 were real.** They were genuine published advisories against packages we had installed.
3. **None of them could have been used to compromise us.** Every single one lived in build tooling — code that runs on a developer's laptop or in a CI build, not in the running app a user talks to. To exploit any of them, an attacker would first need to hand us a malicious input (a poisoned CSS file, a poisoned plist XML) during a build. We don't accept those inputs from outsiders.

We fixed all of it. The briefing now reads **0 / 0 / 0**.

---

## Technical detail

### What we found and what we fixed

**Two bugs were intertwined:**

| | Where | What was wrong | Fix |
|---|---|---|---|
| Aggregator bug | `admin-center/backend/src/services/reports.ts` | Same vulns counted twice (once via `applications[]`, again via `projects[]`); daily-path projects loop used raw string match so `"moderate"` ≠ `"medium"`, masking half the duplication | Skip `projects[]` entries with `appName` set; use `normalizeSeverity` consistently |
| Real vulnerabilities | `admin-center/frontend` and `Operations/Gekko-Tracks/mobile` | 10 transitive deps below patched versions | `overrides` block in `package.json`; `@xmldom/xmldom` bumped 0.8.12 → 0.9.10, `postcss` bumped 8.4.31/8.4.49 → 8.5.14 |

**Commits:**
- `admin-center` `main` — `1ec74fd fix(reports): stop double-counting vulnerabilities`
- `admin-center` branch `fix/deps-postcss-override-2026-05-13` — `d8227b1 fix(deps): force postcss >=8.5.14`
- `Gekko-Tracks` branch `fix/mobile-deps-2026-05-13` — `6da7c96 fix(mobile/deps): override postcss and @xmldom/xmldom`

**Verification (live, post-fix):**
```
GET /api/reports/daily  → high: 0  medium: 0  low: 0  total: 0
GET /api/reports/weekly → high: 0  medium: 0          total: 0
```

---

### The 10 advisories — per-finding analysis

#### 1–4. `@xmldom/xmldom` ≤ 0.8.12 — four HIGH advisories

**Affected project:** Gekko-Tracks mobile (Expo / React Native app).
**Installed version:** 0.8.12 (now 0.9.10).
**Dependency path:**
```
expo@55.0.6
├── @expo/cli@55.0.16 → @expo/plist@0.5.2 → @xmldom/xmldom@0.8.12
└── @expo/config-plugins@55.0.7 → xcode@3.0.1 → simple-plist@1.3.1
                                              → plist@3.1.0 → @xmldom/xmldom@0.8.12
```

| ID | Vector | Plain-English |
|---|---|---|
| GHSA-2v35-w6hq-6mfw | Uncontrolled recursion during XML serialization → stack-overflow DoS | Hand it a deeply-nested XML doc, the parser crashes |
| GHSA-f6ww-3ggp-fr8h | XML injection through unvalidated DocumentType serialization | Crafted `<!DOCTYPE>` declarations smuggle nodes into output |
| GHSA-x6wf-f3px-wcqx | XML node injection via unvalidated processing instruction serialization | Same shape, different syntax (`<?...?>` payload) |
| GHSA-j759-j44w-7fr8 | XML node injection via unvalidated comment serialization | Same shape, comment payload |

**Where xmldom actually runs:**
- `@expo/plist` parses iOS `.plist` files during `expo prebuild` / native build.
- `simple-plist` / `plist` parse `.plist` files for `xcode.js` project manipulation during the same build phase.

**Could it have been triggered?**
- Plist XML files involved come from Expo's own templates and the project's `app.json` / `Info.plist` — author-controlled inputs.
- The vulnerable code path runs **only during native builds**, which happen on developer machines or CI. The compiled iOS/Android binary does not ship `xmldom`. End users never feed XML into this code.
- For exploitation we'd need an attacker to inject a malicious plist into a build, which means first compromising either the dev machine, the dep tree, or CI. None of those happened — `npm ls @xmldom/xmldom` after fix shows clean overridden tree; build logs show no anomalous plist parsing failures historically.

**Verdict: not triggered. Build-time-only exposure with no attacker-controllable input vector in our setup.**

---

#### 5–6. `postcss` < 8.5.10 in Admin Center frontend — MODERATE × 2

**Affected project:** Admin Center frontend (Next.js dashboard).
**Installed versions:** `next/node_modules/postcss@8.4.31`, top-level `postcss@8.5.12` (now 8.5.14 everywhere via override).
**Dependency path:**
```
next@16.2.6 → node_modules/next/node_modules/postcss@8.4.31  ← vulnerable
@tailwindcss/postcss@4.1.17 → postcss@8.5.12                  ← already safe
```
(Both reported as 1 vuln each — `postcss` itself and `next` flagged for depending on it.)

| ID | Vector | Plain-English |
|---|---|---|
| GHSA-qx2v-qp2m-jg93 | XSS via unescaped `</style>` in CSS Stringify output | If a literal `</style>` appears inside a CSS string being serialised, postcss writes it verbatim. Whoever can put CSS text into postcss's input can break out of the `<style>` tag in the rendered HTML and execute script. |

**Where postcss actually runs:**
- Next.js uses postcss in its CSS pipeline at **build time** (`next build`) to process `.css` and `.module.css` files into the output bundle.
- Admin Center frontend's CSS is authored by us, processed by Tailwind v4 + postcss during build, then served as a static asset. No CSS comes from users at runtime.

**Could it have been triggered?**
- Triggering requires an attacker to supply CSS text that postcss serialises. Our CSS comes from:
  - `tailwind.config.js` / Tailwind utility classes (Tailwind-generated)
  - `app/globals.css` and component CSS files (developer-authored)
- We do not run postcss against user-uploaded CSS, content-management input, or any external source.
- The vuln is **inert** for our deployment.

**Verdict: not triggered. No path from user input to postcss serialiser in production.**

---

#### 7–10. `postcss` < 8.5.10 nested inside Expo build pipeline — MODERATE × 4

**Affected project:** Gekko-Tracks mobile.
**Installed version:** `expo → @expo/metro-config → postcss@8.4.49` (now 8.5.14 via override).
**Dependency path:**
```
expo@55.0.6 → @expo/metro-config@55.0.9 → postcss@8.4.49
            → @expo/cli@55.0.16 → @expo/metro-config (same)
```
The same one vulnerable postcss copy gets reported four times because it surfaces via four parent advisories (`postcss`, `@expo/metro-config`, `@expo/cli`, `expo`).

| ID | Same advisory as #5–6 | GHSA-qx2v-qp2m-jg93 |
|---|---|---|

**Where postcss actually runs:**
- Metro is Expo's bundler. `@expo/metro-config` configures postcss to process web-CSS when running `expo start --web` or `expo export --platform web`.
- Inside the mobile native binary (iOS/Android), there is no postcss — React Native uses its own style system, not CSS.

**Could it have been triggered?**
- Same logic as #5–6: CSS comes from developer-authored sources in the repo. No path from user-controlled input into postcss's CSS-stringify code path.
- Even narrower than the frontend case — the mobile app's web export isn't deployed anywhere public.

**Verdict: not triggered. Inert for our build outputs.**

---

### Were we compromised? Indicators checked

| Check | Result |
|---|---|
| `npm ls @xmldom/xmldom` and `npm ls postcss` produce the expected tree, no unknown forks or namespaced impostors | ✓ clean |
| Recent build logs for `expo prebuild` / `next build` show no anomalous parse failures, crashes, or out-of-vocabulary plist/CSS warnings | ✓ no anomalies |
| Lockfile diffs since deps were last touched contain only expected version changes (no surprise version bumps from a poisoned registry mirror) | ✓ clean |
| `git log` on `mobile/package*.json` and `frontend/package*.json` — no unexpected actor or unattributed change | ✓ all changes match known authors / steward agent |
| Container images currently running: `admin-center-backend` is built from our `Dockerfile`, no suspicious base image swap, healthy 4 days | ✓ clean |
| Bureau briefing history shows the security count was 21 / 14 / 14 / 14 over the last week, consistent with the known cache content (no spikes suggesting active exploitation) | ✓ stable trend |

**No indicator of compromise observed.**

---

### Why the briefing was technically "wrong but defensible"

It is worth noting that even at its inflated count, the briefing was not *invented*. The aggregator was reading the real cache and the real findings — it was just counting each `@xmldom/xmldom` finding twice (once attached to the application, once free-standing in `projects[]`). The number 14 came from real data, not phantom data. That is why none of the per-app counts shown in the dashboard (Gekko-Tracks 4H/4M, Admin Center 0H/2M = 10) ever disagreed with reality — only the **totals** were inflated. The presentation bug was cosmetic, not security-substantive.

---

### Conclusion

**The Kingdom was not compromised.** All 10 advisories were real published vulnerabilities, but every single one lived in code paths that:

1. Run only during build (developer laptop or CI), never at runtime.
2. Process developer-authored inputs (our own CSS, our own plist templates), never user-supplied inputs.
3. Required attacker control over the build pipeline to exploit — which would itself constitute a more serious supply-chain compromise that no indicators support.

The system is now patched (overrides force safe versions across both projects), the aggregator no longer double-counts, and the daily briefing reads cleanly at 0 / 0 / 0.

The bigger lesson for future days: a non-zero security count in the briefing is worth investigating, but a *report-side* bug (double-counting) was easier to fall into than a *real* compromise. The aggregator fix is therefore the more valuable durable change to come out of today.

---

### Remediation timeline (UTC)

| Time | Event |
|---|---|
| 00:22 | Bureau daily briefing emitted "🔒 Security: ⚠️ High: 8, 📋 Medium: 6, • Total: 14" |
| ~00:30 | King asked to confirm count; investigation begins |
| 00:35 | Discrepancy localised: cache holds 10 unique findings, API reports 14 |
| 00:50 | Aggregator double-count bug identified in `reports.ts` |
| 01:01 | Source patched in `admin-center/backend` |
| 01:25 | Container rebuilt + restarted with new aggregator (`docker cp` + restart by king) |
| 01:25 | `/api/reports/daily` confirms `high: 4, medium: 6, total: 10` |
| 01:35 | `postcss` override added in Admin Center frontend; `npm audit` → 0 |
| 01:42 | `sudo chown` on Gekko-Tracks mobile `node_modules` by king |
| 01:43 | `postcss` + `@xmldom/xmldom` overrides applied in mobile; `npm audit` → 0 |
| 01:44 | Manual dependency cache refresh via `/api/reports/dependencies/refresh` |
| 01:45 | Briefing API confirmed at 0 / 0 / 0 |
