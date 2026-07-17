# Why the Fonderie condition takes ~2× the turns (b1 vs a1, transcript analysis)

Analyzed 2026-07-16 from the kept transcripts of b1-s1 (77 turns, 75 tool
calls) and b1-s2 (94 turns, 92 tool calls) vs a1 stages (36–50 tool calls
each). Preliminary — b1-s3/s4 pending; update after they land.

## Headline

The scratch agent spends its tool calls almost entirely on its own code
(Read/Write/Edit/test). The Fonderie agent spends **~30–40% of its calls on
package archaeology**: digging facts out of `dist/` bundles and npm tarballs
because the skill doesn't surface them.

## Breakdown of the overhead (b1-s2, 92 calls)

| Category | Calls | What it looked like |
|---|---|---|
| Package archaeology | ~28 | `npm pack` of workspaces/permissions/billing tarballs into /tmp to read migration SQL; `grep dist/index.js` for `fonderie_*` table names, seeded roles, route lists (`addRoute(...)` patterns), zod schema shapes, `acceptInvitationByPin` behavior |
| Runtime behavior debugging | ~8 | chasing "Default role not found", seeded-role semantics via psql + dist grep |
| SMTP sink improvisation | ~6 | hunting a mail catcher, ended up writing a python smtpd |
| Actual app code + wiring | ~30 | normal |
| End-to-end verification | ~20 | normal (scratch does this too) |

b1-s1 same shape: calls 36–51 were migration/table-schema archaeology
(including downloading auth@1.0.0 tarballs to find `001_auth.sql`), plus
calls 13–17 probing `FSTemplateResolver` semantics by trial scripts.

## The scratch condition for contrast (a1-s2, 47 calls)

Calls 1–16: read its own stage-1 code. 17–35: Write/Edit new module code.
36–45: typecheck + end-to-end curl verification + two direct-DB checks.
**Zero archaeology** — every fact the agent needed was in files it wrote
itself in a prior stage. That's the structural asymmetry: the scratch
agent's "documentation" is its own legible source; the Fonderie agent's is
a compiled bundle it must excavate.

## Root cause

`API.md` documents *how to run* migrations (`getMigrationsPath()` +
`InternalMigrationRunner`) — the agent found that quickly. What no skill file
provides, and every stage needed:

1. **The resulting DB schema.** Table names + columns each package's
   migrations create. Agents need this to write their own queries, seed data,
   verify behavior, and debug. Today the only source is SQL files buried in
   the tarball (`dist/migrations/sql/*.sql`) — hence `npm pack` into /tmp.
2. **The route map.** Which endpoints each module registers (method + path +
   auth requirements). Needed to know what NOT to build and what to call in
   tests. Today: grep `addRoute` in the minified-ish dist bundle.
3. **Behavioral contracts.** Seeded system roles and their permissions,
   invitation accept/reject semantics, what config keys are read, what errors
   are thrown when ("Default role not found").

## Cost mechanics

The extra ~35 turns aren't just 35 tool round-trips — each turn re-reads the
whole resident context as cache-read. b1-s2 racked 5.0M cache-read tokens vs
a1-s2's 1.0M. Turns are the multiplier on everything; the per-package
signature split (P1) cut resident size but not turn count, and with 5+
packages in play the agent loads most signature files anyway.

## Fix candidates (product/skill work, ordered by expected impact)

1. **Ship `signatures/<pkg>-schema.md`** (or a section in each signatures
   file): tables + columns created by that package's migrations, generated
   from the SQL at build time by `scripts/generate-signatures.mjs`.
2. **Ship the route map** per package: method, path, auth/permission
   requirement, request/response DTO names. Also generated, not hand-written.
3. **Document behavioral contracts** for the handful the agent tripped on:
   seeded roles + default permissions, invitation flows, error strings.
4. (Smaller) SKILL.md note: "migration SQL ships in
   `node_modules/@fonderie/<pkg>/dist/migrations/sql/` — read it there, don't
   download tarballs"; and a dev-mode SMTP recommendation.

## Session-limit note (harness, not product)

4 of 10 stage attempts were truncated by the subscription's 5-hour session
window (~$25 of ~$57 spend wasted on discarded attempts). Long multi-stage
agent runs on subscription auth need either API-key billing or scheduling
runs at window boundaries.
