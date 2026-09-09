# Frontend Parity — React ↔ Vue ↔ React Native

Tracks divergence between the parallel frontend package families. The contract:
**every capability exposed to React (`@fonderie/react-*`) must exist, with
equivalent behaviour, in Vue (`@fonderie/vue-*`) and React Native
(`@fonderie/react-native-*`).** Because the three are hand-written in parallel
(no shared hook core — they wrap the same `@fonderie/client` sub-clients),
they drift whenever a feature lands in one family and not the others.

Last audited: 2026-09-08.

## How React Native inherits (or doesn't)

RN families split two ways:
- **Pure re-export** (`export * from '@fonderie/react-*'`): billing, audit,
  webhooks, customers, workspaces. These inherit React changes automatically —
  no parity risk.
- **Own implementation** (needs `AsyncStorage`): **auth**. `react-native-auth`
  has its own `hooks/`, so a new `react-auth` hook must be added here too.

So a new **auth** hook must be written **three times** (react/vue/react-native);
a new hook in a re-exported family, **twice** (react/vue).

## Two kinds of gap

1. **Missing export** — a hook exists in one family, not another. Caught by an
   export-name diff (see the audit command below).
2. **Behavioural drift** — same export name, different code (e.g. one generates
   an idempotency key, another doesn't). NOT caught by a name diff; needs review
   when touching a hook. This is the sneakier kind.

## Audit command

Run the full cross-check — every hooks family and every screens family, across
all three frameworks, with RN re-export detection:

```sh
node scripts/check-frontend-parity.mjs
```

It diffs the `use*` capability set (hooks/composables) and the `*Screen`
public exports of each `react-*` package against its `vue-*` and
`react-native-*` siblings. RN packages that are pure `export * from
'@fonderie/react-*'` are reported as inheriting (no drift possible); RN auth,
which has its own `AsyncStorage` hooks, is diffed like Vue.

## Full sweep result — 2026-09-08

Eight hooks families (auth, billing, workspaces, audit, webhooks, customers,
courier-admin, config-admin) and all eight screens families were cross-checked.

- **Hooks / composables: at parity everywhere.** The auth gap below
  (`useLoginHistory` + `useSessions`, previously react-only) is now closed in
  vue-auth and react-native-auth. Every family — including the wide billing (18
  hooks) and customers (9 hooks) surfaces — matches across all three frameworks.
  `node scripts/check-frontend-parity.mjs` exits 0.
- **Screens: at full parity, all eight families, all frameworks.** (Vue
  components carry an internal `Fonderie*Screen` name but export the same
  unprefixed screen names as React; React additionally exports `I*Screen`
  prop-type interfaces Vue/RN don't need — neither is a capability gap.)

## Resolved gaps

| Gap | Kind | Status |
|---|---|---|
| `useLoginHistory` (auth) | missing export | **FIXED** — added to vue-auth + react-native-auth mirroring react-auth (shipped react-only in #229) |
| `useSessions` (auth) | missing export | **FIXED** — same |
| `useCheckout` idempotency key | behavioural drift | **FIXED** in PR #234 — vue-billing's own `useCheckout` didn't send `idempotencyKey`; now mirrors react-billing |

No known export-level gaps remain. Behavioural parity beyond `useCheckout` has
not been exhaustively reviewed — see the caveat under "Two kinds of gap".

## Recommended: a CI gate

`scripts/check-frontend-parity.mjs` already does the diff; wiring it as a
`check:framework-parity` gate (alongside `check:hook-coverage` / `check:routes`)
that exits non-zero on any missing export would catch a future react-only hook
at PR time — which is how the two auth gaps above slipped in. It would NOT catch
behavioural drift — that stays a review-time concern (call it out whenever
editing a hook that has siblings).
