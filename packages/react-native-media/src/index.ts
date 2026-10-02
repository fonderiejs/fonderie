// Media hooks have no platform-specific behavior — unlike auth (token storage:
// localStorage vs AsyncStorage), media owns no storage of its own; it reads the
// access token @fonderie/auth already set on the shared FonderieClient. The
// implementations are therefore identical, so this package re-exports
// @fonderie/react-media wholesale rather than duplicating files that would only
// ever drift.
//
// On React Native, pass the image as `{ base64 }` (expo-image-picker
// `base64: true`, or expo-image-manipulator), not a Blob: turning a file URI
// into a Blob there runs through fetch, the native blob store and FileReader,
// and can hand the server bytes that are not the image ("Unsupported image
// type" for a perfectly good JPEG).
export * from '@fonderie/react-media';
