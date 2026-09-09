import type { IStoreAdapter } from '@fonderie/store';

import type { ICreateAssetInput, IMediaAsset } from '../types';

interface AssetRow {
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

const toAsset = (r: AssetRow): IMediaAsset => ({
	id: r.id,
	ownerType: r.owner_type,
	ownerId: r.owner_id,
	purpose: r.purpose,
	contentType: r.content_type,
	byteSize: r.byte_size,
	storageRef: r.storage_ref,
	createdBy: r.created_by,
	createdAt: r.created_at,
});

/** Data access for `fonderie_media_assets` — the metadata around each stored blob. */
export class MediaAssetModel {
	constructor(private readonly store: IStoreAdapter) {}

	async create(input: ICreateAssetInput): Promise<IMediaAsset> {
		const rows = await this.store.query<AssetRow>(
			`INSERT INTO fonderie_media_assets
			   (owner_type, owner_id, purpose, content_type, byte_size, storage_ref, created_by)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING *`,
			[input.ownerType, input.ownerId, input.purpose, input.contentType, input.byteSize, input.storageRef, input.createdBy],
		);
		return toAsset(rows[0]!);
	}

	async get(id: string): Promise<IMediaAsset | null> {
		const rows = await this.store.query<AssetRow>('SELECT * FROM fonderie_media_assets WHERE id = $1', [id]);
		return rows[0] ? toAsset(rows[0]) : null;
	}

	/** The most recent asset for an owner + purpose (e.g. a user's current avatar). */
	async latestFor(ownerType: string, ownerId: string, purpose: string): Promise<IMediaAsset | null> {
		const rows = await this.store.query<AssetRow>(
			`SELECT * FROM fonderie_media_assets
			   WHERE owner_type = $1 AND owner_id = $2 AND purpose = $3
			   ORDER BY created_at DESC LIMIT 1`,
			[ownerType, ownerId, purpose],
		);
		return rows[0] ? toAsset(rows[0]) : null;
	}

	async delete(id: string): Promise<void> {
		await this.store.query('DELETE FROM fonderie_media_assets WHERE id = $1', [id]);
	}
}
