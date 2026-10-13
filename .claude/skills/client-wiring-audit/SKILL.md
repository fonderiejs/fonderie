---
name: client-wiring-audit
description: Use when auditing, building or fixing a React or React Native screen that reads or writes Fonderie data — members, invitations, roles/permissions, workspace profile, customers, billing, or any app resource behind a @fonderie hook. Covers whether the screen uses the package hook (not a hand-rolled fetch or a Redux copy), whether every action the UI offers is one the server allows, and whether loading / empty / error / confirmation / i18n / accessibility / workspace-switch states are handled. Triggers on "audit this screen", "is X properly wired", "why does this button 403", "screen shows stale data", "wire this screen to fonderie", or before declaring a client screen done.
---

# Client wiring audit

A screen is wired when three things agree: **what the server enforces**, **what
the hook exposes**, and **what the UI offers**. Most real defects are a
disagreement between two of them — a button the server refuses, a capability the
hook has that no screen reaches, a field the UI shows that is never saved.

Audit by reading the three layers side by side, never the UI alone.

## 1. Trace every action to its route

For each button, switch, swipe and form on the screen:

1. Find the hook method it calls, then the client method, then the route
   (`packages/<brick>/src/routes.ts`) and its middleware chain.
2. Write down the guard: `requireAuth`, `withWorkspace`, `requireManager`,
   `requirePermission(op, resource)`, or **none**.
3. Ask: who sees this control, and would the server accept it from them?

Record each mismatch:

| UI offers it to | Server allows | Defect |
|---|---|---|
| everyone | managers only | button that 403s — gate it (`useCan` / manager check) |
| everyone | everyone, but should not | missing server guard — fix the brick, not the UI |
| nobody (no UI) | route + hook exist | unreachable capability — note it, decide if the app needs it |

A UI gate is a courtesy; the server guard is the security. Never fix a missing
server guard by hiding a button.

## 2. One source of truth for reads

- Reads come from the package hook (`useScopedQuery`-backed), keyed by
  workspace. A Redux/Zustand copy of hook data, a `useEffect` + `fetch`, or an
  app-side re-declaration of the package's DTO types is drift waiting to happen —
  list each one with the hook that replaces it.
- Workspace switch: data from workspace A must never render in B. Check that
  every read is scoped and that in-memory form state (pickers, drafts) is reset
  or keyed by workspace.
- A detail screen should not mount a list query just to reach an action.

## 3. Writes: no silent outcomes

- Every mutation either shows its error or deliberately ignores it with a
  comment saying why. `catch {}` with nothing else is a finding.
- Destructive actions (delete, remove member, revoke, blacklist, cancel) confirm
  first and name the thing being destroyed.
- Multi-request writes (create parent then children) report which part failed,
  or the brick needs a single endpoint.
- Saving while the screen's data is still loading must be impossible (a form
  that shows defaults before the read lands can overwrite real data).

## 4. States

For the screen and each section: **loading** (skeleton or spinner, never
`null` — a blank screen reads as broken), **empty** (says what to do next),
**error** (retry), **not found / no access** (a removed member, a deleted
record, a wrong workspace must not spin forever), **offline** (cached data
shown with its age, writes blocked or queued — never silently lost).

## 5. Text and access

- Every visible string comes from the app's dictionary, in every locale the app
  ships, including alerts, chip values, enum labels and plurals.
- Icon-only controls have an accessibility label and role.
- Colors come from the theme; hard-coded hex breaks dark mode.

## 6. Package gaps

When the right fix is in a package (a missing guard, hook, field, route, or a
screen in `*-screens`), report it as a package finding with the file and line,
and check the same gap in the React, React Native **and** Vue packages — parity
is part of the fix. Then use `endpoint-to-clients` for route changes and
`shipping-fonderie` to release.

## Report format

One table per area, most severe first:

| # | Severity | Finding | Evidence (path:line) | Owner |
|---|---|---|---|---|

Severity: **blocker** (a core flow fails or data is lost / exposed),
**should-fix** (wrong but survivable), **nice**. Owner: package / app / app API.
State what you did not check (e.g. "read the code, did not run it").
