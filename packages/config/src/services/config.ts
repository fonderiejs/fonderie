import type { IStoreAdapter } from '@fonderie/store';

import type { IConfigEntry } from '../types';

const SELECT_ENTRY = `
	SELECT
		key,
		value,
		environment,
		description,
		active,
		updated_at AS "updatedAt"
	FROM fonderie_config`;

export async function listConfigEntries(
	environment: string | null,
	store: IStoreAdapter,
): Promise<IConfigEntry[]> {
	return environment
		? store.query<IConfigEntry>(
				`${SELECT_ENTRY} WHERE (environment = $1 OR environment = 'all') AND active = true ORDER BY key`,
				[environment],
			)
		: store.query<IConfigEntry>(`${SELECT_ENTRY} ORDER BY environment, key`);
}

export async function getConfigEntry(
	key: string,
	environment: string,
	store: IStoreAdapter,
): Promise<IConfigEntry | null> {
	const [row] = await store.query<IConfigEntry>(
		`${SELECT_ENTRY} WHERE key = $1 AND environment = $2`,
		[key, environment],
	);
	return row ?? null;
}

export async function setConfigEntry(
	opts: {
		key: string;
		value: unknown;
		environment?: string;
		description?: string;
		active?: boolean;
	},
	store: IStoreAdapter,
): Promise<IConfigEntry> {
	const env = opts.environment ?? 'all';
	const raw = typeof opts.value === 'string' ? opts.value : JSON.stringify(opts.value);
	const active = opts.active ?? true;

	const [row] = await store.query<IConfigEntry>(
		`INSERT INTO fonderie_config (key, value, environment, description, active)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (key, environment) DO UPDATE SET
			value       = $2,
			description = COALESCE($4, fonderie_config.description),
			active      = $5,
			updated_at  = now()
		RETURNING
			key, value, environment, description, active,
			updated_at AS "updatedAt"`,
		[opts.key, raw, env, opts.description ?? null, active],
	);
	if (!row) throw new Error('Failed to upsert config entry');
	return row;
}

export async function deleteConfigEntry(
	key: string,
	environment: string,
	store: IStoreAdapter,
): Promise<boolean> {
	const rows = await store.query<{ key: string }>(
		`DELETE FROM fonderie_config WHERE key = $1 AND environment = $2 RETURNING key`,
		[key, environment],
	);
	return rows.length > 0;
}
