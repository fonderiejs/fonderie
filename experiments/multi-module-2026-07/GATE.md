# P4 — pre-registered certainty gate: **NO-GO**

Evaluated 2026-07-17 against the gate in DESIGN.md, all 6 sequences complete.

## The gate (as pre-registered)

Fonderie must (1) win cumulative cost in all 3 pairs with a ≥25% mean
saving, (2) match or beat the scratch scorecard in all 3 pairs, and
(3) introduce no Fonderie-only regressions.

## Result

| Criterion | Outcome |
|---|---|
| Cost 3/3 wins, ≥25% saving | **FAIL — inverted.** Scratch won 3/3. Kept spend: a $16.61/$10.30/$8.44 (mean $11.78) vs b $30.49/$20.72/$27.67 (mean $26.29). Fonderie cost **2.2×** scratch, not 25% less. |
| Scorecard ≥ scratch 3/3 | **FAIL.** a: 20/20 × 3. b: 18/20, 19/20, 19/20. Every b sequence loses item 4 (access JWTs survive logout — @fonderie/auth design); b1 additionally lost 16 (bare invites granted ADMIN). |
| No Fonderie-only regressions | PASS. No stage broke an earlier stage's flow in either condition. |

Consequence per the pre-registration: **P5 (rewriting the article around a
confident cost-saving claim) does not happen on this data.**

## What the data actually says

- **Turns are the story.** b sequences averaged ~293 kept turns vs ~121 for
  a (a2-s1's turn count unavailable). DIAGNOSIS.md attributes the gap to
  package archaeology: agents excavating schemas, routes, and behavioral
  contracts from dist bundles because the skill doesn't surface them.
  Cache-read tokens scale with turns (b3-s4 alone re-read 5.7M tokens).
- **Variance is huge in the b condition.** b3-s1 cost $1.43 (cheapest
  stage-1 of the whole experiment, trusting the skill without archaeology);
  b3-s3 cost $9.07. The skill's value depends heavily on whether the agent
  trusts it.
- **The package's security posture dominated the scorecard.** All three b
  trees inherit the same logout gap; the invite-default trap produced three
  different app-level answers (ADMIN escalation / mandatory roleId / GUEST
  default). The experiment directly produced the workspaces 1.1.1 fix.
- **Session-limit tax (harness, not product):** 11 truncated attempts,
  ~$50 disclosed and discarded, all on subscription 5-hour windows.

## Honest headline for the article

Fonderie did not save tokens in this setting; it cost ~2.2× and scored
slightly lower — because the agent treats a compiled package as terrain to
excavate, while its own freshly written code is free to read. The fix list
(schema/route/contract signatures, generated at build time) is in
DIAGNOSIS.md, and the experiment paid for itself in a different currency:
it found and shipped a real privilege-escalation fix (workspaces 1.1.1),
and one of the three Fonderie agents independently converged on exactly
that fix.
