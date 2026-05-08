export interface IConfigEntry {
	key:         string
	value:       unknown
	environment: string
	description: string | null
	active:      boolean
	updatedAt:   string
}

export interface IConfigSnapshot {
	entries:   Record<string, unknown>
	fetchedAt: Date
}
