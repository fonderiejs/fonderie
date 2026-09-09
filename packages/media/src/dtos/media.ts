import type { IMediaAsset } from '../types';

/**
 * The wire shape for a stored asset. `url` is the monomorphic read contract:
 * always a `/media/:id` path, whatever the backend — clients render it in an
 * `<img>` and never care whether the bytes came from Postgres, disk, or S3.
 */
export interface IMediaAssetDTO {
	id: string;
	url: string;
	contentType: string;
	byteSize: number;
	ownerType: string;
	ownerId: string;
	purpose: string;
	createdAt: string;
}

/** basePath is the router mount (e.g. '/v1'); '' yields a root-relative '/media/:id'. */
export function toMediaAssetDTO(asset: IMediaAsset, basePath = ''): IMediaAssetDTO {
	return {
		id: asset.id,
		url: `${basePath}/media/${asset.id}`,
		contentType: asset.contentType,
		byteSize: asset.byteSize,
		ownerType: asset.ownerType,
		ownerId: asset.ownerId,
		purpose: asset.purpose,
		createdAt: asset.createdAt instanceof Date ? asset.createdAt.toISOString() : String(asset.createdAt),
	};
}
