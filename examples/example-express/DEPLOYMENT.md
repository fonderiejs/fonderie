# Deploying example-express

Full guide: [../DEPLOYMENT.md](../DEPLOYMENT.md). Framework-specific bits:

- **Vercel entrypoint:** `app.ts` → `export default app`.
- **Local port:** `4001` (override with `PORT`).
- **Migrations:** `DATABASE_URL=<your-db> npm run migrate` (never at boot).
- **Env:** `DATABASE_URL` (hosted Postgres), `JWT_SECRET` (32+ chars).
