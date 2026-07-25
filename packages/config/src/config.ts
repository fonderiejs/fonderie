export interface IConfigOptions {
	// How often to poll the DB for changes (ms)
	// Default: 30000 (30 seconds)
	ttl?: number;

	// Which environment to load
	// Default: process.env.NODE_ENV ?? 'development'
	environment?: string;

	// Table name override
	// Default: 'fonderie_config'
	table?: string;

	// Postgres connection string for LISTEN-based push invalidation. When set,
	// the manager opens a dedicated LISTEN client on `fonderie_config_changed`
	// and refreshes within milliseconds of any write (the `ttl` poll becomes a
	// slow safety floor). When unset, behaviour is unchanged (poll only).
	connectionUrl?: string;
}
