import type { ISecretEncryptor } from './crypto';
import type { PublicConfigKeys } from './public';

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

	// Bearer token that guards the admin HTTP surface (`/admin/config/*`,
	// `/admin/secrets/*`). The admin routes are **only registered when this is
	// set** — no token, no exposed admin surface (fail-closed). Use a long random
	// value (`openssl rand -base64 32`); pass it as `Authorization: Bearer <token>`.
	adminToken?: string;

	// At-rest encryptor for secrets (see `createAesGcmEncryptor`). Defaults to
	// `noopEncryptor` (masked but plaintext at rest).
	secretEncryptor?: ISecretEncryptor;

	// Keys a frontend may read through the unauthenticated GET /config/public —
	// feature flags a screen renders on, settings a signed-out page needs. A
	// list, or a record of key → value to report while the key is unset.
	// Default: none (the route answers an empty object). Never list anything a
	// stranger should not see; secrets are never readable through this route.
	publicKeys?: PublicConfigKeys;
}
