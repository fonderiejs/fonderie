# @fonderie/customers

Workspace-scoped customer records: individuals and businesses with multiple
emails, phones, addresses, notes, and tags — the CRM brick.

## Install

```sh
npm install @fonderie/customers
```

## Use

```ts
import { EVENT_KEYS, toCustomerDTO, toCustomerDetailDTO } from '@fonderie/customers';
```

Ships full DTO mappers for customers and their emails, phones, addresses,
notes, and tags, plus typed `EVENT_KEYS` for reacting to customer changes
elsewhere in your app.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** the people your users serve. Workspace-scoped CRM records —
individuals and businesses with their emails, phones, addresses, notes,
and tags.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
