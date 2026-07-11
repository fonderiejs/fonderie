# @fonderie-js/store

The database brick: an `IStoreAdapter` interface, a PostgreSQL driver,
sequential migrations, and a tagged-template `sql` helper that makes
unparameterized queries impossible to write by accident.

## Install

```sh
npm install @fonderie-js/store
```

## Use

```ts
import { sql, PGAdapter } from '@fonderie-js/store';

const { text, params } = sql`SELECT * FROM users WHERE id = ${userId}`;
const rows = await store.query(text, params);
```

`MigrationRunner` applies each module's migrations in order —
every Fonderie brick ships its own schema and installs it through this
package.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie-js/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** how everything persists. The SQL boundary, the PostgreSQL adapter,
and the migration runner through which every brick installs its schema.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
