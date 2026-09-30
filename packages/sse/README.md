# @fonderie/sse

Server-Sent Events delivery to frontends. Clients subscribe to **all** the
events they may see, or to **individual** ones; each brick's event catalog
(`describeEvents()`) decides who may receive what — **default deny**. Fan-out
works across instances with Postgres LISTEN/NOTIFY.

It is the client-side sibling of `@fonderie/webhooks`: webhooks push to other
servers, SSE pushes to connected apps. Payloads are invalidations (ids only);
the app re-reads through its normal API.

> **Push is additive.** An app must never wait on this stream to render — it
> only makes a locally saved snapshot fresher while online.
> See `docs/REALTIME-DESIGN.md` §4.7.

## Install

```sh
npm install @fonderie/sse
npm install pg   # only for PgBroadcaster (several instances)
```

## Use

```ts
import { SseModule } from '@fonderie/sse';
import { PgBroadcaster } from '@fonderie/sse/pg';
import { withWorkspace } from '@fonderie/workspaces';

app.register(new SseModule({
  bus: events.bus,                         // delivers bus events from the catalog
  broadcaster: new PgBroadcaster({         // omit on a single instance
    connectionString: process.env.DATABASE_SESSION_URL!, // LISTEN needs session mode
  }),
  middlewares: [withWorkspace(store)],     // YOUR chain: sets ctx.workspace for workspace events
}));
```

```
GET /sse/stream                                  everything this caller may receive
GET /sse/stream?topics=fonderie.config.changed   one event
GET /sse/stream?topics=fonderie.customer.*       a family
GET /sse/topics                                  what this caller may subscribe to
```

Each stream starts with `fonderie.stream.reset` (refetch what you show — v1 has
no replay), then one frame per event:

```
id: 3f1c…
event: fonderie.customer.created
data: {"type":"fonderie.customer.created","data":{"customerId":"c1"},"at":"…"}
```

## Who receives what

A brick declares each deliverable event in its module's `describeEvents()`
(`@fonderie/core`), with an **audience**:

| audience | delivered to |
|---|---|
| `'public'` | every connection, signed in or not |
| `'workspace'` | the connection's workspace (ctx.workspace, resolved by your `withWorkspace`) |
| `'user'` | the user the event is about |
| `(ctx, scope) => boolean` | your rule — roles, permissions |

An event with no entry is never delivered. SSE imports no auth, workspaces or
permissions code: it reads `ctx.user` / `ctx.workspace` as your middleware left
them.

## Hosting

Streams are long-lived: serve them from a long-running host (a container, a
VM) — a serverless function is cut at its time limit. Streams close after
`maxLifetimeMs` (15 min) so each reconnect re-runs your auth chain; a
`fonderie.stream.expiring` event arrives shortly before.

### Serverless API + a stream host

The API can stay serverless. Register SSE on **both**: the event bus creates
delivery rows only for subscriptions registered in the process that publishes
an event, so the API must subscribe too, or the stream host never hears its
events.

```ts
// Serverless API — produces, serves nothing. NOTIFY works through a
// transaction-mode pooler, so the usual DATABASE_URL is fine.
new SseModule({
  bus: events.bus,
  streams: false,
  broadcaster: new PgBroadcaster({ connectionString: process.env.DATABASE_URL!, listen: false }),
});

// Stream host (long-running) — same app, serves /sse/stream. LISTEN needs a
// session-mode connection.
new SseModule({
  bus: events.bus,
  broadcaster: new PgBroadcaster({ connectionString: process.env.SSE_DATABASE_URL! }),
  middlewares: [withWorkspace(store)],
});
```

Point clients at the host: `new FonderieClient({ baseUrl, sse: { baseUrl: 'https://stream.example.com/v1' } })`.

## License

MIT
