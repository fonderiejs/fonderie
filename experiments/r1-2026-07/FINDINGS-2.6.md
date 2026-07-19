# Phase 2.6 — Retrieval Intervention: findings

**Outcome: the brain-first stub produced a large, consistent shift toward
retrieval-before-code. Point estimate Δ = +50 pts (pre-registered "strong"
band). Magnitude is uncertain (thin arm-A baseline); direction and rough size
are robust.**

Conditions: wiring-only R1a prompt, claude-opus-4-8, version-matched skeleton
(no skew confounder). Arm A (tool only) = Phase 2.5 baseline. Arm B (tool +
brain-first CLAUDE.md stub) = this milestone. Same scorer, same tasks.

## Primary result — effect size

| Metric | Value | 95% CI (Wilson) |
| --- | ---: | ---: |
| P(before-code \| tool)  — arm A, n=4  | 50% | 15%–85% |
| P(before-code \| stub)  — arm B, n=10 | 100% | 72%–100% |
| **Δ (stub − tool)** | **+50 pts** | point estimate |

Against the pre-registered bands (Δ<10 not meaningful; 20–30 prefer stub;
>40 strong), **+50 pts lands in "strong."** Absolute P(stub)=100% is itself
operationally sufficient, independent of Δ.

## Paired comparison (the honest one — same 4 tasks, both arms)

| Task | arm A (tool) | arm B (stub) |
| --- | --- | --- |
| auth-1 | before=true, first=Bash | before=true, first=ToolSearch |
| auth-2 | before=true, first=Bash | before=true, first=ToolSearch |
| billing-1 | **before=false**, first=Bash | before=true, first=ToolSearch |
| billing-2 | **before=false**, first=Bash | before=true, first=ToolSearch |

Paired: arm A 2/4 → arm B 4/4. **The stub fixed both billing misses — the exact
failure category from Phase 2.5.**

## The strongest signal — first-action flip

Across all 10 arm-B runs, **first action = ToolSearch in 10/10** (the model
discovers/loads the brain tool first), vs the Phase 2.5 baseline where first
action was local **Bash inspection in 6/7**. The stub didn't just raise the
eventual-retrieval rate — it **inverted the default instinct** from "explore
the code locally" to "find the knowledge tool first." That near-deterministic
behavioral change is more convincing than the marginal proportion CIs suggest.

Full arm-B breadth (all 10 tasks): 10/10 before_code, 10/10 succeeded, 10/10
first=ToolSearch, 1 wrong retrieval (webhooks). Categories covered: auth,
billing, workspaces, permissions, courier, webhooks, rate-limit, compound.

## Honest caveats

- **Arm A baseline is thin (n=4, auth+billing only)** with a wide CI (15–85%).
  The marginal CIs (arm-A upper 85% vs arm-B lower 72%) technically overlap, so
  at 95% we cannot claim clean statistical separation on the *proportions
  alone*. The paired evidence (2/2 billing misses fixed) and the 10/10
  first-action flip carry the conclusion, not the marginal CI.
- Arm B is 1 rep/task (n=10, no within-task variance estimate).
- All single-model (claude-opus-4-8), single environment.
- "ToolSearch" is Claude Code's tool-discovery step; the stub causes the model
  to resolve the brain tool before acting — this is the mechanism, and it is
  specific to MCP-tool-aware clients.

## Interpretation (per pre-registration)

A large positive Δ → **the lightweight stub is the valuable intervention; hooks
are not needed to achieve retrieval-before-code under these conditions.** The
stub is a ~4-line CLAUDE.md instruction — far cheaper than a PreToolUse hook or
lifecycle integration, and it drove before-code retrieval to 100% and flipped
first-action in every run.

This does **not** retire arm C (hooks). Hooks remain the deterministic
enforcement for clients without instruction-file support, and for adversarial
or untrusted contexts where a prompt instruction can be ignored. But for the
common case (an MCP-tool-aware assistant honoring project instructions), the
stub is sufficient.

## What this changes for Phase 3

- **Ship the brain-first stub as part of `init`'s per-assistant config** — it is
  the highest-leverage, lowest-cost integration and now has evidence behind it.
- Hooks become the *fallback* tier (hookless clients, untrusted contexts), not
  the default — inverting the Phase 2 assumption that hooks were the primary R1
  mechanism.
- Freshness (the Phase 2.5 behavioral-dependency finding) still gates all of
  this: the stub only works when the brain is trusted, which requires it to be
  version-matched.

## Not yet answered (future work)

- Multi-rep within-task variance (is 100% stable, or does it dip under
  paraphrase / harder tasks?).
- Other models (does the stub generalize beyond claude-opus-4-8?).
- Full-workflow R1b (does the before-code retrieval survive an actual build,
  packages installed, not just wiring?).
