---
'@fonderie/config': patch
'@fonderie/admin': patch
---

Docs: the config README names the encryption key `CONFIG_SECRET_KEY` (it said `SECRET_KEY`, which no deployment uses) and no longer claims the encryptor can be created from an unset key — `createAesGcmEncryptor` throws on that. The admin README documents the environment report at `GET /_admin/environment` (it named `/_admin/config`, which belongs to @fonderie/config) and no longer states that bricks never read `process.env`.
