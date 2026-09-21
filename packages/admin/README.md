# @fonderie/admin

The operator's surface. One reserved path (default `/_admin`) behind one admin
token, answering what the founder cannot see after deploy: **which bricks are
installed, at what version, whether they are ready, and every route that is
exposed.**

Status: **experimental** (0.x). Design and roadmap: `docs/ADMIN-BRICK-DESIGN.md`.

## Use it

```ts
import { AdminModule } from '@fonderie/admin';

app.register(new AdminModule({ adminToken: process.env.ADMIN_TOKEN }));
```

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://api.example.com/_admin/manifest
```

- **No token, no surface.** Unset `adminToken` ⇒ nothing is registered (404),
  never an open route. Same rule as every other brick's admin routes
  (`docs/ADMIN-AUTH-SPEC.md`); the token is strength-checked at boot.
- **The prefix is reserved.** No other module can mount under it — a collision
  fails boot, naming both sides. `path` moves the whole surface
  (`{ path: '/ops' }`); it is relative to the app's `basePath`, like every route.

## `GET /_admin/manifest`

```json
{
  "generatedAt": "…", "env": "production",
  "admin": { "version": "0.1.0" },
  "modules": [
    { "name": "@fonderie/auth", "version": null, "readiness": { "ok": true, "problems": [] } },
    { "name": "@fonderie/config", "version": null, "readiness": { "ok": true, "problems": [ { "severity": "warning", "message": "no secretEncryptor configured — …" } ] } }
  ],
  "readiness": { "ok": true, "problems": [ … ] },
  "routes": [ { "method": "POST", "path": "/auth/login", "module": "@fonderie/auth" }, … ]
}
```

`version` is `null` until a brick reports one (`IFonderieModule.version`).
Readiness problems are shown here in production — unlike `/readyz`, which is
public — because the operator is the audience.

## Why it's a brick

The model that assembled the app knows what is installed, wired and
configured. The human who deployed it does not, unless they are back in a
development session and can ask. `@fonderie/core` already computes the
answer (`securityReport()`, `app.routes()`); this brick gives it an address.
