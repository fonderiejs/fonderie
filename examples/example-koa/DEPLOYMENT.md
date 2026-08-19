# Deploying example-koa

Full guide: [../DEPLOYMENT.md](../DEPLOYMENT.md). Framework-specific bits:

- **Vercel entrypoint:** `app.ts` → `export default app.callback()` (Koa isn't a handler by itself).
- **Local port:** `4002` (override with `PORT`).
- **Migrations:** `DATABASE_URL=<your-db> npm run migrate` (never at boot).
- **Env:** `DATABASE_URL` (hosted Postgres), `JWT_SECRET` (32+ chars).
