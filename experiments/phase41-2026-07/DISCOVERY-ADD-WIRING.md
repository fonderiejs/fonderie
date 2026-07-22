# `fonderie add` — is deterministic wiring a turn-count lever? (pre-registered)

## Why
Lazy loading won the *knowledge-overhead* axis (0.14×), but Fonderie still takes
~1.7× the turns of a from-scratch build — a single build is only ~parity. The
hypothesis: the agent spends turns *reasoning through* install → migrate →
compose → mount for each brick, and a deterministic `fonderie add <recipe>` that
does that in ONE command would cut turns, possibly flipping single-build parity
into a raw-cost win.

## Mechanism (built + verified)
`fonderie add <recipe>` (packages/cli): resolves the recipe → module set, runs
`npm install`, emits `src/fonderie.ts` (version-matched composition on
`FonderieApp`, migrations on boot) matching the maintained `example-express`,
writes `.env.example`, prints the one app-specific line (`mount`).

Correctness gate: emitted wiring **typechecks against the real installed API**
(`tsc` exit 0). The gate caught a real bug on first build — `auth` was
constructed from `events.bus` before `events` existed; fixed via dependency
ordering (events before auth).

## Pre-registered gate
`add` wins only if it cuts the auth-session **turn count** below the pb-lazy
baseline range at equal completion (completed, tsc clean, auth delivered).
Publish whichever way it goes.

- Baseline (paid, n=3) — pb-lazy auth session: **67 / 61 / 81** turns (mean ~70).
- New condition: `pb-lazy-add` = pb-lazy + the `fonderie add` fast-path in the
  router + a shim putting the CLI on PATH. Same resident K (router only). Harness:
  `run-sequence.sh pb-lazy-add`.

## Result (n=1, directional)
| | turns | completed | tsc | loc | `fonderie add` runs |
|---|---|---|---|---|---|
| pb-lazy baseline (n=3) | 67 / 61 / 81 | ✓ | ✓ | 48–65 | — |
| **pb-lazy-add** | **62** | ✓ | ✓ | 47 | **1** (clean) |

`fonderie add basic-auth` ran **once**, cleanly (install + compose + migrate +
env). Yet total turns (62) landed **inside** the baseline range (61–81) — not
below it. **Fails the gate: no turn reduction.**

## Why it failed — the finding
The wiring was never the bottleneck. Transcript flow of the 62 turns:
- turns 1–5: orientation (read the skill, package.json, index.ts, the bodies)
- turn 6: `fonderie add basic-auth` (the deterministic part — ~1 command)
- turns 7–62: verify the emitted wiring, probe the adapter API for the mount,
  typecheck, JWT env, **write and test the app's own signup/login surface**

Automating the wiring collapsed ~3–5 turns of a ~62-turn session — within noise.
The ~1.7×-turns tax lives in **orientation + writing/testing the app's own
surface**, not the brick wiring.

## Decision
- **Do not scale to full N=3 (~$35).** The pilot answered the question for one
  session's cost: deterministic wiring is not the turn lever.
- **Keep `fonderie add` as a correctness/DX feature** (one command → version-
  matched wiring that compiles), not sold as an efficiency edge.
- **Next candidate for the turn axis** (if pursued): orientation + verification,
  e.g. a deterministic `fonderie verify` (pass/fail, kills self-testing turns) or
  tighter types so the agent stops probing the adapter API (turns 8–10 above).
  Same discipline — pre-register a gate, pilot before spending.
