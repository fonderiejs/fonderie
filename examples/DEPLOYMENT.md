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
3. Run migrations against that database (they do **not** run on cold start):
   ```bash
   DATABASE_URL="<your-prod-url>" npm run migrate
   ```
   Once, by hand — or on every push, from CI (see [Applying migrations from CI](#applying-migrations-from-ci)).
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

### Scheduled work: one guarded cron route

Several things must happen on a clock, and a serverless app has no process to
own a timer: a frozen instance cannot be trusted with `setInterval`. Put them
behind one route and let **Vercel Cron** call it:

```json
// vercel.json
{ "crons": [{ "path": "/internal/cron/purge", "schedule": "0 4 * * *" }] }
```

```ts
app.post('/internal/cron/purge', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  // Refuse to run unguarded: a misconfigured deploy fails loudly (503) instead
  // of exposing a public "do work" button.
  if (!secret) return res.status(503).json({ error: 'CRON_SECRET is not configured' });
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).end();

  const usersPurged = await purgeSoftDeletedUsers(store, { olderThanDays: 30, bus });   // @fonderie/auth
  const eventsPurged = await purgeEvents(store, { olderThanDays: 365 });                // @fonderie/events
  await bus.drain({ maxMs: 20_000 });  // backstop for anything the per-response drain missed
  res.json({ usersPurged, eventsPurged, dead: await transport.deadLetters(10) });
});
```

Vercel sends `CRON_SECRET` as a Bearer token when the variable is set on the
project. What typically belongs here:

| Job | Why it cannot be skipped |
|---|---|
| `purgeSoftDeletedUsers` | Right to erasure: a deleted account is soft-deleted first, then hard-deleted after the window. It emits `fonderie.user.purged`, which billing turns into deleting the provider customer. |
| `purgeEvents` | The event log is also the audit trail and **grows forever** unless something disposes of it. Pick the window deliberately — a year is the usual audit-trail minimum. Delivery rows go with their event (`ON DELETE CASCADE`). |
| `bus.drain()` | The backstop for a row published while no traffic followed, or whose instance died mid-drain. |
| `deadLetters()` / `pendingCount()` / the doctor | A queue that stopped delivering looks exactly like an empty one until something looks. Return them, so the cron's own log answers "is it healthy". |

Catch each job's failure separately and report it in the response: one failed
purge must not stop the drain, and a swallowed error recreates the blindness the
route exists to remove.

### Work Vercel cannot host

A function has a time limit, no browser, and no process that outlives the
response. Anything that needs minutes, a real Chromium, or a long-lived loop —
scraping, video, large exports — goes to a container that **wakes, drains, and
exits**: a scheduled job on Cloud Run, Fly Machines, ECS or any cron-capable
container host.

The API publishes the job as a durable event; the worker consumes it:

```ts
// worker — POLL, do not LISTEN
const bus = new EventBus(new PGTransport({ connectionUrl: process.env.DATABASE_URL, consume: false }));
bus.on('app.scrape.task', runTask, 'scrape-worker');
await bus.drain({ maxMs: 10 * 60_000 });   // then exit; the scheduler starts the next run
```

Polling is load-bearing. `LISTEN` holds a session, which the transaction-mode
pooler serverless apps connect through refuses — so a listening worker needs a
second, session-mode connection string. A polling worker reuses the app's
`DATABASE_URL`: one credential, one config. The cost is up to one poll interval
of pickup latency, noise for a job measured in minutes. Claiming is exclusive
and rows are durable, so a crashed run loses nothing: the next one picks the
same rows up.

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

### The consequence: code goes live ahead of the schema

Because migrations are external, a deploy routinely succeeds against a database
that has not run them yet. Nothing fails at deploy time; the gap surfaces later,
when a request happens to touch the new column — and the symptom looks nothing
like the cause. A queue that will not drain, an OAuth callback that hangs, a
health route that 500s. Each gets diagnosed on its own and none of them mentions
migrations.

`MigrationRunner.pending()` turns that into a number. It is read-only and safe
on the request path, so report it from whatever health or cron route you already
have:

```ts
const pending = await new InternalMigrationRunner(store, path).pending();
// [] on a current database; ['920_add_task_cancelled_status.sql'] when behind
```

### Applying migrations from CI

"Run `npm run migrate` yourself" is one step someone eventually forgets. Let the
pipeline apply them on every push to the production branch, gated on a
read-only safety check:

```yaml
jobs:
  migration-safety:
    runs-on: ubuntu-latest
    environment: Production          # where the DATABASE_URL secret lives
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx fonderie migrate --check   # @fonderie/cli — read-only: lists pending, exits 1 on DESTRUCTIVE ones
        env: { DATABASE_URL: "${{ secrets.DATABASE_URL }}" }

  migrate:
    needs: migration-safety
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: Production
    concurrency: { group: migrate-production, cancel-in-progress: false }  # queue, never cancel mid-run
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run migrate
        env: { DATABASE_URL: "${{ secrets.DATABASE_URL }}" }
```

Two properties make this safe:

- **Destructive migrations are refused, not sequenced.** Vercel deploys on push
  independently, so new code is live for the minute the migration takes.
  Additive migrations make that survivable — the new column simply is not there
  yet. A `DROP` is left to a human, run deliberately.
- **Verify after applying**, not just the exit code: re-run the pending report
  and fail the job if anything is still pending. `fonderie migrate --check` exits
  non-zero only on destructive work, so on its own it passes with migrations unapplied.

Use the **direct** connection for DDL; a transaction-mode pooler breaks
migration sessions.

### Serverless: the .sql files must be told to come along

**This bites on Vercel and any other bundler that traces imports.** Migration
`.sql` files are read with `readdir()` at runtime, so the tracer never sees a
reference to them and prunes them from the function bundle. The migration check
then fails with `ENOENT … scandir '/var/task/node_modules/@fonderie/<pkg>/dist/migrations/sql'`
— it worked locally and could not work deployed, which is the one environment it
exists for.

The files *do* ship inside each package; they just need a tracing hint:

```json
{
  "functions": {
    "src/app.ts": {
      "includeFiles": "{src/db/migrations/sql/**,node_modules/@fonderie/*/dist/migrations/sql/**}"
    }
  }
}
```

The same applies to `npm run migrate` if you run it *from* a bundled artifact
rather than from source — which is why running it against source, out of band, is
the recommendation above.

## Secrets more than one process shares

Some secrets are not per-process credentials but **shared keys**: every process
must hold the same value, and losing it has consequences beyond a redeploy.

| Secret | Held by | If it changes or is lost |
|---|---|---|
| `EVENTS_INTEGRITY_KEY` (`PGTransport({ integrityKey })`) | **every** process that publishes events — the API and any worker | Rows signed with the old key no longer verify. Rows published without it are reported as unsigned. |
| `CONFIG_SECRET_KEY` (`@fonderie/config`) | every process that reads secrets | Stored secrets cannot be decrypted. Rotate with `rotateSecretKey`, never by replacement. |

Two rules follow:

- **Keep one retrievable source of truth.** A platform secret you cannot read
  back — Vercel's *Secret*-type variables are write-only — is not a backup. Put
  the value in a secret manager you can read (GCP Secret Manager, AWS Secrets
  Manager, 1Password, Vault), mount it into the worker from there, and pipe it
  into the platform from there, so it is never pasted or printed:
  ```bash
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets create events-integrity-key --data-file=-
  gcloud secrets versions access latest --secret events-integrity-key \
    | npx vercel env add EVENTS_INTEGRITY_KEY production --sensitive
  ```
- **Verify by behaviour, not by reading back.** A write-only variable pulls as an
  empty string, so `vercel env pull` proves nothing. Check what the value does:
  the doctor's `events.integrity` turns from *skipped* to *ok*, a signed webhook
  returns 200.
