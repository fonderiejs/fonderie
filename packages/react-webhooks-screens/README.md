# @fonderie/react-webhooks-screens

Pre-built React screens for Fonderie's webhooks module —
`WebhooksListScreen` and `WebhookDetailScreen` — built on
[`@fonderie/react-webhooks`](https://github.com/fonderiejs/sdk/tree/main/packages/react-webhooks)'s
hooks. Plain HTML elements, inline styles you can override, zero UI library
dependency.

## Install

```sh
npm install @fonderie/react-webhooks-screens
```

## Use

```tsx
import { FonderieClient } from '@fonderie/client';
import { WebhooksListScreen, WebhookDetailScreen } from '@fonderie/react-webhooks-screens';

const client = new FonderieClient({ baseUrl: 'https://api.example.com/v1' });

function WebhooksPage() {
  return <WebhooksListScreen client={client.webhooks} onSelectEndpoint={(id) => /* navigate */ null} />;
}
```

`WebhooksListScreen` has a create form (URL + comma-separated events), a
list with test/delete buttons, and a one-time banner showing the signing
secret right after creation. `WebhookDetailScreen` has an edit form
(url/events/enabled) and the endpoint's delivery history. Need just the
state management without the markup? Use `@fonderie/react-webhooks`'s
hooks directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderiejs/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** a pre-built React webhooks manager, so you don't have
to build one from scratch. Swap it for your own design system whenever you
outgrow it — `@fonderie/react-webhooks`'s hooks work standalone.

Browse the whole set at
[fonderiejs/sdk](https://github.com/fonderiejs/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
