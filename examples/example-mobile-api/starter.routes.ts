import { Hono }               from 'hono';
import type { Context }       from 'hono';
import type { FonderieApp }   from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import { requireAuth, withWorkspace } from '@fonderie/adapter-hono';

import { ProjectModel } from './project.model.js';

/**
 * The contract the mobile starter speaks.
 *
 * The starter is deliberately backend-agnostic: it calls a flat set of REST
 * endpoints and does not know Fonderie exists. This router is the adapter —
 * it owns the app's own resources (projects, devices) and re-shapes Fonderie's
 * native routes into the paths and payloads the app expects.
 *
 *   /projects            this app's own table
 *   /members             ← /workspaces/members
 *   /members/invitations ← /workspaces/invitations
 *   /organization        ← /workspaces
 *   /billing/plans       ← /plans
 *   /billing/subscription← /billing/subscription (already the right shape)
 *   /activity            ← /audit
 *   /devices             this app's own table
 *
 * Re-shaping calls Fonderie over its public HTTP surface rather than reading its
 * tables, so this file cannot break when an internal schema changes.
 */
export function buildStarterRouter(
	fonderie: Pick<FonderieApp, 'handle'>,
	store: IStoreAdapter,
	basePath: string,
): Hono {
	const router   = new Hono()
	const projects = ProjectModel(store)
	const scoped   = [requireAuth, withWorkspace(store)] as const

	/**
	 * Call one of Fonderie's own routes in-process, carrying the caller's
	 * credentials.
	 *
	 * This goes STRAIGHT to fonderie.handle(), deliberately not back through the
	 * Hono router. Several paths appear on both sides — /billing/subscription is
	 * both a route this file serves and a route it calls — so routing an internal
	 * call through the app would re-enter this handler and recurse until the
	 * stack overflows.
	 */
	const internal = async (c: Context, path: string, init: RequestInit = {}) => {
		const headers = new Headers(init.headers)
		for (const name of ['authorization', 'x-workspace-id', 'content-type']) {
			const value = c.req.header(name)
			if (value && !headers.has(name)) headers.set(name, value)
		}
		// The origin is irrelevant — Fonderie only reads the path and query.
		const url = `http://internal${basePath}${path}`
		const response = await fonderie.handle(new Request(url, { ...init, headers }))
		const body = await response.json().catch(() => null) as { result?: unknown } | null
		// Fonderie wraps success payloads in { reason, explanation, result }.
		return { ok: response.ok, status: response.status, result: body?.result ?? null }
	}

	const ctx = (c: Context) => c.get('_fonderie') as {
		user?: { id: string }
		workspace?: { id: string }
	}

	// ── projects ─────────────────────────────────────────────────────────────

	router.get('/projects', ...scoped, async (c) => {
		const { workspace } = ctx(c)
		const q = c.req.query()
		return c.json(await projects.list(workspace!.id, {
			search:  q['search'],
			status:  q['status'],
			sortBy:  q['sortBy']  as never,
			sortDir: q['sortDir'] as never,
			cursor:  q['cursor'],
			limit:   q['limit'] ? Number(q['limit']) : undefined,
		}))
	})

	router.get('/projects/:id', ...scoped, async (c) => {
		const { workspace } = ctx(c)
		const project = await projects.get(workspace!.id, c.req.param('id')!)
		if (!project) return c.json({ message: 'Project not found' }, 404)
		return c.json(project)
	})

	router.post('/projects', ...scoped, async (c) => {
		const { user, workspace } = ctx(c)
		const body = await c.req.json<{
			name: string; description: string | null; status: string; dueAt: string | null
		}>()
		if (!body.name?.trim()) return c.json({ message: 'name is required' }, 422)
		return c.json(await projects.create(workspace!.id, user!.id, {
			name:        body.name,
			description: body.description ?? null,
			status:      body.status ?? 'active',
			dueAt:       body.dueAt ?? null,
		}), 201)
	})

	router.patch('/projects/:id', ...scoped, async (c) => {
		const { workspace } = ctx(c)
		const patch = await c.req.json<Record<string, unknown>>()
		const project = await projects.update(workspace!.id, c.req.param('id')!, patch)
		if (!project) return c.json({ message: 'Project not found' }, 404)
		return c.json(project)
	})

	router.delete('/projects/:id', ...scoped, async (c) => {
		const { workspace } = ctx(c)
		const removed = await projects.remove(workspace!.id, c.req.param('id')!)
		if (!removed) return c.json({ message: 'Project not found' }, 404)
		return new Response(null, { status: 204 })
	})

	// ── members ← workspaces ─────────────────────────────────────────────────

	const ROLE_FROM_FONDERIE: Record<string, string> = {
		owner: 'owner', admin: 'admin', member: 'member', viewer: 'viewer',
	}

	/**
	 * Turn the app's role NAME into the role ID the workspace API requires.
	 *
	 * The app speaks names ('admin'); Fonderie's invite and role endpoints both
	 * validate `roleId`. Sending a name is silently dropped on invitations —
	 * the person joins with no role — and rejected outright on a role change.
	 */
	const resolveRoleId = async (c: Context, roleName: string): Promise<string | null> => {
		const { ok, result } = await internal(c, '/workspaces/roles')
		if (!ok || !Array.isArray(result)) return null
		const wanted = roleName.trim().toLowerCase()
		const match = (result as { id: string; name: string }[])
			.find((r) => r.name?.trim().toLowerCase() === wanted)
		return match?.id ?? null
	}

	const toMember = (m: Record<string, unknown>) => {
		const first = (m['firstName'] as string | null) ?? ''
		const last  = (m['lastName']  as string | null) ?? ''
		const name  = `${first} ${last}`.trim()
		return {
			id:             m['userId'],
			userId:         m['userId'],
			organizationId: m['workspaceId'],
			email:          m['email'] ?? '',
			name:           name || null,
			avatarUrl:      m['profileImageUrl'] ?? null,
			role:           ROLE_FROM_FONDERIE[String(m['roleName']).toLowerCase()] ?? 'member',
			// Fonderie tracks acceptance as `confirmed`; the app shows it as a status.
			status:         m['confirmed'] ? 'active' : 'invited',
			invitedAt:      m['createdAt'],
			joinedAt:       m['confirmed'] ? m['createdAt'] : null,
		}
	}

	router.get('/members', ...scoped, async (c) => {
		const { ok, status, result } = await internal(c, '/workspaces/members')
		if (!ok) return c.json({ message: 'Could not load members' }, status as never)
		return c.json((result as Record<string, unknown>[] ?? []).map(toMember))
	})

	router.post('/members/invitations', ...scoped, async (c) => {
		const body = await c.req.json<{ email: string; role: string }>()
		const roleId = await resolveRoleId(c, body.role)
		if (!roleId) {
			return c.json({ message: `No role named "${body.role}" in this workspace` }, 422)
		}
		const { ok, status, result } = await internal(c, '/workspaces/invitations', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: body.email, roleId }),
		})
		if (!ok) return c.json({ message: 'Could not send the invitation' }, status as never)
		return c.json(toMember((result ?? {}) as Record<string, unknown>), 201)
	})

	router.patch('/members/:id', ...scoped, async (c) => {
		const { role } = await c.req.json<{ role: string }>()
		const roleId = await resolveRoleId(c, role)
		if (!roleId) {
			return c.json({ message: `No role named "${role}" in this workspace` }, 422)
		}
		const { ok, status } = await internal(c, `/workspaces/members/${c.req.param('id')}/roles`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ roleId }),
		})
		if (!ok) return c.json({ message: 'Could not change the role' }, status as never)
		const refreshed = await internal(c, '/workspaces/members')
		const member = (refreshed.result as Record<string, unknown>[] ?? [])
			.find((m) => m['userId'] === c.req.param('id'))
		return c.json(member ? toMember(member) : { id: c.req.param('id'), role })
	})

	router.delete('/members/:id', ...scoped, async (c) => {
		const { ok, status } = await internal(c, `/workspaces/members/${c.req.param('id')}`, {
			method: 'DELETE',
		})
		if (!ok) return c.json({ message: 'Could not remove the member' }, status as never)
		return new Response(null, { status: 204 })
	})

	// ── organization ← workspaces ────────────────────────────────────────────

	const toOrganization = (w: Record<string, unknown>) => ({
		id:          w['id'],
		name:        w['name'],
		slug:        w['slug'],
		// A workspace has no logo field, so this is always null. If you want
		// organization logos, add a column and surface it here.
		logoUrl:     null,
		planId:      w['plan'] ?? 'free',
		trialEndsAt: null,
		createdAt:   w['createdAt'],
	})

	router.get('/organization', ...scoped, async (c) => {
		const { workspace } = ctx(c)
		const { ok, status, result } = await internal(c, `/workspaces/${workspace!.id}`)
		if (!ok) return c.json({ message: 'Could not load the organization' }, status as never)
		return c.json(toOrganization((result ?? {}) as Record<string, unknown>))
	})

	router.patch('/organization', ...scoped, async (c) => {
		const patch = await c.req.json<{ name?: string; description?: string | null }>()

		// Forward only what the workspace API validates. It rejects a body with
		// no recognised field, so an update carrying nothing else — a logo-only
		// change, say — would fail rather than no-op.
		const forwarded: Record<string, unknown> = {}
		if (patch.name !== undefined) forwarded['name'] = patch.name
		if (patch.description !== undefined) forwarded['description'] = patch.description

		if (Object.keys(forwarded).length === 0) {
			const current = await internal(c, `/workspaces/${ctx(c).workspace!.id}`)
			return c.json(toOrganization((current.result ?? {}) as Record<string, unknown>))
		}

		const { ok, status, result } = await internal(c, '/workspaces', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(forwarded),
		})
		if (!ok) return c.json({ message: 'Could not update the organization' }, status as never)
		return c.json(toOrganization((result ?? {}) as Record<string, unknown>))
	})

	// ── billing ──────────────────────────────────────────────────────────────

	router.get('/billing/plans', ...scoped, async (c) => {
		const { ok, status, result } = await internal(c, '/plans')
		if (!ok) return c.json({ message: 'Could not load plans' }, status as never)
		return c.json((result as Record<string, unknown>[] ?? []).map((p) => {
			const pricing  = (p['pricing'] ?? {}) as Record<string, number>
			const metadata = (p['metadata'] ?? {}) as Record<string, unknown>
			const features = (p['features'] ?? []) as { name: string; enabled: boolean }[]
			return {
				// The app keys plans by id and looks up 'free' | 'pro' | 'business'.
				id:           String(p['planId'] ?? p['id'] ?? '').toLowerCase(),
				name:         p['name'],
				// Both sides use minor units (cents), so no conversion.
				priceMonthly: pricing['monthly'] ?? 0,
				priceYearly:  pricing['yearly'] ?? 0,
				currency:     pricing['currency'] ?? 'USD',
				// Shown verbatim: t() returns its argument when there is no
				// translation, so a plain sentence renders correctly.
				featureKeys:  features.filter((f) => f.enabled !== false).map((f) => f.name),
				seatLimit:    (metadata['seats'] as number | null) ?? (p['seats'] as number | null) ?? null,
				projectLimit: (metadata['projectLimit'] as number | null) ?? null,
			}
		}))
	})

	router.get('/billing/subscription', ...scoped, async (c) => {
		const { ok, result } = await internal(c, '/billing/subscription')
		// No subscription is a normal state, not an error — the app renders the
		// free plan. Returning 404 here would surface as a crash banner.
		if (!ok || !result) {
			return c.json({
				planId: 'free', status: 'none', interval: 'month',
				currentPeriodEnd: null, cancelAtPeriodEnd: false, seats: 1,
			})
		}
		const s = result as Record<string, unknown>
		// Fonderie's status vocabulary is wider than the app's; anything the app
		// does not know about is treated as active rather than shown as an error.
		const STATUS: Record<string, string> = {
			trialing: 'trialing', active: 'active', past_due: 'past_due',
			canceled: 'canceled', cancelled: 'canceled', incomplete: 'past_due',
			unpaid: 'past_due', paused: 'canceled',
		}
		return c.json({
			planId:            String(s['plan'] ?? 'free').toLowerCase(),
			status:            STATUS[String(s['status'])] ?? 'active',
			interval:          s['interval'] ?? 'month',
			currentPeriodEnd:  s['currentPeriodEnd'] ?? null,
			cancelAtPeriodEnd: Boolean(s['cancelAtPeriodEnd']),
			// Fonderie bills per subscription, not per seat, so the app shows the
			// number of people who actually have access.
			seats:             await memberCount(c),
		})
	})

	/** How many people are in the workspace — the app displays this as seats. */
	const memberCount = async (c: Context): Promise<number> => {
		const { ok, result } = await internal(c, '/workspaces/members')
		return ok && Array.isArray(result) ? result.length : 1
	}

	// ── activity ← audit ─────────────────────────────────────────────────────

	// The audit log records raw event types; the app renders four known kinds.
	const ACTIVITY_TYPE: Record<string, string> = {
		'project.created':   'project.created',
		'project.completed': 'project.completed',
		'workspace.member.joined': 'member.joined',
		'billing.subscription.updated': 'billing.updated',
	}

	router.get('/activity', ...scoped, async (c) => {
		const { ok, result } = await internal(c, '/audit?limit=20')
		if (!ok || !result) return c.json([])
		const events = (result as { items?: Record<string, unknown>[] }).items ?? []
		return c.json(events.map((e) => {
			const payload = (e['payload'] ?? {}) as Record<string, unknown>
			return {
				id:              e['id'],
				type:            ACTIVITY_TYPE[String(e['type'])] ?? 'project.created',
				actorName:       payload['actorName'] ?? 'Someone',
				actorAvatarUrl:  null,
				subject:         payload['name'] ?? payload['subject'] ?? '',
				createdAt:       e['createdAt'],
			}
		}))
	})

	// ── devices ──────────────────────────────────────────────────────────────

	router.post('/devices', requireAuth, async (c) => {
		const { user } = ctx(c)
		const body = await c.req.json<{ token: string; platform: string; appVersion?: string }>()
		if (!body.token) return c.json({ message: 'token is required' }, 422)

		// Re-registering the same token updates the row instead of duplicating it.
		await store.query(
			`INSERT INTO devices (user_id, token, platform, app_version)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (token) DO UPDATE
			   SET user_id = EXCLUDED.user_id,
			       platform = EXCLUDED.platform,
			       app_version = EXCLUDED.app_version,
			       updated_at = now()`,
			[user!.id, body.token, body.platform, body.appVersion ?? null],
		)
		return new Response(null, { status: 204 })
	})

	return router
}
