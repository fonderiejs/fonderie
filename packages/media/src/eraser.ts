import type { IStorageProvider } from '@fonderie/storage';
import type { IStoreAdapter } from '@fonderie/store';

/** The person being erased, as the account-deletion purge describes them. */
export interface IMediaErasureSubject {
	userId: string;
	email: string | null;
	phone: string | null;
}

export interface IMediaErasureResult {
	/** Assets deleted (row and bytes). 0 on a repeat run. */
	erased: number;
	/** What was deliberately kept, and why — absent when nothing was. */
	kept?: string;
}

/** The shape the account-deletion purge calls, in-process, before the user row goes. */
export interface IMediaAccountEraser {
	readonly name: 'media';
	erase(subject: IMediaErasureSubject): Promise<IMediaErasureResult>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DeletedRow {
	id: string;
	owner_type: string;
	owner_id: string;
	purpose: string;
	content_type: string;
	byte_size: number;
	storage_ref: string;
	created_by: string | null;
	created_at: Date;
}

/**
 * Erase a person from media at account purge.
 *
 * - Assets the person OWNS (`owner_type 'user'`, `owner_id` = them — an avatar)
 *   are theirs: the row and the bytes go, so `GET /media/:id` stops serving them.
 * - Assets they UPLOADED for something else (a workspace logo, a customer photo)
 *   belong to that business: kept, with `created_by` set to NULL.
 *
 * Order per owned asset: the row is deleted first, in a statement that returns
 * its `storage_ref`, then the bytes — a crash never leaves a row pointing at
 * missing bytes. If the provider fails to delete some bytes, those rows are put
 * back (same id) and the call throws, so the purge's retry can still find the
 * bytes; without that, a failed delete would strand them with no handle.
 *
 * `provider` must be the one the media module stores bytes with — prefer
 * `mediaModule.accountEraser()`, which passes it for you. Idempotent: a second
 * run deletes nothing and returns `{ erased: 0 }`; a blob already gone is fine
 * (providers' `delete` is idempotent).
 */
export function accountEraser(
	store: IStoreAdapter,
	options: { provider: IStorageProvider },
): IMediaAccountEraser {
	const { provider } = options;
	return {
		name: 'media',
		async erase({ userId }) {
			// owner_id / created_by are UUID columns: no row can carry anything else.
			if (!UUID_RE.test(userId)) return { erased: 0 };

			const deleted = await store.query<DeletedRow>(
				`DELETE FROM fonderie_media_assets
				  WHERE owner_type = 'user' AND owner_id = $1
				  RETURNING *`,
				[userId],
			);

			const failed: Array<{ row: DeletedRow; error: unknown }> = [];
			for (const row of deleted) {
				try {
					await provider.delete(row.storage_ref);
				} catch (error) {
					failed.push({ row, error });
				}
			}
			if (failed.length > 0) {
				for (const { row } of failed) {
					await store.query(
						`INSERT INTO fonderie_media_assets
						   (id, owner_type, owner_id, purpose, content_type, byte_size, storage_ref, created_by, created_at)
						 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
						 ON CONFLICT (id) DO NOTHING`,
						[
							row.id,
							row.owner_type,
							row.owner_id,
							row.purpose,
							row.content_type,
							row.byte_size,
							row.storage_ref,
							row.created_by,
							row.created_at,
						],
					);
				}
				throw new Error(
					`media: could not delete ${failed.length} of ${deleted.length} stored object(s) via ` +
						`${provider.name}; their assets were restored for a retry`,
					{ cause: failed[0]!.error },
				);
			}

			const pseudonymized = await store.query<{ id: string }>(
				`UPDATE fonderie_media_assets SET created_by = NULL
				  WHERE created_by = $1
				  RETURNING id`,
				[userId],
			);

			const result: IMediaErasureResult = { erased: deleted.length };
			if (pseudonymized.length > 0) {
				result.kept =
					`${pseudonymized.length} asset(s) uploaded for another owner (workspace, customer, …) ` +
					'kept for that owner; uploader removed';
			}
			return result;
		},
	};
}
