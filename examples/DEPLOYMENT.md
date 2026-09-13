# Deploying a Fonderie app

The `example-hono`, `example-express`, and `example-koa` apps all follow the same
deploy-ready layout. Nothing here is example-specific — use the same shape in your
own Fonderie app.

## File layout

| File | Role | Runs on Vercel? |
|---|---|---|
| `fonderie.ts` | Builds the store + modules and `await fonderie.boot()`. No migrations. | imported by `app.ts` |
| `app.ts` | Builds the framework app and **`export default`**s it. **No `listen`.** | ✅ this is the entrypoint |
| `index.ts` | Imports the app and starts a long-running server (`listen`). | ❌ local / Docker only |
| `migrate.ts` | Standalone migration runner. | ❌ run out-of-band |

The split is the whole trick: **Vercel serves `app.ts`; your server lives in `index.ts`.**
There is no `toVercel()` wrapper and no `process.env.VERCEL` branching.

## Vercel

Vercel's Node "web server" builder searches for an entrypoint in the order
`app.*` → `index.*` → `server.*` and serves its **default export**. Because
`app.ts` is found first and default-exports the framework app, it just works —
no `vercel.json`, no functions directory.

The default export per framework:

| Framework | `app.ts` default export |
|---|---|
| Hono | `export default app` (served via `app.fetch`) |
| Express | `export default app` |
| Koa | `export default app.callback()` (Koa isn't a handler by itself) |

> The entrypoint must **import the framework directly** (`import { Hono } from 'hono'`,
> `import express from 'express'`, `import Koa from 'koa'`) — that's how Vercel
> detects which server to run.

### Steps

1. Point Vercel at the example directory (Root Directory = e.g. `examples/example-hono`).
   Zero-config — no build command needed.
2. Set environment variables (Project → Settings → Environment Variables):
   - **`DATABASE_URL`** — a **hosted** Postgres reachable from Vercel (Neon, Supabase,
     RDS, …). A local or SSH-only database will not work.
   - **`JWT_SECRET`** — 32+ random chars (`openssl rand -base64 32`). The auth guard
     refuses a placeholder/dev value under `NODE_ENV=production`.
3. Run migrations once against that database (they do **not** run on cold start):
   ```bash
   DATABASE_URL="<your-prod-url>" npm run migrate
   ```
4. Deploy.

> **Cold starts:** the app (auth, DB pool, module boot) is built once per cold start.
> Expect a slow first request after idle. For sustained traffic prefer a
> long-running host (see Docker below).

### If the app sends email (or anything else off the request path)

An instance is frozen the moment it responds, so work left running after the
response is abandoned — the user is told to check their email and nothing was
ever sent. Register `EventsModule` with the **Postgres** transport, in
producer-only mode, so the send is a durable row written inside the request:

```ts
new PGTransport({ connectionUrl, consume: false })
```

`consume: false` matters: a consumer would open a `LISTEN` connection, which a
transaction-mode pooler rejects, plus a poll loop the invocation cannot host.

Something must then deliver it. With no long-running process anywhere, the app
consumes its own queue after each response:

```ts
// once at boot — Vercel keeps the instance alive until the work settles,
// so the drain costs the caller nothing
const { waitUntil } = await import('@vercel/functions');
setBackgroundRunner((work) => waitUntil(work));

app.use((_req, res, next) => {
  res.on('finish', () => void background(bus.drain({ maxMs: 10_000 })));
  next();
});
```

Safe by construction: the row is already durable, so a drain that is skipped or
cut short costs latency only — the next one resumes where it stopped, and
concurrent drains claim exclusively. Run `bus.start()` instead wherever a
worker or container is available; it delivers in milliseconds. Add a scheduled
ping that drains as a backstop, and surface `deadLetters()`/`pendingCount()`
somewhere, since a queue that has stopped delivering looks exactly like an
empty one.

Two footguns worth knowing before you trust any of this.

**Consumer rows are written by the publisher**, from its own subscriptions.
Register courier (and anything else consuming) on the producing process too, or
its events are owed to nobody and can never be delivered.

**The queue does not tell you whether email was sent.** Courier catches a send
failure, records it, and deliberately does not rethrow — a bad address must not
poison the event — so the handler resolves and the consumer row is marked
`processed` either way. An SMTP rejection is indistinguishable from a clean
send in `fonderie_event_consumers`, and `deadLetters()` stays empty no matter
how badly email is failing. Read `fonderie_message_log` for that — `status` of
sent/failed/pending, with the provider's error — and treat the queue as
answering only "was the event dispatched". Even then, `sent` means the provider
**accepted** it; an async bounce still looks like success.

## Docker / any Node host

`index.ts` is a normal long-running server, so any container or VM works:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
CMD ["npm", "start"]
```

```bash
docker build -t my-fonderie-app .
docker run -p 4003:4003 \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  -e JWT_SECRET="$(openssl rand -base64 32)" \
  my-fonderie-app
```

Run `npm run migrate` against the database once (idempotent) as a separate step.

## Local development

```bash
npm install
npm run setup            # copies .env.example -> .env
# edit .env: DATABASE_URL, JWT_SECRET
npm run migrate          # apply migrations
npm run dev              # start the server
```

Default local ports: **Hono 4003 · Express 4001 · Koa 4002** (override with `PORT`).

## Migrations are always external

Migrations never run at app boot — on any target. Run `npm run migrate` yourself
(CI step, release step, or manually) against whatever database you deploy to. This
keeps cold starts fast and avoids concurrent migration races across instances.
