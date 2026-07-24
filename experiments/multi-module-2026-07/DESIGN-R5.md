# Round five — pre-registered design (2026-07-17, before any run)

Reruns the Fonderie condition of the multi-module protocol against the
fixes the round-four data forced. Everything not listed here is identical
to DESIGN.md: same four stage prompts verbatim, same fresh-headless-session
-per-stage runner, same disposable Postgres per sequence, same smoke flows,
same 20-point checklist, same truncation-disclosure rule, same model
(claude-fable-5) and machine.

## What changed since round four (the intervention under test)

1. **Outcomes docs in the skill** — generated `signatures/<pkg>-outcomes.md`
   (DB tables from migration replay, seeded rows, route tables with
   middleware chains) + SKILL.md rules 5–6 (read outcomes instead of dist/,
   never download tarballs, dev SMTP sink) + API.md behavioral contracts.
2. **workspaces 1.2.0** — bare invites default to the system GUEST role
   (1.1.1 fix); dead `defaultRole` config removed.
3. **auth 1.3.0** — session-bound access tokens: logout/rotation/password
   change revoke access immediately (round four's universal item-4 failure).

Condition skeleton: `skeleton-b5/` = round-four `skeleton-b` with the
current skill and a fresh lockfile resolving the packages above.

## Design deviation, stated up front

**Only the Fonderie condition reruns (3 sequences: c1, c2, c3).** The
scratch condition is unchanged by the intervention — nothing in it touches
the a-condition — so round four's scratch results (mean $11.78, 20/20 ×3,
n=3, same prompts/protocol/model/Claude Code version) serve as the
comparator. This halves cost but weakens strict pairing; acknowledged.

## Pre-registered outcomes

- **Win**: c-mean cost < $11.78 (beats scratch) AND scorecard 20/20 in all
  three sequences AND no Fonderie-only regressions.
- **Strong win** (the original phase-two bar): c-mean ≤ $8.84 (≥25% saving).
- **Loss**: anything else. Published either way, same as rounds one–four.

Kept spend only counts toward means; truncated attempts are disclosed in
results.csv and rerun from the pre-stage snapshot, never averaged.
