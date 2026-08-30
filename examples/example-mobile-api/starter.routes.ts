import { Hono }               from 'hono';
import type { Context }       from 'hono';
import type { FonderieApp }   from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import { requireAuth, withWorkspace } from '@fonderie/adapter-hono';
import { schemas } from '@fonderie/workspaces';
import type { IMemberDTO, IRoleDTO, IWorkspaceDTO } from '@fonderie/workspaces';
import type { IPlanDTO, ISubscriptionDTO } from '@fonderie/billing';
import type { IAuditEventDTO } from '@fonderie/audit';

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
	 * credentials, and pull the payload out of its envelope.
	 *
	 * Two things this exists to get right, both of which were wrong when they were
	 * written by hand:
	 *
	 * 1. Fonderie replies with { reason, explanation, result }, and `result` is an
	 *    OBJECT keyed by resource — { members: [...] }, not a bare array. Treating
	 *    it as an array throws at runtime.
	 * 2. It goes STRAIGHT to fonderie.handle(), never back through the Hono
	 *    router. Several paths appear on both sides — /billing/subscription is both
	 *    served here and called from here — so routing internally would re-enter
	 *    this handler and recurse until the stack overflows.
	 *
	 * `key` names the field inside `result`, and `T` is the DTO type the package
	 * exports, so the compiler checks every field read downstream.
	 */
	const internal = async <T>(
		c: Context,
		path: string,
		key: string,
		init: RequestInit = {},
	): Promise<{ ok: boolean; status: number; data: T | null }> => {
		const headers = new Headers(init.headers)
		for (const name of ['authorization', 'x-workspace-id', 'content-type']) {
			const value = c.req.header(name)
			if (value && !headers.has(name)) headers.set(name, value)
		}

		// The origin is irrelevant — Fonderie only reads the path and query.
		const response = await fonderie.handle(
			new Request(`http://internal${basePath}${path}`, { ...init, headers }),
		)
		const body = (await response.json().catch(() => null)) as
			| { result?: Record<string, unknown> }
			| null

		return {
			ok: response.ok,
			status: response.status,
			data: (body?.result?.[key] as T | undefined) ?? null,
		}
	}

	/**
	 * Send a body to Fonderie after checking it against Fonderie's own validator.
	 *
	 * Zod strips unknown keys rather than rejecting them, so a misnamed field
	 * produces a 200 with the value silently dropped — an invitation that succeeds
	 * and grants no role. Validating here turns that into a loud 500 during
	 * development instead of a mystery in production.
	 */
	const send = async <T>(
		c: Context,
		path: string,
		key: string,
		method: string,
		body: unknown,
		schema: { safeParse: (value: unknown) => { success: boolean } },
	): Promise<{ ok: boolean; status: number; data: T | null }> => {
		if (!schema.safeParse(body).success) {
			throw new Error(
				`${method} ${path} was called with a body Fonderie will not accept: ` +
					JSON.stringify(body),
			)
		}
		return internal<T>(c, path, key, {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		})
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
	 * validate `roleId`. Sending a name is silently dropped on invitations — the
	 * person joins with no role — and rejected outright on a role change.
	 */
	const resolveRoleId = async (c: Context, roleName: string): Promise<string | null> => {
		const { ok, data } = await internal<IRoleDTO[]>(c, '/workspaces/roles', 'roles')
		if (!ok || !data) return null
		const wanted = roleName.trim().toLowerCase()
		return data.find((r) => r.name?.trim().toLowerCase() === wanted)?.id ?? null
	}

	/**
	 * Email and display name for a set of members.
	 *
	 * The workspace API cannot supply these: listMembers() joins fonderie_users and
	 * has them, but toMemberDTO() drops every identity field, so GET
	 * /workspaces/members returns ids and roles only. A team screen needs a name to
	 * render, so this example reads them from the users table directly.
	 *
	 * That is the one place this file touches Fonderie's schema rather than its
	 * API. If the members DTO ever carries identity, delete this and read it there.
	 */
	interface Identity { email: string; name: string | null; avatarUrl: string | null }

	const identitiesFor = async (userIds: string[]): Promise<Map<string, Identity>> => {
		if (userIds.length === 0) return new Map()

		const rows = await store.query<{
			id: string
			email: string | null
			first_name: string | null
			last_name: string | null
			profile_image_url: string | null
		}>(
			`SELECT id, email, first_name, last_name, profile_image_url
			   FROM fonderie_users
			  WHERE id = ANY($1::uuid[])`,
			[userIds],
		)

		return new Map(rows.map((r) => {
			const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()
			return [r.id, {
				email: r.email ?? '',
				name: name || null,
				avatarUrl: r.profile_image_url ?? null,
			}]
		}))
	}

	const toMember = (m: IMemberDTO, identity?: Identity) => ({
		id:             m.userId,
		userId:         m.userId,
		organizationId: m.workspaceId,
		email:          identity?.email ?? '',
		name:           identity?.name ?? null,
		avatarUrl:      identity?.avatarUrl ?? null,
		role:           ROLE_FROM_FONDERIE[m.roleName?.toLowerCase()] ?? 'member',
		// Fonderie tracks acceptance as `confirmed`; the app shows it as a status.
		status:         m.confirmed ? 'active' : 'invited',
		invitedAt:      m.createdAt,
		joinedAt:       m.confirmed ? m.createdAt : null,
	})

	const listMembers = async (c: Context) => {
		const { ok, status, data } = await internal<IMemberDTO[]>(c, '/workspaces/members', 'members')
		if (!ok || !data) return { ok: false as const, status }

		const identities = await identitiesFor(data.map((m) => m.userId))
		return { ok: true as const, members: data.map((m) => toMember(m, identities.get(m.userId))) }
	}

	router.get('/members', ...scoped, async (c) => {
		const result = await listMembers(c)
		if (!result.ok) return c.json({ message: 'Could not load members' }, result.status as never)
		return c.json(result.members)
	})

	router.post('/members/invitations', ...scoped, async (c) => {
		const body = await c.req.json<{ email: string; role: string }>()

		const roleId = await resolveRoleId(c, body.role)
		if (!roleId) {
			return c.json({ message: `No role named "${body.role}" in this workspace` }, 422)
		}

		const { ok, status } = await send<unknown>(
			c, '/workspaces/invitations', 'invitations', 'POST',
			{ email: body.email, roleId },
			schemas.createInvitationsSchema,
		)
		if (!ok) return c.json({ message: 'Could not send the invitation' }, status as never)

		// The invitation response carries no identity, so report what was asked for.
		return c.json({
			id: body.email, userId: body.email, organizationId: ctx(c).workspace!.id,
			email: body.email, name: null, avatarUrl: null,
			role: body.role, status: 'invited',
			invitedAt: new Date().toISOString(), joinedAt: null,
		}, 201)
	})

	router.patch('/members/:id', ...scoped, async (c) => {
		const { role } = await c.req.json<{ role: string }>()

		const roleId = await resolveRoleId(c, role)
		if (!roleId) return c.json({ message: `No role named "${role}" in this workspace` }, 422)

		const { ok, status } = await send<unknown>(
			c, `/workspaces/members/${c.req.param('id')}/roles`, 'roles', 'POST',
			{ roleId },
			schemas.addMemberRoleSchema,
		)
		if (!ok) return c.json({ message: 'Could not change the role' }, status as never)

		const refreshed = await listMembers(c)
		const member = refreshed.ok
			? refreshed.members.find((m) => m.userId === c.req.param('id'))
			: undefined
		return c.json(member ?? { id: c.req.param('id'), role })
	})

	router.delete('/members/:id', ...scoped, async (c) => {
		const { ok, status } = await internal(
			c, `/workspaces/members/${c.req.param('id')}`, 'member', { method: 'DELETE' },
		)
		if (!ok) return c.json({ message: 'Could not remove the member' }, status as never)
		return new Response(null, { status: 204 })
	})

	// ── organization ← workspaces ────────────────────────────────────────────

	const toOrganization = (w: IWorkspaceDTO) => ({
		id:          w.id,
		name:        w.name,
		slug:        w.slug,
		// A workspace has no logo field, so this is always null. If you want
		// organization logos, add a column and surface it here.
		logoUrl:     null,
		planId:      w.plan || 'free',
		trialEndsAt: null,
		createdAt:   w.createdAt,
	})

	router.get('/organization', ...scoped, async (c) => {
		const { ok, status, data } = await internal<IWorkspaceDTO>(
			c, `/workspaces/${ctx(c).workspace!.id}`, 'workspace',
		)
		if (!ok || !data) {
			return c.json({ message: 'Could not load the organization' }, status as never)
		}
		return c.json(toOrganization(data))
	})

	router.patch('/organization', ...scoped, async (c) => {
		const patch = await c.req.json<{ name?: string; description?: string | null }>()

		// Forward only what the workspace API validates. It rejects a body with no
		// recognised field, so an update carrying nothing else — a logo-only change,
		// say — would fail rather than no-op.
		const forwarded: Record<string, unknown> = {}
		if (patch.name !== undefined) forwarded['name'] = patch.name
		if (patch.description !== undefined) forwarded['description'] = patch.description

		if (Object.keys(forwarded).length === 0) {
			const current = await internal<IWorkspaceDTO>(
				c, `/workspaces/${ctx(c).workspace!.id}`, 'workspace',
			)
			return current.data
				? c.json(toOrganization(current.data))
				: c.json({ message: 'Could not load the organization' }, 502)
		}

		const { ok, status, data } = await send<IWorkspaceDTO>(
			c, '/workspaces', 'workspace', 'PUT', forwarded, schemas.updateWorkspaceSchema,
		)
		if (!ok || !data) {
			return c.json({ message: 'Could not update the organization' }, status as never)
		}
		return c.json(toOrganization(data))
	})

	// ── billing ──────────────────────────────────────────────────────────────

	router.get('/billing/plans', ...scoped, async (c) => {
		const { ok, status, data } = await internal<IPlanDTO[]>(c, '/plans', 'plans')
		if (!ok || !data) return c.json({ message: 'Could not load plans' }, status as never)

		return c.json(data.map((plan) => ({
			// The app keys plans by id and looks up 'free' | 'pro' | 'business'.
			id:           (plan.planId || plan.id || '').toLowerCase(),
			name:         plan.name,
			// Both sides use minor units (cents), so no conversion.
			priceMonthly: plan.pricing?.monthly ?? 0,
			priceYearly:  plan.pricing?.yearly ?? 0,
			currency:     plan.pricing?.currency ?? 'USD',
			// Shown verbatim: t() returns its argument when there is no translation,
			// so a plain sentence renders correctly.
			featureKeys:  (plan.features ?? []).filter((f) => f.enabled).map((f) => f.name),
			seatLimit:    plan.seats ?? null,
			projectLimit: (plan.metadata?.['projectLimit'] as number | null) ?? null,
		})))
	})

	router.get('/billing/subscription', ...scoped, async (c) => {
		const { data } = await internal<ISubscriptionDTO>(
			c, '/billing/subscription', 'subscription',
		)

		// No subscription is a normal state, not an error — the app renders the free
		// plan. Returning 404 here would surface as a crash banner.
		if (!data) {
			return c.json({
				planId: 'free', status: 'none', interval: 'month',
				currentPeriodEnd: null, cancelAtPeriodEnd: false, seats: 1,
			})
		}

		// Fonderie's status vocabulary is wider than the app's; anything the app
		// does not know about is treated as active rather than shown as an error.
		const STATUS: Record<string, string> = {
			trialing: 'trialing', active: 'active', past_due: 'past_due',
			canceled: 'canceled', cancelled: 'canceled', incomplete: 'past_due',
			unpaid: 'past_due', paused: 'canceled',
		}

		const members = await listMembers(c)
		return c.json({
			planId:            (data.plan || 'free').toLowerCase(),
			status:            STATUS[data.status] ?? 'active',
			interval:          data.interval === 'year' ? 'year' : 'month',
			currentPeriodEnd:  data.currentPeriodEnd || null,
			cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
			// Fonderie bills per subscription, not per seat, so the app shows the
			// number of people who actually have access.
			seats:             members.ok ? members.members.length : 1,
		})
	})

	// ── activity ← audit ─────────────────────────────────────────────────────

	// The audit log records raw event types; the app renders four known kinds.
	const ACTIVITY_TYPE: Record<string, string> = {
		'project.created':   'project.created',
		'project.completed': 'project.completed',
		'workspace.member.joined': 'member.joined',
		'billing.subscription.updated': 'billing.updated',
	}

	router.get('/activity', ...scoped, async (c) => {
		// The audit page is { events, nextCursor } — not { items }.
		const { ok, data } = await internal<IAuditEventDTO[]>(c, '/audit?limit=20', 'events')
		if (!ok || !data) return c.json([])

		return c.json(data.map((event) => {
			const payload = event.payload ?? {}
			return {
				id:             event.id,
				type:           ACTIVITY_TYPE[event.type] ?? 'project.created',
				actorName:      (payload['actorName'] as string) ?? 'Someone',
				actorAvatarUrl: null,
				subject:        (payload['name'] as string) ?? (payload['subject'] as string) ?? '',
				createdAt:      event.createdAt,
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
