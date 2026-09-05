# Fonderie examples

## Adapter parity

Minimal reference apps showing how to build and deploy a Fonderie backend with
each supported framework adapter. All three implement the same todo app (auth +
a workspace-scoped todo resource) and share one deploy pattern.

| Example | Framework | Adapter | Local port |
|---|---|---|---|
| [example-hono](./example-hono) | Hono | `@fonderie/adapter-hono` | 4003 |
| [example-express](./example-express) | Express | `@fonderie/adapter-express` | 4001 |
| [example-koa](./example-koa) | Koa | `@fonderie/adapter-koa` | 4002 |

## A real application

| Example | What it shows | Local port |
|---|---|---|
| [example-mobile-api](./example-mobile-api) | A Fonderie backend serving a production-shaped mobile SaaS — projects, teams, billing, an activity feed and push tokens | 4004 |

`example-mobile-api` answers a different question from the three above: not
*which framework*, but *can Fonderie carry a whole product?* It implements the
REST contract a React Native app speaks, mapping Fonderie's auth, workspaces,
billing and audit onto the paths that app expects. The app itself contains no
Fonderie package — the translation lives in one file on the server.

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
