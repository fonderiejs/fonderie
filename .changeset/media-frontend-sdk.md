---
"@fonderie/client": minor
---

Add a `media` sub-client for image/avatar upload — `client.media` alongside
`client.auth`/`client.billing`, sharing the same access token. Methods:
`upload({ dataBase64, purpose? })` (POST /media), `delete(id)` (DELETE
/media/:id), plus the pure helpers `assetUrl(id)` (absolute `<img src>` for the
public GET /media/:id) and `assetIdFromUrl(url)` (its inverse, for avatar
cleanup). Completes the frontend surface for the @fonderie/media brick, which
until now shipped server-first — the new @fonderie/react-media,
@fonderie/react-native-media, and @fonderie/vue-media hook packages build on it.
