# Fonderie examples

Minimal reference apps showing how to build and deploy a Fonderie backend with
each supported framework adapter. All three implement the same todo app (auth +
a workspace-scoped todo resource) and share one deploy pattern.

| Example | Framework | Adapter | Local port |
|---|---|---|---|
| [example-hono](./example-hono) | Hono | `@fonderie/adapter-hono` | 4003 |
| [example-express](./example-express) | Express | `@fonderie/adapter-express` | 4001 |
| [example-koa](./example-koa) | Koa | `@fonderie/adapter-koa` | 4002 |

## Quick start

```bash
cd example-hono            # or example-express / example-koa
npm install
npm run setup             # copies .env.example -> .env (set DATABASE_URL, JWT_SECRET)
npm run migrate           # apply migrations
npm run dev
```

## Deploying

Every example deploys to Vercel (or any Node host) with the native framework
entrypoint — no wrapper. See the shared guide: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.
