# Architecture: before → after (and the pillars that get us to the goal)

**Goal:** ship a SaaS with a *fraction* of the token cost — tokens spent
understanding **your** project, never re-understanding Fonderie — while the
output stays consistent in an LLM's non-deterministic world.

All numbers below are measured (`experiments/phase41-2026-07/`), not asserted.

---

## BEFORE — eager knowledge, loaded whether you use it or not

Every turn, the agent re-reads the *entire* Fonderie surface.

```
                          ┌─────────────────────────────────────────┐
                          │                 LLM                     │
                          │   reasons — but its context is already   │
                          │   full of Fonderie knowledge it may      │
                          │   never use this turn                    │
                          └───────────────────┬─────────────────────┘
                                              │ RESIDENT every turn
              ┌───────────────────────────────┴───────────────────────────────┐
              ▼                                                                 ▼
   ┌──────────────────────┐                                   ┌──────────────────────────┐
   │  FAT SKILL            │                                   │  MCP SERVER               │
   │  all 17 packages'     │                                   │  tool schemas advertised  │
   │  signatures, always   │                                   │  at start, resident       │
   │  loaded               │                                   │  (GitHub-style servers:   │
   │  ≈ 28,000 tok/turn     │                                   │   80 tools ≈ 55,000 tok)  │
   └──────────────────────┘                                   └──────────────────────────┘
        overhead vs scratch:  fat = 1.00  (the baseline waste)

   or the interim fix — a compiled PROJECT BRAIN (CLAUDE.md), still EAGER:
   every installed package's signatures, ≈ 6,000–13,000 tok resident/turn.
```

**Problem:** load scales with what the agent *might* do, not what it does. A
billing-only session still carries auth, teams, webhooks, audit — every turn.

---

## AFTER — the three-layer pyramid: load only what the task touches

```
                          ┌─────────────────────────────────────────┐
                          │                 LLM                     │  ← reasoning ONLY
                          │   the expensive layer, used only for     │
                          │   the one thing nothing else can do      │
                          └───────────────────┬─────────────────────┘
                                              │
              ┌───────────────────────────────┼───────────────────────────────┐
              ▼                                                                 ▼
   ┌────────────────────────────┐                        ┌──────────────────────────────┐
   │  SKILLS  (lazy guidance)    │                        │  CLI  (deterministic ops)     │
   │                             │                        │                              │
   │  SKILL.md ROUTER            │  reads a body          │  fonderie brain query <x>     │
   │  concept→body table +       │  ONLY when the task ───▶│  0 schema tax; output into   │
   │  invariants                 │  touches it            │  a pipe, grep/peek, then read │
   │  ≈ 1,400 tok RESIDENT        │                        │  proven: triggers 12/12       │
   │                             │                        └──────────────────────────────┘
   │  fonderie/billing.md  ◀─ lazy body, ~3k, read ONCE in the billing session, not resident
   │  fonderie/auth.md     ◀─ lazy body, read only in the auth session
   │  … (per package)                                                                   │
   └────────────────────────────┘
              │
              ▼  every layer sits ON TOP of the unchanged foundation:
   ┌──────────────────────────────────────────────────────────────────────────────────┐
   │  DETERMINISTIC MICRO-BACKEND BRICKS  — @fonderie/auth, billing, workspaces, …       │
   │  audited, version-matched, co-located knowledge in each tarball (R3).               │
   │  THIS is what makes a non-deterministic LLM produce CONSISTENT, secure output.      │
   └──────────────────────────────────────────────────────────────────────────────────┘

   resident/turn: ROUTER ≈ 1,400 tok  (vs eager brain 6,400 — measured on auth+billing)
   overhead vs fat baseline:  pb = 0.28  (already a fraction); pb-lazy target: lower still
```

**Win:** a single-capability session carries the router (~1.4k) + one body read
once — not all 17 packages every turn. Load scales with what the agent *does*.

---

## The pillars we are leveraging (each measured, each doing one job)

| # | Pillar | What it is | Why it moves the goal | Status |
| --- | --- | --- | --- | --- |
| 1 | **Deterministic micro-backend bricks** | audited `@fonderie/*` packages | makes a non-deterministic LLM ship *consistent, secure* code — scratch shipped an insecure secret 2/3, Fonderie 0/3, in ~⅓ the code | **shipped** (the product) |
| 2 | **Lazy skill layering** | router `SKILL.md` + per-package bodies, load-on-demand | resident knowledge drops ~6.4k → ~1.4k; load scales with the task, not the catalogue | **built** (`generate-skill.mjs`); pilot pending |
| 3 | **CLI for retrieval** | `fonderie brain query` — 0 schema tax, output into a pipe | deterministic, portable, triggers 12/12; verdict: **parity** with MCP, so it's a viable default, not a false economy | **built + N=3 verdict** |
| 4 | **Co-located version-matched knowledge** | each package ships its own `brain/` fragment in its tarball (the `.d.ts` pattern) | knowledge travels with the installed version — skew impossible by construction; feeds pillars 2 & 3 | **shipped to npm** |
| 5 | **Concept-enum routing** | 17 language-less concept IDs | the router table *is* the enum; maps naive/any-language intent → the one body to load | **shipped** (R2, 96/96 EN/FR/RO) |
| 6 | **Cross-vendor skill format** | name / description / body | one artifact reads in Claude Code, Codex, Copilot, Cursor — no server to keep alive | **format adopted**; install-matrix pending (Phase 3) |
| 7 | **Two-axis honesty** | measure tokens AND wall-clock | CLI trades latency for tokens (Playwright: MCP 90s vs CLI 3–10min); keep MCP for the stateful/long-running case | **discipline** (pre-registered) |

## The one-line difference

**Before:** *load everything Fonderie knows, every turn, in case you need it.*
**After:** *keep a tiny router resident; pull the one brick's knowledge in only
when the task reaches for it — over a CLI/skill that runs anywhere — on top of
audited bricks that keep the output consistent.*

Same knowledge. Same guarantees. A fraction of the resident tokens. The bricks
(pillar 1) never change — only *how their knowledge reaches the agent* does.
