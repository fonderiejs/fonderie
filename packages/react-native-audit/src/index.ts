// The audit hook has no platform-specific behavior — no storage of its own,
// nothing DOM/RN-specific — identical between React and React Native, so
// this package re-exports @fonderie/react-audit wholesale rather than
// duplicating a file that would only ever drift.
export * from '@fonderie/react-audit';
