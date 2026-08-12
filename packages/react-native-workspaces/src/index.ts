// Workspace hooks have no platform-specific behavior — no storage of their
// own, nothing DOM/RN-specific — identical between React and React Native,
// so this package re-exports @fonderie/react-workspaces wholesale rather
// than duplicating seven files that would only ever drift.
export * from '@fonderie/react-workspaces';
