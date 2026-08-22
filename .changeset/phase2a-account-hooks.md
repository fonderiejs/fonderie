---
"@fonderie/react-auth": minor
"@fonderie/react-native-auth": minor
"@fonderie/vue-auth": minor
"@fonderie/react-workspaces": minor
"@fonderie/vue-workspaces": minor
---

Phase 2 of the hook-gap audit: full auth-account and MFA-enrollment coverage, and the role-permissions read/write pair.

**New auth hooks (react / react-native / vue):**
- `useMfaSetup` — the complete MFA enrollment lifecycle: `setup()` (secret + otpauth URI), `verify(code)` which **persists the rotated tokens** the server issues on enrollment (previously nothing consumed them and the session went stale), `disable(code)`, and `regenerateBackupCodes(code)`.
- `useProfile` — loads the profile and owns `updateProfile` / `updatePreferences` / `updateEmail` / `updatePhone`, self-refreshing.
- `useChangePassword`, `useAccountData` (`exportData` + `deleteUser` with logout-equivalent teardown).
- `useVerifyEmail` gains `resend()` / `resent` — both halves of the verification lifecycle in one hook.

**New workspaces hook (react / react-native / vue):** `useRolePermissions(roleId)` — the read half that `useSetRolePermissions` never had, plus a self-refreshing write, so permission editors can pre-populate. `useSetRolePermissions` remains for compatibility.

Client input/result types used by the new hooks are re-exported from each package index.
