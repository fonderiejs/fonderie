// Co-located brain fragments (BRAIN_PLAN.md "R3 update"): each package ships
// its own knowledge INSIDE its tarball at <pkg>/brain/{signatures,outcomes}.md,
// generated at build. The project-brain compiler reads these straight from
// node_modules, so the knowledge is version-matched BY CONSTRUCTION — the
// fragment version is the installed code version, exactly the way `.d.ts`
// travels with the package. There is no central version registry to reconcile,
// so skew on the installed path is not detected-and-refused, it is impossible.
//
// The central `.claude/skills/fonderie/signatures/` dir stays as the authoring
// source (and the discovery brain's source, for packages NOT yet installed).
// It is only ever a *fallback* on the installed path, and a fallback is flagged
// loudly because it means we're serving latest against an unknown version — the
// one skew case co-location can't rule out, made visible instead of silent.

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const BRAIN_SUBDIR = 'brain';

export function fragmentPaths(pkgDir) {
  const dir = join(pkgDir, BRAIN_SUBDIR);
  return { dir, signatures: join(dir, 'signatures.md'), outcomes: join(dir, 'outcomes.md') };
}

// Write one kind of fragment into a package's brain/ dir. Called by the
// generators so the same bytes that land in the central authoring copy also
// ship co-located. Skipped silently when content is empty (e.g. a package with
// no routes has no outcomes fragment).
export function writeFragment(pkgDir, kind, content) {
  if (!content) return false;
  const p = fragmentPaths(pkgDir);
  mkdirSync(p.dir, { recursive: true });
  writeFileSync(p[kind], content.endsWith('\n') ? content : content + '\n');
  return true;
}

// Resolve an installed package's fragment for the project brain. Prefers the
// co-located copy (skew-proof); falls back to the central authoring copy with
// matched:false so the caller can flag it. `central` is { signatures, outcomes }
// absolute paths, or null when there is no central copy either.
export function resolveInstalledFragment(pkgDir, central) {
  const p = fragmentPaths(pkgDir);
  const read = (f) => (f && existsSync(f) ? readFileSync(f, 'utf8').trim() : null);
  const coSig = read(p.signatures);
  const coOc = read(p.outcomes);
  if (coSig || coOc) return { signatures: coSig, outcomes: coOc, matched: true, source: 'co-located' };
  return {
    signatures: read(central?.signatures),
    outcomes: read(central?.outcomes),
    matched: false,
    source: 'central-fallback',
  };
}
