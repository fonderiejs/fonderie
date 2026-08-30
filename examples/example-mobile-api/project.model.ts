import type { IStoreAdapter } from '@fonderie/store';

/** Matches the Project type the mobile app expects, field for field. */
export interface Project {
	id:             string
	organizationId: string
	name:           string
	description:    string | null
	status:         'active' | 'paused' | 'completed' | 'archived'
	progress:       number
	ownerId:        string
	memberIds:      string[]
	dueAt:          string | null
	createdAt:      string
	updatedAt:      string
}

export interface ProjectFilters {
	search?: string
	status?: string
	sortBy?: 'updatedAt' | 'name' | 'dueAt' | 'progress'
	sortDir?: 'asc' | 'desc'
	cursor?: string
	limit?: number
}

// Whitelisted so a sort parameter can never reach the SQL string. Interpolating
// the raw value here would be an injection hole — ORDER BY cannot be parameterised.
const SORT_COLUMN = {
	updatedAt: 'updated_at',
	name:      'name',
	dueAt:     'due_at',
	progress:  'progress',
} as const

const SELECT = `
	id,
	workspace_id AS "organizationId",
	name,
	description,
	status,
	progress,
	owner_id     AS "ownerId",
	member_ids   AS "memberIds",
	due_at       AS "dueAt",
	created_at   AS "createdAt",
	updated_at   AS "updatedAt"
`

export function ProjectModel(store: IStoreAdapter) {
	return {
		async list(workspaceId: string, filters: ProjectFilters) {
			const limit  = Math.min(filters.limit ?? 20, 100)
			const offset = filters.cursor ? Number(filters.cursor) : 0
			const column = SORT_COLUMN[filters.sortBy ?? 'updatedAt']
			const dir    = filters.sortDir === 'asc' ? 'ASC' : 'DESC'

			const where: string[] = ['workspace_id = $1']
			const params: unknown[] = [workspaceId]

			if (filters.status && filters.status !== 'all') {
				params.push(filters.status)
				where.push(`status = $${params.length}`)
			}
			if (filters.search) {
				params.push(`%${filters.search}%`)
				where.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`)
			}

			const clause = where.join(' AND ')

			const [{ count }] = await store.query<{ count: string }>(
				`SELECT COUNT(*)::text AS count FROM projects WHERE ${clause}`,
				params,
			)

			const rows = await store.query<Project>(
				`SELECT ${SELECT} FROM projects WHERE ${clause}
				 ORDER BY ${column} ${dir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
				[...params, limit, offset],
			)

			const total = Number(count)
			return {
				items: rows,
				// Offset-based, which is fine at this scale. For a large table use a
				// keyset cursor instead, or rows shift under a user mid-scroll.
				nextCursor: offset + limit < total ? String(offset + limit) : null,
				total,
			}
		},

		async get(workspaceId: string, id: string): Promise<Project | null> {
			const [row] = await store.query<Project>(
				`SELECT ${SELECT} FROM projects WHERE workspace_id = $1 AND id = $2`,
				[workspaceId, id],
			)
			return row ?? null
		},

		async create(
			workspaceId: string,
			ownerId: string,
			input: { name: string; description: string | null; status: string; dueAt: string | null },
		): Promise<Project> {
			const [row] = await store.query<Project>(
				`INSERT INTO projects (workspace_id, owner_id, name, description, status, due_at)
				 VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${SELECT}`,
				[workspaceId, ownerId, input.name, input.description, input.status, input.dueAt],
			)
			return row!
		},

		async update(
			workspaceId: string,
			id: string,
			patch: Record<string, unknown>,
		): Promise<Project | null> {
			const COLUMN: Record<string, string> = {
				name: 'name', description: 'description', status: 'status',
				progress: 'progress', dueAt: 'due_at',
			}

			const sets: string[] = []
			const params: unknown[] = [workspaceId, id]
			for (const [key, value] of Object.entries(patch)) {
				const column = COLUMN[key]
				// Unknown keys are ignored rather than trusted into the statement.
				if (!column) continue
				params.push(value)
				sets.push(`${column} = $${params.length}`)
			}
			if (sets.length === 0) return this.get(workspaceId, id)

			sets.push('updated_at = now()')
			const [row] = await store.query<Project>(
				`UPDATE projects SET ${sets.join(', ')}
				 WHERE workspace_id = $1 AND id = $2 RETURNING ${SELECT}`,
				params,
			)
			return row ?? null
		},

		async remove(workspaceId: string, id: string): Promise<boolean> {
			const [row] = await store.query<{ id: string }>(
				'DELETE FROM projects WHERE workspace_id = $1 AND id = $2 RETURNING id',
				[workspaceId, id],
			)
			return row !== undefined
		},
	}
}
