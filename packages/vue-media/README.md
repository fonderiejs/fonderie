# @fonderie/vue-media

Vue 3 composables for Fonderie media — image and avatar upload:
`useUploadAvatar` (the one-call profile-picture flow), `useUploadMedia`
(generic image upload), and `useDeleteMedia`. Thin bindings over
[`@fonderie/client`](https://github.com/fonderiejs/fonderie/tree/main/packages/client):
they encode the file, make the request, and expose reactive loading/error
state — nothing else. Bring your own UI.

## Install

```sh
npm install @fonderie/vue-media
```

## One client at the root (recommended)

Install the plugin once and every composable resolves the client from context:

```ts
import { FonderiePlugin } from "@fonderie/vue";

app.use(FonderiePlugin, client);
```

Passing a client explicitly still works everywhere and takes precedence over
context — handy in tests and multi-client apps.

## Avatar upload — the common case

`useUploadAvatar` does the whole flow: upload the image, set it as the user's
profile picture, and delete the previously-stored avatar so replaced images
don't pile up. It returns the absolute URL now on `user.profileImageUrl`.

```vue
<script setup lang="ts">
import { useUploadAvatar } from '@fonderie/vue-media'

const { uploadAvatar, isUploading } = useUploadAvatar()

function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) void uploadAvatar(file)
}
</script>

<template>
  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
         :disabled="isUploading" @change="onPick" />
</template>
```

The server sniffs the real image type from magic bytes, enforces a size cap,
and rejects SVG (stored-XSS), so client-side checks are a UX nicety, not the
security boundary.

## Generic upload / delete

```ts
import { useUploadMedia, useDeleteMedia } from '@fonderie/vue-media'

const { upload } = useUploadMedia()
const asset = await upload(file, { purpose: 'logo' }) // { id, url, ... }

const { remove } = useDeleteMedia()
await remove(asset.id)
```

To render an uploaded asset, build its absolute URL with the client:
`client.media.assetUrl(asset.id)` (the `GET /media/:id` route is public and
cached — an `<img src>` target).
