# Releasing & cross-dependencies

How versions are cut, how packages publish to npm, and why changing one
small package can bump fourteen others. Read the cascade section before your
first release — it will surprise you otherwise.

## The tools

- **Changesets** (`@changesets/cli`) decides version bumps and writes
  changelogs. Config is `.changeset/config.json`.
- **GitHub Actions** (`.github/workflows/release.yml`) automates publishing.
- **npm scope** today is `@fonderie` — a **pre-launch test scope**. The
  product ships as `@fonderiejs` at `1.0.0` later, and only once a real app
  runs on the SDK. Do not spend the `@fonderiejs` name early.

## The normal flow

### 1. Add a changeset with your PR

```sh
npm run changeset
```

Pick the affected packages and a bump level (`patch`/`minor`/`major`), and
write a human sentence about what changed. Commit the generated
`.changeset/*.md` file alongside your code. One changeset per logical change.

Bump levels follow semver **with one pre-1.0 twist**: for a `0.x` package, a
`minor` bump is a breaking change (that's semver's rule below 1.0). This is
the root of the cascade below.

### 2. Merge to main → the release bot opens a "Version Packages" PR

`release.yml` runs on every push to `main`. When changesets are pending it
opens (or updates) a PR titled **"Version Packages"** that:

- applies every queued changeset (bumping `package.json` versions),
- rewrites `CHANGELOG.md` files,
- runs `npm run version` (which also regenerates the brain — see [BRAIN.md](BRAIN.md)),
- deletes the consumed `.changeset/*.md` files.

Review that PR like any other. It's the single source of truth for what the
next publish will do.

### 3. Merge "Version Packages" → it publishes to npm

Merging that PR triggers `npm run release` (`build` + `changeset publish`).
Every bumped package is published with the `latest` dist-tag.

### 4. Verify

```sh
npm view @fonderie/<pkg> version           # what published
npm view @fonderie/<pkg> dist-tags         # latest points where you expect
```

## The cross-dependency cascade — the part that surprises

Every brick **peer-depends** on `@fonderie/core` and `@fonderie/store`:

```jsonc
// packages/courier/package.json
"peerDependencies": {
  "@fonderie/core":  "^0.3.0",   // means >=0.3.0 <0.4.0
  "@fonderie/store": "^0.1.1"    // means >=0.1.1 <0.2.0
}
```

Now combine three facts:

1. `core`/`store` are `0.x`, so a **minor** bump on them is *breaking*.
2. A caret range on a `0.x` version (`^0.3.0`) only allows patch bumps —
   `0.4.0` falls **out of range**.
3. `.changeset/config.json` sets
   `onlyUpdatePeerDependentsWhenOutOfRange: true`.

So the moment a changeset bumps `core` `0.3 → 0.4` (or `store` `0.1 → 0.2`),
every one of the fourteen peer-dependents is now out of range and must
**major-bump** to widen its peer range. That is exactly why the last release
took the bricks `3.0.0 → 4.0.0` even though no brick changeset said "major".

**This is honest semver, not a bug.** It is the price of the bricks caret-
depending on pre-1.0 foundations. Two consequences:

- Expect a whole-SDK major cascade on any `core`/`store` minor. Don't fight
  it per-release.
- It ends when `core` and `store` graduate to `1.0.0` (then their *minors*
  stop being breaking, and bricks bump only minor). That graduation is
  deliberately deferred until a real client app has run on the SDK — the
  same gate as the `@fonderiejs` rename. When it happens, do it as **one**
  coherent event: `core`/`store` → `1.0.0`, bricks' peer ranges pinned to
  `^1.0.0`, and (if chosen) the scope cutover — all together.

### Reading the plan before you publish

```sh
npx changeset status     # shows exactly which packages bump, and to what
```

If `status` shows majors you didn't expect, it's almost always the cascade
above — trace it to a `core`/`store` bump, don't paper over it.

## Deprecating a bad publish

If a broken version reaches npm, deprecate **only** the specific broken
versions (never the package):

```sh
npm deprecate @fonderie/<pkg>@<bad-version> "Broken: <reason>. Use <good-version>."
```

Verify the warning shows on install before considering it done.

## Checklist

- [ ] Changeset committed with the PR, correct packages + levels
- [ ] `npx changeset status` reviewed — no surprise majors
- [ ] Freshness gates pass (`docs:signatures && docs:brain`, then no git diff)
- [ ] "Version Packages" PR reviewed before merge
- [ ] After publish: `npm view` confirms versions + `latest` dist-tags
- [ ] Commit has no `Co-Authored-By` trailer
