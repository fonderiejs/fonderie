import { app } from './app.js';

// Local / Docker entry. Vercel serves app.ts's default export, not this file.
app.listen(Number(process.env['PORT'] ?? 4002), () =>
	console.log('\n  ƒ TodoApp (Koa)  http://localhost:4002\n')
);
