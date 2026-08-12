# @fonderie/react-courier-admin-screens

Pre-built React screens for the Fonderie courier admin API —
`TemplateListScreen` and `TemplateEditorScreen` — built on
[`@fonderie/react-courier-admin`](https://github.com/fonderie-js/sdk/tree/main/packages/react-courier-admin)
hooks. Plain HTML elements, inline styles you can override, zero UI library
dependency.

## Install

```sh
npm install @fonderie/react-courier-admin-screens
```

## Use

```tsx
import { CourierAdminClient } from '@fonderie/client';
import { TemplateListScreen, TemplateEditorScreen } from '@fonderie/react-courier-admin-screens';

const admin = new CourierAdminClient({
  baseUrl: 'https://api.example.com/v1',
  adminToken: process.env.FONDERIE_ADMIN_TOKEN!,
});

function Templates() {
  return (
    <TemplateListScreen
      client={admin}
      onSelectTemplate={(t) => setRoute(`edit/${t.type}/${t.locale ?? ''}`)}
    />
  );
}

function EditTemplate({ type, locale }: { type: string; locale?: string }) {
  return <TemplateEditorScreen client={admin} type={type} locale={locale} onSaved={() => setRoute('list')} />;
}
```

`TemplateListScreen` lists every template with its locale and active state.
`TemplateEditorScreen` is a subject/HTML/plain-text form with a revision
history and one-click rollback, using the loaded template's version as
optimistic-concurrency `ifVersion` on save. Need just the state management
without the markup? Use `@fonderie/react-courier-admin`'s hooks directly.

## Why this exists

You've shipped this plumbing before — auth, teams, billing, messaging —
and the next project will ask for it again. Fonderie packages it once:
plain TypeScript modules for
[`@fonderie/core`](https://github.com/fonderie-js/sdk/tree/main/packages/core),
PostgreSQL-backed, self-hosted, MIT. No external control plane, no
per-seat anything. Register the modules you need; skip the ones you don't.

**This package owns** pre-built React admin UI for courier's templates, so
you don't have to build a template editor from scratch. Swap it for your own
design system whenever you outgrow it — `@fonderie/react-courier-admin`'s
hooks work standalone.

Browse the whole set at
[fonderie-js/sdk](https://github.com/fonderie-js/sdk) · follow
[@fonderiejs](https://x.com/fonderiejs)

## License

MIT © Fonderie, Inc.
