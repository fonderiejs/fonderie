import app from './app.js';

/**
 * Local / Docker entry — a long-running server. Vercel serves `app.ts`
 * directly (searched before index), so it never runs this file. Anything that
 * needs process lifetime (background timers, schedulers) belongs here rather
 * than in `app.ts`, because a serverless instance is frozen between requests.
 */
const port = process.env['PORT'] ? parseInt(process.env['PORT']) : 3000;
app.listen(port, () => {
	console.log(`🚀 Server ready at http://localhost:${port}`);
	console.log(`📚 API base: http://localhost:${port}/v1`);
});
