# Deploying this app

The layout is already deploy-ready. Full guide, including the other frameworks:
[fonderie `examples/DEPLOYMENT.md`](https://github.com/fonderiejs/fonderie/blob/main/examples/DEPLOYMENT.md).

| File | Role | Runs on Vercel? |
|---|---|---|
| `src/fonderie.ts` | store + modules + `await boot()` | imported |
| `src/app.ts` | builds the Express app and **`export default`**s it. **No `listen`.** | ✅ entrypoint |
| `src/index.ts` | long-running server (`listen`) + anything needing process lifetime | ❌ local / Docker |
| `src/migrate.ts` | standalone migration runner | ❌ run out of band |

**The split is the whole trick:** Vercel's Node web-server builder searches
`app.*` → `index.*` → `server.*` and serves the **default export**, so it finds
`app.ts` and runs the app — no functions directory, no `vercel.json`, no
wrapper. Put a `listen` in `app.ts` and you break it; leave the default export
off and you get *"The default export must be a function or server."*

## Vercel

1. Point Vercel at this directory. Zero-config — no build command needed.
2. Set environment variables (Project → Settings → Environment Variables):
   - **`DATABASE_URL`** — a hosted Postgres. On Supabase use the **transaction
     pooler** string (port 6543); serverless opens many short-lived
     connections and direct ones run out.
   - **`JWT_SECRET`** — 32+ random chars. Auth refuses to boot in production on
     a placeholder or dev default, and the platform sets
     `NODE_ENV=production` for you.
   - **`FRONTEND_URL`** — your browser app's origin, if it calls this API.
     Without it CORS is off and every browser call fails at the preflight.
3. Run migrations once, against the **direct** connection (port 5432 on
   Supabase — DDL over a transaction pooler is unreliable):
   ```bash
   DATABASE_URL='<direct-connection>' npm run migrate
   ```
4. Deploy.

**Things that do not work on serverless** — the layout already handles the
first two; remember the third if you add one:

- *Migrations at boot* — every cold start would re-run them and instances would
  race. That is why they live in `migrate.ts`.
- *Background timers* — an instance is frozen between requests, so a
  `setInterval` never reliably fires. Put timers in `index.ts` (which serverless
  never runs) and drive the same work with a scheduled ping to a
  secret-guarded route.
- *Long-running work* — queue consumers, browser automation (Playwright), and
  anything past the function timeout need a real host. Keep them as separate
  processes pointed at the same database.

## Docker / any Node host

`src/index.ts` is a normal long-running server:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
RUN npm run build
CMD ["npm", "start"]
```
