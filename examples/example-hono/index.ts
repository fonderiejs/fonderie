import { serve } from '@hono/node-server';

import app from './app.js';

// Local / Docker entry — starts a long-running server. Vercel serves app.ts
// directly (searched before index), so it never runs this file.
serve({ fetch: app.fetch, port: Number(process.env['PORT'] ?? 4003) }, () =>
	console.log('\n  ƒ TodoApp (Hono)  http://localhost:4003\n')
);
