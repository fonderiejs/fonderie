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
at equal completion and quality** (harness kept in our private research repository).

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
- **`fonderie add <recipe> [--project <dir>]`** — deterministically wire a
  capability in one command: `npm install` the recipe's bricks, emit a
  version-matched `src/fonderie.ts` composition (modules on `FonderieApp`,
  migrations on boot) matching the maintained `example-express`, and set up
  `.env.example`. Prints the one app-specific line (`mount`) it leaves to you.
  A **correctness/DX** convenience — the emitted wiring is verified to typecheck
  against the installed packages; it is *not* a token/turn saving (an
  auth-session pilot found the wiring isn't the turn bottleneck; the notes
  live in the private research repository).


### Config values

`fonderie config set KEY VALUE` infers the type the same way the admin UI does:
`{…}` and `[…]` are objects and lists, `true`/`false` are on/off, plain numbers
are numbers — and anything that only *looks* like a number (`1.10`, `0123`,
`1e3`, long IDs) stays text. `--text` stores an ambiguous value (`true`, `42`)
as text. Changing an existing key's type (on/off → text…) is refused (exit 2)
unless you pass `--allow-type-change`.

### Config and secrets as files (export · diff · apply)

Keep a deployment's remote config and secrets in a file, review changes in a
pull request, and apply them the way `kubectl` does:

```bash
fonderie config export -o config.json            # what the deployment holds now
fonderie config diff  -f config.json             # what apply would change; exit 1 if anything
fonderie config apply -f config.json --dry-run   # print the plan, write nothing
fonderie config apply -f config.json             # add and update; never deletes without --prune
fonderie config public                           # exactly what frontends receive
```

```json
{
  "apiVersion": "fonderie/v1",
  "kind": "ConfigSet",
  "metadata": { "environment": "all" },
  "entries": {
    "ENABLE_JOB_LISTING": { "value": true, "description": "Show the jobs tab" },
    "ALLOWED_MERCHANT_IDS": { "value": ["m1", "m2"] }
  }
}
```

- **Safe by default.** A key the file omits is kept unless you pass `--prune`.
  A type change is blocked, and nothing is applied, unless you pass
  `--allow-type-change`. Identical entries are skipped, so applying twice
  changes nothing.
- **No lost updates.** Each update carries the version read at plan time. If
  someone edited the key in between, the server refuses it and the CLI exits 2.
- **Scoped.** `--env <e>` manages that environment's rows only. Without it,
  the file manages the shared `all` rows.

Secrets use the same commands with `kind: "SecretSet"`. The file names where
each value comes from instead of holding it, so it can be committed:

```json
"STRIPE_SECRET_KEY": { "valueFrom": { "env": "STRIPE_SECRET_KEY" } }
```

- `fonderie secret export` writes these placeholders. `--reveal` writes the
  values instead, to a file with mode 0600, and warns you.
- `fonderie secret diff` and `apply` compare against the revealed values but
  never print one.
- `fonderie secret apply --from-env-file .env` loads a `.env` file directly.

The CLI finds the routes at `/admin/*` (the config brick's own token) or
`/_admin/*` (`@fonderie/admin`). Set `FONDERIE_ADMIN_PREFIX` if the admin
surface was moved.

## How it stays correct

Each package ships its own `brain/` fragment **inside its tarball**, version-
matched to the code you installed. The CLI reads those from `node_modules`, so
the skill you get always matches your lockfile — no central registry to skew
against. Zero dependencies, no server, no build step: a binary and markdown that
run in Claude Code, Codex, Copilot, Cursor, or a plain shell.

MCP is still available (`@fonderie` brain server) for stateful, long-running
autonomous loops — the CLI trades a little wall-clock for a large token saving,
which is the right call for coding agents building a SaaS.
