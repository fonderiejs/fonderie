export interface IRemoteConfigOptions {
	// How often to poll the DB for changes (ms)
	// Default: 30000 (30 seconds)
	ttl?: number;

	// Which environment to load
	// Default: process.env.NODE_ENV ?? 'development'
	environment?: string;

	// Table name override
	// Default: 'fonderie_config'
	table?: string;
}
