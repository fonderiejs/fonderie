# Pilot findings — 2026-07-20 (directional, NOT the verdict)

A 2-condition pilot (`pb` + `fat`, sessions 1→2) to (a) validate the harness
end-to-end and (b) get an early read before the ~$50 full batch. Raw results in
`results/` (gitignored); scores in `SCORES.md`. **One sequence each — the
pre-registration is explicit that n=1 is directional, never a verdict.**

## Result

| session | turns | cost | tsc | quality | resident K |
| --- | --- | --- | --- | --- | --- |
| pb s1 (auth)    | 23 | $1.03 | ✓ | 12/12 | 1,547 |
| pb s2 (billing) | 39 | $1.85 | ✓ | 9/9   | 5,643 |
| fat s1 (auth)   | 67 | $2.29 | ✓ | 12/12 | 27,999 |
| fat s2 (billing)| 25 | $0.89 | ✓ | 9/9   | 27,999 |

- **`analyze.mjs` Method A: pb/fat overhead = 0.099** — pb's Fonderie-knowledge
  overhead is ~10% of fat's, ~3.4× under the ⅓ "fraction" threshold. Mechanism
  as predicted: pb carries only what's installed (1.5K→5.6K resident, grows with
  the app), fat carries the full ~28K skill every turn.
- **Equal quality** — both delegated correctly to the audited bricks
  (auth+billing wired, `requirePlan` gating premium server-side), both scored at
  ceiling. The cost win is not bought with worse code.
- **pb triggered the brain** — `brain_query` fired 4× (s1), 2× (s2). Readiness
  item #3 confirmed: pb uses the brain for discovery, doesn't improvise.
- Pilot cost ≈ **$6**.

## What this does and does NOT establish

Establishes: the harness works end-to-end (DB provisioning, K archival, quality
scoring, analysis, decision guardrails all functioned); the direction is
strongly toward "fraction."

Does NOT establish (why it's not a verdict):
- **n = 1 sequence** per condition — no variance estimate.
- **No `scratch` control** — Method B (empirical, `cache_read` minus scratch)
  could not run; Method A is uncross-checked.
- **Static-inspection scoring** — code read for correct wiring + `tsc`, apps not
  booted against Postgres.

## Bugs the pilot surfaced (all fixed)

- Harness died on forced Node color corrupting the pb `.mcp.json` (fix: PR #21).
- Published packages shipped migration loaders but not the `.sql` (fix: PR #22,
  republished; the fat session had to hand-write schema before the fix).

## Next

Full batch: **N = 3 × {fat, pb, scratch} × 4 sessions = 36 sessions** (~$50,
several login cycles), `./stage41.sh`, scoring each session with `score.mjs`,
then `node analyze.mjs` for the pre-registered decision (both methods must
agree). Run `scratch` early so Method B is available from session 1.
