# @fonderie/react-audit-screens

Pre-built React screen for Fonderie's audit log — `AuditLogScreen` — built
on [`@fonderie/react-audit`](https://github.com/fonderie-js/sdk/tree/main/packages/react-audit)'s
`useAuditEvents` hook. Plain HTML elements, inline styles you can override,
zero UI library dependency.

## Install

```sh
npm install @fonderie/react-audit-screens
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { AuditLogScreen } from '@fonderie/react-audit-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function AuditPage() {
  return <AuditLogScreen client={client.audit} />;
}
```

`AuditLogScreen` has a type/actor filter form, a list of events with
click-to-expand JSON payloads, and a load-more button for cursor
pagination. Need just the state management without the markup? Use
`@fonderie/react-audit`'s `useAuditEvents` hook directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** a pre-built React audit-log viewer, so you don't have
to build one from scratch. Swap it for your own design system whenever you
outgrow it — `@fonderie/react-audit`'s hook works standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
