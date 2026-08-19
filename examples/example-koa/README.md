# example-koa

A minimal Fonderie todo app built with **Koa** — auth + a workspace-scoped todo
resource, deployable to Vercel or any Node host.

## Quick start

```bash
npm install
npm run setup            # copies .env.example -> .env (set DATABASE_URL, JWT_SECRET)
npm run migrate          # apply migrations to your database
npm run dev              # http://localhost:4002
```

## Layout

- `fonderie.ts` — store + Fonderie modules (`fonderie.boot()`)
- `app.ts` — builds the Koa app and `export default`s it (the Vercel entrypoint)
- `index.ts` — long-running server for local / Docker
- `migrate.ts` — standalone migration runner (`npm run migrate`)

## Deploying

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** (Vercel + Docker), or the shared guide at
[../DEPLOYMENT.md](../DEPLOYMENT.md).
