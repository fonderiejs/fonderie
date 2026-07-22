# Decision: authoring a Fonderie app needs no database (onboarding)

## Question
To reduce onboarding friction we considered shipping a zero-config embedded
database (PGlite). Before building it: **do we need a database at all when an
agent writes/wires a Fonderie app, given the packages own the migrations?**

## Answer: no — the database is a *runtime* concern, not an *authoring* one
- Writing code, typechecking (`tsc` is static), and knowing the schema (shipped
  in each brick's `outcomes.md` / body) need **no** database.
- Booting and hitting routes need one — but those are runtime, and the bricks are
  **audited and own their schema**: migrations ship in the package and run on
  boot, routes are guaranteed by the package, not the app. So "is it wired
  correctly?" is a **typecheck**, and "does it behave at runtime?" is the brick's
  guarantee. Neither requires the agent to stand up Postgres.
- The add-pilot's ~11 turns of docker/Postgres wrangling were the agent
  *runtime-verifying something already statically guaranteed* — over-verification.

## Confirmation run ($0, no model) — the premise holds
Built a typecheck-clean, `basic-auth`-wired app (`fonderie add basic-auth` + the
one `mount` line), then verified "typecheck-clean ⇒ runs":

| step | result |
| --- | --- |
| `tsc --noEmit` | **exit 0** (clean) |
| boot against a real Postgres | **booted**; migrations auto-applied on boot |
| tables created | **10** `fonderie_*` tables (no hand-written SQL) |
| `GET /health` | 200 |
| `POST /auth/register` (AuthModule route, not hand-written) | **201**, real JWT access+refresh, user persisted |

So "**done = typecheck + wired**" is trustworthy: a clean typecheck plus recipe
wiring yields a running, migrating, route-serving app. The agent never needed a
database to author it; the DB was needed once, at the (separate, optional) run
step — done here centrally, not per session.

## Decision
1. **Definition of done = `tsc` clean + wired per recipe.** No database required
   to build. Encoded in the skill router (`fonderie skill` / `generate-skill.mjs`):
   do not provision a DB, do not boot to "check it works", read the brick's tables
   from its body. Confirmed-boot claim included so the instruction is credible.
2. **Onboarding metric = external prerequisites to *build* = 0** (achieved), kept
   distinct from prerequisites to *run* (a real `DATABASE_URL`, operator's step).
3. **PGlite is demoted** from "fix the onboarding cliff" to an *optional* "run/demo
   locally without a server" convenience — off the critical authoring path. Do not
   build it to remove build-time friction; that friction is now removed for free.

## Honest caveats
- This removes the **prerequisite** (no DB to build), which is the onboarding
  metric asked for — it does **not** cut turn count. We already measured that
  cutting DB friction doesn't reduce turns (the DB-hint control: docker cmds
  11→4, total turns flat at ~76 vs ~62, within the 61–81 baseline). The agent
  reallocates saved turns to other verification. "No DB to build" is an
  onboarding win, not an efficiency one — labelled as such.
- The confirmed-boot guarantee is for the wired recipe against a provided DB; a
  brick that needed a Postgres extension PGlite lacked would surface at that run
  step, not at authoring. Re-confirm per new recipe.
