// Webhook hooks have no platform-specific behavior — no storage of their
// own, nothing DOM/RN-specific — identical between React and React Native,
// so this package re-exports @fonderie/react-webhooks wholesale rather
// than duplicating four files that would only ever drift.
export * from '@fonderie/react-webhooks';
