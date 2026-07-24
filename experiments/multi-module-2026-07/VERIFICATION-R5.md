# Round-five artifacts — verification note (errata)

_Separate from `DESIGN-R5.md` on purpose: that file is **pre-registered
(2026-07-17, before any run)** and must stay byte-for-byte immutable. Post-hoc
checks live here, never in the pre-registration._

## ✅ Verified 2026-07-24

Checked the round-five artifacts read correctly and are internally consistent:

- **`DESIGN-R5.md`** — coherent; its claims match `skeleton-b5`:
  - "outcomes docs in the skill" → **10** `signatures/*-outcomes.md` present.
  - "SKILL.md rules 5–6" (read outcomes; never download tarballs; dev SMTP sink)
    → present as exactly rules 5 and 6.
  - "skeleton-b5 = skeleton-b + current skill + fresh lockfile" → `package.json`
    is **byte-identical** to `skeleton-b`.
- **`skeleton-b5/` source** — `package.json` + `tsconfig.json` are valid JSON;
  `src/index.ts` is a well-formed express starter.
- **`.claude/` skill snapshot (30 files)** — complete: none empty, `SKILL.md`
  carries its frontmatter + 6 numbered rules, outcomes docs have real content
  (tables/routes/migrations). Tracked via `git add -f` (PR #92) past the
  `experiments/*/skeleton-*/.claude/` ignore rule, for reproducibility parity
  with `skeleton-b`.

## Clarified (not a defect)

`DESIGN-R5.md`'s "a fresh lockfile resolving the packages above (auth 1.3.0,
workspaces 1.2.0)" does **not** mean the skeleton pre-bundles them — the lockfile
pins only `@fonderie/core`, by design. The skeleton is a deliberately minimal
starter (identical to `skeleton-b`); the benchmark AI installs auth/workspaces
during the staged run, and the phrase describes what the run-time environment
resolves them to. No change to the pre-registration.
