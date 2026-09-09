import type { IStorageProvider } from './providers/types';

export interface IMediaConfig {
	/** Where bytes are stored. `DbBlobProvider` (zero infra) by default; swap for S3 at scale. */
	provider: IStorageProvider;
	/** Max decoded size per asset, in bytes. Default 1 MB. */
	maxBytes?: number;
	/**
	 * Content types accepted on upload (matched against magic bytes, not the
	 * client's claim). Default: PNG / JPEG / WebP / GIF. SVG is never accepted —
	 * it's a stored-XSS vector.
	 */
	allowedTypes?: string[];
}

export const DEFAULT_MAX_BYTES = 1_000_000;
export const DEFAULT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
