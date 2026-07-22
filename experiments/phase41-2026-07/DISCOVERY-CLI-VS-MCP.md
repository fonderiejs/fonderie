# Pre-registration: CLI vs MCP for brain discovery (2026-07-22)

> Locked before any data, per program discipline. Motivated by the CLI-vs-MCP
> tradeoff: MCP tool schemas sit resident every turn (our brain-serve tax = 752
> tokens/session, measured); a CLI command pays 0 resident and costs only when
> the model runs it. Our goal is minimum Fonderie-knowledge tokens with the
> brain still reliably used — so this is directly on the goal.

## The question

For **discovery** (the model learning about a not-yet-installed `@fonderie`
capability), is a **CLI command** cheaper *at equal triggering + quality* than
the **MCP tool**, once the resident schema tax is counted?

Not in scope: the resident project brain (`CLAUDE.md`) stays either way — it is
the version-matched knowledge for *installed* packages and pays no schema tax.
This is only about the discovery path for *uninstalled* capabilities.

## The two arms

- **`mcp` (current):** brain-serve advertises 3 tools (752 tok resident/turn);
  the model calls `brain_query(concept)`. Triggering helped by the tool
  description; results stream in as a tool result.
- **`cli`:** no MCP server mounted. The project brain's discovery pointer tells
  the model to run `npx fonderie brain query <concept>` (already implemented in
  `brain-query.mjs`) when it needs an uninstalled capability. 0 resident schema;
  the command's output is read like any shell output. Triggering leans on the
  PreToolUse hook (graphify mechanism) + the pointer text, not a tool schema.

Everything else identical: same growing-app workload, same model
(`claude-opus-4-8`), same DB, same completion gate.

## Metrics

1. **Resident Fonderie-knowledge tokens/turn** (`instrument.mjs`): `cli` should
   drop the 752-tok MCP tax to ~0; net saving ≈ 752 × turns per session where no
   discovery happens, less whatever the CLI invocation costs when it does.
2. **Triggering / completion** (R1): did the model actually run discovery when
   the task needed an uninstalled package? Measured by the same deterministic
   completion gate — `completed` / `recovered` per session. **This is the risk:**
   a CLI the model doesn't run is worse than an MCP tax it always pays.
3. **Quality:** the 39-point rubric, delegation-aware. Must not drop.

## Decision rule (locked)

- `cli` resident tax **< mcp** AND completion ≥ `mcp` AND quality within 1 point
  → **ship CLI discovery** as the default; drop the MCP server to an optional
  extra. The token goal is served with no reliability cost.
- `cli` completion **worse** than `mcp` (model skips discovery, stalls rise even
  with the hook) → **keep MCP**; the 752-tok tax buys triggering reliability,
  which the batch already showed matters (the 1/3 discovery stall).
- Mixed (cheaper but slightly less reliable) → keep MCP as default, document CLI
  as the low-token option for cost-sensitive users; do not silently switch.

## Cost & size

Cheap pilot first: `cli` vs `mcp`, sessions 1→3 (session 3 is the discovery
moment), ~$6. Only run the full N=3 if the pilot is promising. Aborts disclosed;
n=1 is directional, never a verdict — same discipline as Phase 4.1.

## Status

- [x] MCP tax measured (752 tok) and folded into `instrument.mjs`
- [ ] `cli` arm wired into `run-sequence.sh` (a `pb-cli` condition: no `.mcp.json`,
      discovery pointer names the CLI command)
- [ ] pilot (cli vs mcp, 1→3) → instrument + completion + quality
- [ ] decision per the locked rule

## pb-cli vs pb-lazy — full N=3 head-to-head (2026-07-22, $0 re-analysis)

Both conditions already ran N=3 (12 sessions each); re-scored on the current fair
instrument (resident-after-read, all-transport fetch). Canonical sequences only.

| condition | knowledge overhead vs fat (fair) | amortized floor | wall-clock | verdict |
| --- | --- | --- | --- | --- |
| fat (eager skill)     | 1.000 | 1.000 | 207s | baseline |
| pb (eager + MCP)      | 0.383 | 0.267 | 202s | parity-plus |
| **pb-cli** (eager + CLI) | **0.341** | 0.316 | 262s | **parity-plus** |
| **pb-lazy** (router)     | **0.141** | 0.053 | 301s | **FRACTION** |

**pb-lazy beats pb-cli ~2.4× on knowledge tokens (0.141 vs 0.341)** — and the gap
is the whole point of the CLI-vs-MCP thread. pb-cli only swapped the *discovery
transport* (MCP tool → CLI command) while still loading the **eager brain** every
turn; it lands at parity-plus, barely better than pb (0.383). pb-lazy changed
*when knowledge loads* (router + on-demand bodies) and is the only fraction. So:
**transport is a wash; lazy loading is the lever** — measured, head-to-head.

Two-axis honesty: pb-lazy is the slowest (301s vs pb-cli 262s, fat 207s) — more
on-demand reads, each a round trip. The token win costs latency, as expected;
fine for coding agents, which is why lazy shipped as the default and MCP stays
for latency-sensitive/long-running loops.
