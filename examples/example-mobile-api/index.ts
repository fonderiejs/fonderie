import { serve } from '@hono/node-server';

import app from './app.js';

const port = Number(process.env['PORT'] ?? 4004)

// Local / Docker entry. Vercel serves app.ts directly, so this never runs there.
serve({ fetch: app.fetch, port }, () =>
	console.log(`\n  ƒ SaaS Starter API (Hono)  http://localhost:${port}/v1\n`)
);
