---
name: endpoint-to-clients
description: Use whenever you add, rename, or change a backend HTTP route in a @fonderie/* package — especially a public/unauthenticated one a login or marketing screen would call. Covers propagating it to @fonderie/client and the React, React Native, and Vue hook packages, and the pre-built screens. Triggers on "add a route", "new endpoint", "expose this to the frontend", "app.addRoute", "buildXRoutes", or when check:hook-coverage / check:routes fails.
---

# A route is not shipped until every client can call it

Adding a route to a package is the first of four or five steps. Stop after the
first and you have written something no application can reach — and this repo's
gates will say so, but only for part of it.

## The propagation path

```
packages/<brick>/src/routes.ts        ← the route
        ↓
packages/client/src/modules/<brick>.ts    ← typed method  (+ result type in types.ts)
        ↓
packages/react-<brick>/src/hooks/          ← hook
packages/react-native-<brick>/             ← hook OR a wholesale re-export
packages/vue-<brick>/src/composables/      ← composable
        ↓
packages/react-<brick>-screens/            ← only if a shipped screen should use it
```

Every step needs its export added to the package's `index.ts`. Adding the file
is not enough — several of these packages export from an explicit list.

## The two gates, and the hole between them

- **`check:routes`** — every client method resolves to a real server route.
  Catches a client calling something that does not exist.
- **`check:hook-coverage`** — two legs: every route is client-reachable, and
  every client method has a hook.

- **`check:hook-parity`** — every React hook is reachable from its React Native
  and Vue siblings, either through a wholesale re-export or its own copy.

The third gate exists because the second had a hole: hook-coverage searches
*all* hook files concatenated and asks whether the name appears **anywhere**, so
a hook in `react-auth` alone satisfied it. `useAuthProviders` shipped to
react-auth and vue-auth and was absent from react-native-auth — whose **version
still bumped** through a dependency change, so it looked current and was missing
the API. `check:hook-parity` now fails on exactly that.

## Re-export vs. own implementation

Which one a package does is per-package, and assuming is how the above happened:

- `react-native-billing`, `-workspaces`, `-audit`, `-webhooks`, `-customers`
  **re-export their React sibling wholesale** — nothing to do, they inherit.
- `react-native-auth` **defines its own hooks** (they persist tokens to
  AsyncStorage) and exports them from an explicit list — a new react-auth hook
  does **not** appear automatically.

Check the package's `index.ts` before assuming it inherits.

## Public routes deserve extra care

A public, unauthenticated route is one a login screen calls before anyone has
signed in. Two things follow:

- **Return the minimum.** Assert it in a test: configure the module with
  secrets and confirm the response body contains none of them.
- **Decide the failure posture.** A hook that answers "unknown" should degrade
  to the safe option, not the optimistic one. `useAuthProviders` starts EMPTY
  and falls back to empty on error: a moment with no social buttons is
  invisible, a button that appears and then dead-ends is not.

## Verify the published artifact, not the version

A version bump can come from a dependency change, so a current version number
is not evidence the API is present:

```bash
npm install @fonderie/<pkg>@<version>
grep -rl "<theSymbol>" node_modules/@fonderie/<pkg>/dist
```

Empty output means the symbol is not there, whatever the version says. See
`verify-honestly`.
