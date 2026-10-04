---
'@fonderie/workspaces': minor
'@fonderie/client': minor
'@fonderie/courier': patch
'@fonderie/react-workspaces': minor
'@fonderie/vue-workspaces': minor
'@fonderie/react-workspaces-screens': patch
'@fonderie/react-native-workspaces-screens': patch
'@fonderie/vue-workspaces-screens': patch
---

Members and invitations work end to end.

- **Invite without picking a role**: the person joins with the default role; the default role named explicitly is accepted, a manager role is refused.
- **Accept by link**: set `invitationUrl` (e.g. `https://app.example.com/invite/{token}`) and the invitation email carries the link, the workspace name and who invited, with the PIN as fallback. `client.workspaces.acceptInvitation({ token } | { pin })`; a bare string is still a PIN. The prebuilt accept screens sent the link's token as a PIN, so they could never succeed; they now send it as a token.
- **The invitation email** (en/fr/es) shows the link when one is configured, the workspace name and who invited, and always the PIN. Courier migration `006` upgrades the seeded `workspace-invitation` row to the same copy, but only if nobody edited it; the change is recorded as a revision the console can roll back. Without it, existing installs would keep sending the PIN-only email.
- **A link joins one person**: accepting is single-use, even when two people race for one forwarded link.
- **One pending invitation per address**, whatever the case: re-inviting refreshes it instead of stacking a duplicate (migration `004` adds the unique index and cancels existing duplicates). `resendInvitation` sends a new link and PIN; invitations past expiry are listed with `isExpired`.
- **Seats** count each person once, plus pending invitations, never the owner. Adding a role never makes someone a member.
- **Members list**: one row per person, with `roles[]`, `isOwner` and `isManager`.
- **Manager path**: the owner can make a member a manager (`setManager` / `unsetManager`), hand over the workspace (`transferOwnership`; the previous owner stays as a manager), and any member can `leaveWorkspace` (the owner must hand over first).
- **`GET /workspaces/current`** and `useCurrentWorkspace()` (React / React Native / Vue): the selected workspace from the shared cache, so an app needs no store copy.
- Updating one workspace setting keeps the others (it replaced the whole settings object).
