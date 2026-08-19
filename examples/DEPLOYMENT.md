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
