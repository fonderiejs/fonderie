# @fonderie-js/permissions

Role-based access control for SaaS — define roles, assign CRUD permissions per resource, and gate any route with requirePermission. Supports multiple roles per user via BOOL_OR aggregation.

## Install

```sh
npm install @fonderie-js/permissions
```

## Use

```ts
import { PermissionKey, requirePermission, requireRole } from '@fonderie-js/permissions';
```

Part of [Fonderie](https://fonderie.ai) — the software foundry. Monorepo, docs, and issues live at [fonderie-js/sdk](https://github.com/fonderie-js/sdk). Follow [@fonderiejs](https://x.com/fonderiejs).

## License

MIT © Fonderie, Inc.
