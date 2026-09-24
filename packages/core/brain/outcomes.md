<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/core — outcomes

What this package does to a running app: tables its migrations create,
rows it seeds, routes it registers. Generated from the migration SQL and
route tables in source — trust this file instead of reading `dist/` or
downloading tarballs.

## HTTP routes registered

| Method | Path | Middleware chain (auth / validation / handler) |
|---|---|---|
| GET | `/healthz` | `compose([async () => Response.json({ status: 'ok' })]) → CORE` |
| GET | `/metrics` | `compose([ async () => new Response(this.metrics.render(), { status: 200, headers: { 'content-type': 'text/plain; version=0.0.4' }, }), ]) → CORE` |
| GET | `/readyz` | `compose([ async () => { const report = this.checkProductionReadiness(); let dependencies = true; if (this.config.readyProbe) { try { dependencies = Boolean(await this.config.readyProbe()); } catch { dependencies = false; } } const ready = report.ok && dependencies; // The problems list names weak secrets, placeholder tokens, and // dependency state — a security-posture map. It is only exposed // outside production (or with an explicit opt-in); the probe // consumer (k8s, LB) needs nothing beyond the status code. const exposeDetails = process.env['NODE_ENV'] !== 'production' || this.config.exposeReadyzDetails === true; return Response.json( { status: ready ? 'ready' : 'not_ready', dependencies, ...(exposeDetails ? { problems: report.problems } : {}), }, { status: ready ? 200 : 503 }, ); }, ]) → CORE` |
