---
'@fonderie/logger': patch
'@fonderie/react': patch
'@fonderie/react-admin': patch
'@fonderie/react-admin-screens': patch
'@fonderie/react-audit': patch
'@fonderie/react-audit-screens': patch
'@fonderie/react-auth': patch
'@fonderie/react-auth-screens': patch
'@fonderie/react-billing': patch
'@fonderie/react-billing-screens': patch
'@fonderie/react-config-admin': patch
'@fonderie/react-config-admin-screens': patch
'@fonderie/react-courier-admin': patch
'@fonderie/react-courier-admin-screens': patch
'@fonderie/react-customers': patch
'@fonderie/react-customers-screens': patch
'@fonderie/react-media': patch
'@fonderie/react-native-audit': patch
'@fonderie/react-native-audit-screens': patch
'@fonderie/react-native-auth': patch
'@fonderie/react-native-auth-screens': patch
'@fonderie/react-native-billing': patch
'@fonderie/react-native-billing-screens': patch
'@fonderie/react-native-customers': patch
'@fonderie/react-native-customers-screens': patch
'@fonderie/react-native-media': patch
'@fonderie/react-native-webhooks': patch
'@fonderie/react-native-webhooks-screens': patch
'@fonderie/react-native-workspaces': patch
'@fonderie/react-native-workspaces-screens': patch
'@fonderie/react-webhooks': patch
'@fonderie/react-webhooks-screens': patch
'@fonderie/react-workspaces': patch
'@fonderie/react-workspaces-screens': patch
'@fonderie/vue': patch
'@fonderie/vue-admin': patch
'@fonderie/vue-admin-screens': patch
'@fonderie/vue-audit': patch
'@fonderie/vue-audit-screens': patch
'@fonderie/vue-auth': patch
'@fonderie/vue-auth-screens': patch
'@fonderie/vue-billing': patch
'@fonderie/vue-billing-screens': patch
'@fonderie/vue-config-admin': patch
'@fonderie/vue-config-admin-screens': patch
'@fonderie/vue-courier-admin': patch
'@fonderie/vue-courier-admin-screens': patch
'@fonderie/vue-customers': patch
'@fonderie/vue-customers-screens': patch
'@fonderie/vue-media': patch
'@fonderie/vue-webhooks': patch
'@fonderie/vue-webhooks-screens': patch
'@fonderie/vue-workspaces': patch
'@fonderie/vue-workspaces-screens': patch
---

**Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**

These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.

Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
