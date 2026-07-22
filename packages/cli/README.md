# @fonderie/cli

Teach any coding agent the Fonderie SDK **without loading it eagerly.**

```
npx @fonderie/cli init         # set up the lazy skill + keep it fresh, once
npx @fonderie/cli query billing.subscriptions   # what to install for a capability
```

The old way loaded every package's signatures into the agent's context every
turn (~6–28k tokens). This writes a small **router** that stays resident and
**per-package bodies the agent reads only when a task touches them.** Measured on
a 3-condition, N=3 benchmark: **0.14× the knowledge overhead of the eager skill,
at equal completion and quality** (`experiments/phase41-2026-07/`).

## Commands

- **`fonderie init [--project <dir>]`** — run once: generates the lazy skill AND
  adds a `postinstall` (`fonderie skill`) so it **regenerates on every
  install/update**, staying version-matched to your lockfile. Idempotent; chains
  onto an existing postinstall rather than clobbering it.
- **`fonderie skill [--out <dir>] [--project <dir>]`** — write `SKILL.md` (the
  router: a capability→body table + security invariants) plus one
  `fonderie/<pkg>.md` body per **installed** `@fonderie/*` package. Point your
  agent at `.claude/skills`; bodies load on demand.
- **`fonderie query <concept>`** / **`--concepts`** — answer "what do I install
  for this capability": the package, the recipe, the wiring, and (if installed)
  the exact API. Zero resident schema tax — the agent runs it only when it needs
  discovery.

## How it stays correct

Each package ships its own `brain/` fragment **inside its tarball**, version-
matched to the code you installed. The CLI reads those from `node_modules`, so
the skill you get always matches your lockfile — no central registry to skew
against. Zero dependencies, no server, no build step: a binary and markdown that
run in Claude Code, Codex, Copilot, Cursor, or a plain shell.

MCP is still available (`@fonderie` brain server) for stateful, long-running
autonomous loops — the CLI trades a little wall-clock for a large token saving,
which is the right call for coding agents building a SaaS.
