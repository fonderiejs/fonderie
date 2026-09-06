---
'@fonderie/workspaces': minor
---

Ship a default email template for the workspace-invitation notification (P2 of the notification-template normalization).

`@fonderie/workspaces` now exports `DEFAULT_TEMPLATES` covering its one message key (`workspace-invitation`), lifted from courier's seed. Pass it to courier via `config.templates.defaults` and the invitation email renders out of the box — no per-app authoring, never the raw-JSON fallback; override per-app with a DB row / FS file. The copy uses `{{pin}}` (the payload's `token` is intentionally not surfaced). `satisfies Record<WorkspacesMessageKey, IDefaultTemplate>` makes a missing key a compile error; a coverage test asserts it renders cleanly with the real payload and is assignable to courier's `DefaultTemplateMap`. Additive; requires `@fonderie/core >= 0.8.0` + `@fonderie/courier >= 5.2.0`.
