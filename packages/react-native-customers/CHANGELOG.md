# @fonderie/react-native-customers

## 0.2.0

### Minor Changes

- 3991686: Customer addresses keep a city, a door/buzzer code and coordinates.
  
  An address picked from a places search arrives with a city and a point, and a
  customer address had nowhere to put either: the city was dropped, or apps
  stuffed it into `line2`. Addresses now take `city` (≤100), `accessCode`
  (≤20 — the door, buzzer or gate code; the suite or apartment stays `unit`),
  and `latitude` / `longitude` (decimal degrees, range-checked) on
  `POST /customers/:customerId/addresses`, and return them on every address read
  (`city` and `accessCode` are `''` when unset, the coordinates `null`).
  
  Migration `018_customer_address_city` adds four nullable columns to
  `fonderie_addresses` — additive; run it before this version serves (it reads
  and writes them), the previous version ignores them.
  Addresses written before it read back with the new fields empty. Nothing is
  backfilled: an app that stored the city in `line2` can move it to `city`.
  Two addresses that differ only by city are no longer duplicates.
  
  The React, React Native and Vue customers hooks re-export the client's address
  types, so `useCustomerAddresses().addAddress` takes the new fields as typed
  input and the returned addresses carry them.

### Patch Changes

- Updated dependencies [3991686]
  - @fonderie/client@3.23.0
  - @fonderie/react-customers@0.8.0

## 0.1.6

### Patch Changes

- Updated dependencies [a299875]
  - @fonderie/client@3.17.0
  - @fonderie/react-customers@0.7.0

## 0.1.5

### Patch Changes

- Updated dependencies [3f521bc]
  - @fonderie/client@3.9.0
  - @fonderie/react-customers@0.6.0

## 0.1.4

### Patch Changes

- Updated dependencies [90963c4]
  - @fonderie/client@3.4.0
  - @fonderie/react-customers@0.5.0

## 0.1.3

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/react-customers@0.4.3

## 0.1.2

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/react-customers@0.4.2

## 0.1.1

### Patch Changes

- 86dac61: README links pointed at `github.com/fonderiejs/sdk`, a repository that does not exist (404) — 271 occurrences across 61 packages, including every published README on npm. They now point at `github.com/fonderiejs/fonderie`, matching every package.json `repository` field. Eight READMEs (auth, workspaces, billing, courier, events, audit, webhooks, permissions) also showed `.register(new XModule())` with no arguments, which does not compile: every constructor requires at least the store. The samples now match the generated signatures and typecheck under strict.
- Updated dependencies [86dac61]
  - @fonderie/client@1.0.1
  - @fonderie/react-customers@0.4.1
