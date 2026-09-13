---
'@fonderie/react-auth': patch
'@fonderie/vue-auth': patch
---

Actually export `useAuthProviders`. It shipped defined but unreachable.

Both packages export from an **explicit list** in `src/index.ts`, so adding the hook to `src/hooks/` and `src/composables/` was not enough: the code was bundled into `index.js` and absent from the package's runtime exports *and* its `.d.ts`. `require('@fonderie/react-auth').useAuthProviders` was `undefined`, and a TypeScript import did not compile. The same was true of vue-auth.

It looked shipped from every angle that does not actually import it — the version bumped, the file existed, the symbol appeared in `dist/index.js`, and `check:hook-parity` passed because that gate compared packages to each other and never asked whether *any* of them exported it.

`check:hook-parity` now also asserts that every hook is exported from its own package's public entry, which fails on exactly this. Only `react-native-auth` was unaffected, because that is the one package where the export list was edited.
