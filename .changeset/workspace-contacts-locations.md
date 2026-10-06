---
'@fonderie/workspaces': minor
'@fonderie/client': minor
'@fonderie/react-workspaces': minor
'@fonderie/react-native-workspaces': minor
'@fonderie/vue-workspaces': minor
---

A workspace now holds several emails and phones (one primary each) and its locations (one head office, archivable), under `GET /workspaces/contacts`, `/workspaces/emails`, `/workspaces/phones` and `/workspaces/locations` — members read, owners and managers write. The workspace's `email`, `phone` and `address` stay, as the mirror of the primary email, the primary phone and the head office's address, kept in step both ways in one transaction: a `PUT /workspaces` with them updates (or creates) the entries. Phones are E.164 with an optional extension; a location's `taxRegion` (`CA-QC`) is derived from its address unless given. Migration 010 creates the three tables and turns each existing workspace's email, phone (when already E.164) and address into its first entries. Client: `getContacts`, `addEmail` / `updateEmail` / `removeEmail`, `addPhone` / `updatePhone` / `removePhone`, `createLocation` / `updateLocation` / `archiveLocation` / `restoreLocation`. Hooks: `useWorkspaceContacts()`, `useWorkspaceLocations()`.
