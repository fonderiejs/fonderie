# @fonderie/vue-media

## 0.2.8

### Patch Changes

- Updated dependencies [2686f16]
  - @fonderie/client@3.12.0
  - @fonderie/vue@0.11.0

## 0.2.7

### Patch Changes

- Updated dependencies [09e227e]
  - @fonderie/client@3.11.0
  - @fonderie/vue@0.10.0

## 0.2.6

### Patch Changes

- Updated dependencies [90963c4]
  - @fonderie/client@3.4.0
  - @fonderie/vue@0.9.0

## 0.2.5

### Patch Changes

- Updated dependencies [ab62ea4]
  - @fonderie/client@3.3.0
  - @fonderie/vue@0.8.0

## 0.2.4

### Patch Changes

- Updated dependencies [157004a]
  - @fonderie/client@3.2.0
  - @fonderie/vue@0.7.0

## 0.2.3

### Patch Changes

- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
- Updated dependencies [87f6e1d]
  - @fonderie/client@3.1.0
  - @fonderie/vue@0.6.0

## 0.2.2

### Patch Changes

- Updated dependencies [bd033f5]
  - @fonderie/client@3.0.0
  - @fonderie/vue@0.5.3

## 0.2.1

### Patch Changes

- 789d775: **Depending on a Fonderie package now actually upgrades the Fonderie packages it uses.**
  
  These packages depended on their siblings at `"*"`. npm treats an already-installed version as satisfying `"*"`, so upgrading one package left the packages it builds on at their old versions. For example, `@fonderie/react-native-media` 0.1.1 kept `@fonderie/react-media` at 0.1.0, without the fix the upgrade was for. Nothing reported it.
  
  Each internal dependency is now a caret range on the current version (e.g. `^0.2.0`), so installing a package brings its siblings up to what it was built with. Releases keep the ranges current, and a new `check:internal-ranges` gate keeps `"*"` from coming back.
- Updated dependencies [789d775]
  - @fonderie/vue@0.5.2

## 0.2.0

### Minor Changes

- ad560bd: **Image uploads from phones.** A JPEG picked on Android was refused with "Unsupported image type."
  
  **The hooks now take the image as base64.** `uploadAvatar` and `upload` accept `{ base64 }`, as a raw payload or a `data:` URL, as well as a Blob.
  - Use base64 on React Native. Pickers return it directly: expo-image-picker with `base64: true`, or expo-image-manipulator.
  - Turning a file URI into a Blob there goes through fetch, the native blob store and FileReader. That chain can hand the server bytes that are not the image.
  - `MediaInput` is exported.
  
  **`@fonderie/media`:**
  - A rejected upload now says what arrived, not only what is allowed:
    - "This is a HEIC/HEIF photo (what phones save by default): convert it to JPEG before uploading."
    - "The image was base64-encoded twice."
    - "The payload is a data: URL."
  - HEIC/HEIF and AVIF are recognised by their bytes. They are still refused by default, since most browsers can't display HEIC. A deployment can opt in through `allowedTypes`.
