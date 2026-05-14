import type { Context, MiddlewareHandler } from 'hono';
import type { Hono }                       from 'hono';

import type { FonderieApp, IFonderieContext, Middleware } from '@fonderie-js/core';

// Augment Hono's ContextVariableMap so c.get('_fonderie') is typed.
declare module 'hono' {
	interface ContextVariableMap {
		_fonderie: IFonderieContext
	}
}

// Re-export for consumers who want to type their Hono app:
//   const hono = new Hono<{ Variables: FonderieVariables }>()
export type FonderieVariables = {
	_fonderie: IFonderieContext
}

// ── bridge ────────────────────────────────────────────────────────
//
// Global middleware. Runs fonderie's session + billing global stack so that
// ctx.user and ctx.meta['billing'] are available in every route handler.
// Must be registered before any fonderie-aware route middleware.
//
//   hono.use('*', bridge(fonderie))
//
// The request is cloned so the original body stream is preserved for
// fonderie's own catch-all route (registered via mount()).

export function bridge(fonderie: FonderieApp): MiddlewareHandler {
	return async (c, next) => {
		const ctx = await fonderie.buildContext(c.req.raw.clone())
		c.set('_fonderie', ctx)
		await next()
	}
}

// ── adapt ─────────────────────────────────────────────────────────
//
// Wraps any fonderie Middleware into a Hono MiddlewareHandler.
// Multiple adapt() calls in the same route share the same fonderie context
// from c.var._fonderie, so workspace/permissions state propagates correctly.
//
//   hono.get('/jobs',
//     adapt(requireAuth),
//     adapt(withWorkspace(store)),
//     adapt(requirePermission(OPERATIONS.READ, 'jobs')),
//     async (c) => { ... }
//   )

export function adapt(middleware: Middleware): MiddlewareHandler {
	return async (c: Context, next) => {
		const ctx = c.get('_fonderie')
		if (!ctx) throw new Error('[fonderie] bridge() must be registered before adapt()')

		let continued = false
		const result = await middleware(ctx, async () => {
			continued = true
			return new Response()
		})

		if (continued) {
			await next()
		} else {
			return result
		}
	}
}

// ── mount ─────────────────────────────────────────────────────────
//
// Registers fonderie's infrastructure routes (auth, billing, workspaces, …)
// as a Hono catch-all. Always call AFTER registering your own business routes.
//
//   hono.get('/jobs', ...)          // business route — matched first
//   mount(hono, fonderie)           // fonderie infra — catch-all, matched last

export function mount(hono: Hono, fonderie: FonderieApp): void {
	hono.all('*', (c) => fonderie.handle(c.req.raw))
}
