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
- **`fonderie env generate [--project <dir>]`** — write `.env.example` from the
  `env.json` every installed `@fonderie/*` brick ships (plus the app's own
  `fonderie.env.json`), and create or complete `.env`. It follows each brick's
  dependencies and required peers, so the list is exactly what your installed
  versions declare — never a table in this CLI.
  - `.env.example` is rewritten in full and deterministic, so diffs are real
    changes.
  - `.env` keeps every value already there. It generates the secrets that have
    a recipe (`crypto.randomBytes`), fills local defaults, carries a deprecated
    name's value over to the new name, and lists what only you can supply
    (Stripe keys, OAuth credentials).
  - It refuses to write `.env` in a git repository that does not ignore it.
  - `--example-only` skips `.env`.
  - `--check` exits 1 when `.env.example` is out of date, for CI.


### Config values

`fonderie config set KEY VALUE` infers the type the same way the admin UI does:
`{…}` and `[…]` are objects and lists, `true`/`false` are on/off, plain numbers
are numbers — and anything that only *looks* like a number (`1.10`, `0123`,
`1e3`, long IDs) stays text. `--text` stores an ambiguous value (`true`, `42`)
as text. Changing an existing key's type (on/off → text…) is refused (exit 2)
unless you pass `--allow-type-change`.

### Config, secrets and templates as files (export · diff · apply)

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
- **Scoped.** A file manages one environment: `metadata.environment`, or
  `--env <e>`. If both are given and disagree, the CLI refuses rather than pick
  one, so a prod export can't land on the shared `all` rows by accident.
- **Typos are errors.** An unknown field such as `descripton` is reported, not
  ignored.

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

Email templates use the same commands with `kind: "TemplateSet"` and one file
per locale (`metadata.locale`, or `--locale`; `null` is the default locale).
Long bodies live in their own files next to the manifest, so a copy change
reviews as a copy change:

```bash
fonderie template export --locale fr -o templates/fr.json   # writes fr.json + auth.welcome.fr.html …
fonderie template diff  -f templates/fr.json                # ~ auth.welcome: html changed (12 → 14 lines)
fonderie template apply -f templates/fr.json
```

```json
"auth.welcome": {
  "subject": "Bienvenue",
  "text": "Salut {{name}}",
  "htmlFrom": { "file": "auth.welcome.fr.html" }
}
```

Each entry is the whole template, the way the server stores it: an omitted
`subject` or `html` means none, and `"active": false` turns one off. Export to
stdout keeps everything inline; with `-o`, HTML and multi-line text go to files.

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
