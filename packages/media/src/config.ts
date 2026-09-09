import type { IFonderieContext } from '@fonderie/core';
import type { IStorageProvider } from '@fonderie/storage';

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
	/**
	 * Authorize an upload's target owner. Return false to reject with 403. When
	 * omitted, the default policy allows only **self-owned user assets**
	 * (`ownerType: 'user'`, `ownerId` = the authenticated caller). Provide this
	 * to permit other owners — e.g. a workspace logo the caller may administer, a
	 * customer photo in the caller's workspace.
	 */
	authorizeOwner?(
		ctx: IFonderieContext,
		owner: { ownerType: string; ownerId: string },
	): boolean | Promise<boolean>;
}

export const DEFAULT_MAX_BYTES = 1_000_000;
export const DEFAULT_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
