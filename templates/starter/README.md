# Fonderie Starter

A Fonderie-powered SaaS backend starter.

## 60-Second Quickstart

```bash
# 1. Scaffold the app
npx create-fonderie-app my-saas
cd my-saas

# 2. Configure your environment
cp .env.example .env

# 3. Start the dev server
npm run dev

# 4. In another terminal, hit the health check
curl http://localhost:3000/health
# → { "status": "ok", "fonderie": true, "modules": ["auth", "workspaces"] }
```

The server boots even without a database configured — set `DATABASE_URL` in
`.env` to enable the `/v1` auth and workspaces routes.

## Next Steps

This backend was built with Fonderie. Open the project in Claude Code and ask it
to extend the app — for example:

- "Add Stripe billing to this app"
- "Add rate limiting to the API"
- "Add audit logging for workspace events"

## Learn More

- Docs: [fonderiejs.com](https://fonderiejs.com)

## AI Assistant

This backend was created with Fonderie. The `.claude/skills/fonderie/` directory
teaches your AI assistant how to extend it.
