---
'@fonderie/react-media': minor
'@fonderie/vue-media': minor
'@fonderie/react-native-media': patch
'@fonderie/media': minor
---

**Image uploads from phones.** A JPEG picked on Android was refused with "Unsupported image type."

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
