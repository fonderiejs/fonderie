// Billing hooks have no platform-specific behavior — unlike auth (token
// storage: localStorage vs AsyncStorage), billing never owns storage of its
// own; it reads the access token @fonderie/auth already set on the shared
// FonderieClient. The hook implementations are therefore identical between
// React and React Native, so this package re-exports @fonderie/react-billing
// wholesale rather than duplicating seven files that would only ever drift.
export * from '@fonderie/react-billing';
