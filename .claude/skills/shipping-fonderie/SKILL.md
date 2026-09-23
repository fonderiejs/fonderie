---
name: shipping-fonderie
description: Use when changing anything under packages/ in the fonderie monorepo and taking it to npm — before opening a PR, when CI fails on a gate you did not run locally, when driving the changesets Version Packages PR, when waiting for a package to publish, or when bumping an example/app onto a freshly released version. Triggers on "open a PR", "run the gates", "release", "publish", "changeset", "Version Packages", "bump the dependency", "why did CI fail".
---

# Shipping a change in fonderie

Two things in this repo are easy to get wrong and cost a full CI cycle each
time: **the gates are more numerous than they look**, and **the release train
has a bot quirk that stalls silently**.

## 1. Run what CI runs — all of it

CI runs **fifteen** gates. Running `typecheck` and `test` locally passes about a
quarter of them. There is no composite script, so run them in CI's order:

**Never pipe a gate through `head`/`tail` inside an `&&` chain.** A pipeline
exits with the status of its LAST command, so `tail`'s 0 masks the gate's 1 and
the chain sails on — you get a "green" report for a gate that failed, and CI
tells you hours later. Run each one and check `$?`:

```bash
for g in lint:ci audit:ship typecheck audit:validation check:evidence \
         check:hook-coverage check:hook-parity check:routes \
         check:template-coverage brain:test brain:project-test; do
  npm run "$g" >/dev/null 2>&1 && echo "  PASS $g" || echo "  FAIL $g"
done
```

```bash
npm run lint:ci
npm run audit:ship
npm run build
npm run typecheck

# BOTH generated-doc gates. There are two, and they cover different files.
npm run docs:signatures && git diff --exit-code \
  .claude/skills/fonderie/SIGNATURES.md .claude/skills/fonderie/signatures 'packages/*/brain/*'
npm run docs:brain && git diff --exit-code \
  .claude/skills/fonderie/brain.json packages/cli/data/knowledge.json

npm run brain:test
npm run brain:project-test
npm run audit:validation
npm run check:evidence
npm run check:hook-coverage
npm run check:hook-parity
npm run check:routes
npm run check:template-coverage
npm test
```

**The two doc gates are the ones that bite.** `docs:signatures` regenerates the
per-package signature/outcome files; `docs:brain` regenerates `brain.json` and
`packages/cli/data/knowledge.json`. Running one and assuming it covered the
other is a wasted CI cycle — adding a single route changes a `routeCount` in
brain.json that signatures never touches.

Both gates are `git diff --exit-code` against generated output, so the fix is
always: run the generator, commit what it wrote.

## 2. Changeset or no release

A change under `packages/` without a changeset builds, passes, merges, and
**never ships**. Add `.changeset/<name>.md`:

```markdown
---
'@fonderie/thing': minor
---

What changed and WHY it mattered — the failure it prevents, not the diff.
```

`patch` for a fix, `minor` for new API. Changesets bumps dependents
automatically; do not hand-edit versions.

Examples and templates are not published — no changeset needed for them.

## 3. The release train, and its quirk

```
merge to main
   → Release workflow runs
   → opens/updates the "Version Packages" PR   ← the bot pushes it
   → merge that PR
   → Release workflow runs again and publishes to npm
```

**The quirk:** commits pushed by the changesets bot do not trigger CI. The
Version Packages PR sits with `action_required` forever, and merging is blocked
with no obvious cause. Push an empty commit to its branch:

```bash
git fetch upstream changeset-release/main
git checkout -B vp-trigger upstream/changeset-release/main
git commit --allow-empty -m "chore: trigger CI"
git push upstream HEAD:changeset-release/main
```

**And it can happen twice.** If another PR merges while the VP PR is open, the
bot regenerates it and the new head is `action_required` again. Check the head
SHA before assuming your trigger still applies.

## 4. Waiting for the publish — the part that lies

Do not poll for "the version changed". Do not read the expected version from a
file the release has not touched yet. Both pass instantly and prove nothing:

```bash
[ "$v" != "$old" ]                  # ✗ a leftover from an earlier release satisfies this
WANT=$(cat package.json version)    # ✗ read BEFORE the VP merge — compares the value to itself
```

Pull **after** the Version Packages PR merges, then wait for that exact value:

```bash
git pull --ff-only upstream main
WANT=$(node -e "console.log(require('./packages/thing/package.json').version)")
until [ "$(npm view @fonderie/thing version)" = "$WANT" ]; do sleep 25; done
```

npm's registry reads lag behind a publish by up to a few minutes, so a `404` or
a stale version immediately after the workflow succeeds is normal — keep
polling rather than concluding the publish failed.

## 5. Bumping a consumer

`npm install` resolves against the **installed tree**, so it will happily keep
an old version that still satisfies the range. After changing a dependency
range in an example or app:

```bash
rm -rf node_modules package-lock.json
npm install
node -e "console.log(require('./node_modules/@fonderie/thing/package.json').version)"
```

That last line is not ceremony. Confirm the version you meant is the version
you got, then run the app — see `verify-honestly` for why "it installed" is not
evidence that it works.
