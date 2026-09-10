# @fonderie/react-native-media

React Native media hooks for Fonderie — `useUploadAvatar`, `useUploadMedia`,
`useDeleteMedia`.

This package re-exports [`@fonderie/react-media`](../react-media) wholesale.
Media hooks have no platform-specific behavior: they own no storage (they read
the token `@fonderie/auth` set on the shared `FonderieClient`), and the
file→base64 step uses `FileReader`/`Blob`, which exist on both web and React
Native. See the [`@fonderie/react-media` README](../react-media) for usage.

## Install

```sh
npm install @fonderie/react-native-media
```

```ts
import { useUploadAvatar } from '@fonderie/react-native-media';
```
