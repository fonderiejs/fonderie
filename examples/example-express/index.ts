import app from './app.js';

// Local / Docker entry. Vercel serves app.ts directly, so it never runs this.
app.listen(Number(process.env['PORT'] ?? 4001), () =>
	console.log('\n  ƒ TodoApp (Express)  http://localhost:4001\n')
);
