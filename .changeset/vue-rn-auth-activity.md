---
'@fonderie/vue-auth': minor
'@fonderie/react-native-auth': minor
---

Add `useLoginHistory` and `useSessions` to vue-auth and react-native-auth,
closing the framework-parity gap with react-auth (the login-activity hooks
shipped React-only in #229). Same contract as the React hooks — keyset-paginated
login history and live-session listing with `terminate`/`terminateOthers`. Also
re-exports the `IGetLoginHistoryInput` / `ILoginEventDTO` / `ISessionDTO` client
types these hooks return, which both packages were previously missing.
