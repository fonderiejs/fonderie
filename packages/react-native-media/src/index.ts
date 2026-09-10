// Media hooks have no platform-specific behavior — unlike auth (token storage:
// localStorage vs AsyncStorage), media owns no storage of its own; it reads the
// access token @fonderie/auth already set on the shared FonderieClient, and the
// file→base64 step uses FileReader/Blob, which exist on both web and React
// Native. The implementations are therefore identical, so this package
// re-exports @fonderie/react-media wholesale rather than duplicating files that
// would only ever drift.
export * from '@fonderie/react-media';
