---
'@fonderie/adapter-express': patch
'@fonderie/adapter-hono': patch
'@fonderie/adapter-koa': patch
'@fonderie/admin': patch
'@fonderie/audit': patch
'@fonderie/auth': patch
'@fonderie/billing': patch
'@fonderie/config': patch
'@fonderie/core': patch
'@fonderie/courier': patch
'@fonderie/customers': patch
'@fonderie/events': patch
'@fonderie/geo': patch
'@fonderie/logger': patch
'@fonderie/media': patch
'@fonderie/permissions': patch
'@fonderie/rate-limit': patch
'@fonderie/risk': patch
'@fonderie/storage': patch
'@fonderie/store': patch
'@fonderie/webhooks': patch
'@fonderie/workspaces': patch
'@fonderie/cli': minor
---

Every backend brick now ships `env.json`, exported as `@fonderie/<brick>/env.json`, declaring the environment variables it depends on. For each variable the declaration says:
- where the value comes from: read directly, fed through an option, or set by the host platform;
- whether it is required, and whether it is a secret;
- how it is validated and how to generate it;
- which option it feeds;
- its all-or-nothing feature groups, such as Sign in with Google or S3.

Bricks that read nothing declare `"vars": []`.

`@fonderie/cli` gains the resolver the upcoming `fonderie env` commands and the admin console build on. It walks an app's `@fonderie/*` dependencies, following their dependencies and required peers but skipping optional peers the app did not install, and merges the declarations into one list. Two bricks declaring the same name with a different kind or secret-ness are an error, never a silent pick.

The monorepo's new `check:env-declarations` CI gate keeps the declarations true:
- every `process.env` read in a brick's source is declared;
- every variable declared as read directly is actually read;
- all bricks resolve together without conflict.
