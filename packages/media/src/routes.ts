import type { Middleware } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import { requireAuth } from '@fonderie/core/middlewares';
import type { IStoreAdapter } from '@fonderie/store';

import { DEFAULT_ALLOWED_TYPES, DEFAULT_MAX_BYTES, type IMediaConfig } from './config';
import { MediaAssetModel } from './models/asset.model';
import { toMediaAssetDTO } from './dtos/media';
import { decodeBase64, sniffImageType } from './services/image';

type Route = [string, string, ...Middleware[]];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildMediaRoutes(store: IStoreAdapter, config: IMediaConfig): Route[] {
	const assets = new MediaAssetModel(store);
	const maxBytes = config.maxBytes ?? DEFAULT_MAX_BYTES;
	const allowed = config.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

	return [
		// POST /media { dataBase64, ownerType?, ownerId?, purpose? } -> { asset }
		// Accepts base64 (bare or a data URI), verifies it's a real image by its
		// magic bytes (never the client's claim), caps the decoded size, stores
		// the bytes via the provider, and records metadata. Returns a URL.
		[
			'POST',
			'/media',
			requireAuth,
			async (ctx) => {
				const userId = ctx.user!.id;
				const body = (ctx.meta['body'] ?? {}) as {
					dataBase64?: unknown;
					ownerType?: unknown;
					ownerId?: unknown;
					purpose?: unknown;
				};

				if (typeof body.dataBase64 !== 'string' || body.dataBase64.length === 0) {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'dataBase64 (a base64 string) is required.');
				}

				let bytes: Uint8Array;
				try {
					bytes = decodeBase64(body.dataBase64);
				} catch {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'dataBase64 is not valid base64.');
				}
				if (bytes.byteLength === 0) {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'The image is empty.');
				}
				if (bytes.byteLength > maxBytes) {
					return setApiResponse(HTTP.UNPROCESSABLE, 'ASSET_TOO_LARGE', `Image exceeds the ${maxBytes}-byte limit.`);
				}

				const contentType = sniffImageType(bytes);
				if (!contentType || !allowed.includes(contentType)) {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'ASSET_UNSUPPORTED',
						`Unsupported image type. Allowed: ${allowed.join(', ')}.`,
					);
				}

				const ownerType = typeof body.ownerType === 'string' ? body.ownerType : 'user';
				const ownerId = typeof body.ownerId === 'string' ? body.ownerId : userId;
				const purpose = typeof body.purpose === 'string' ? body.purpose : 'avatar';

				const { ref } = await config.provider.put({ bytes, contentType });
				const asset = await assets.create({
					ownerType,
					ownerId,
					purpose,
					contentType,
					byteSize: bytes.byteLength,
					storageRef: ref,
					createdBy: userId,
				});

				// Build the URL at whatever prefix this route is mounted under
				// (e.g. '/v1/media/:id'), derived from the request path.
				const basePath = new URL(ctx.request.url).pathname.replace(/\/media$/, '');
				return setApiResponse(HTTP.OK, 'ASSET_CREATED', 'Asset uploaded.', {
					asset: toMediaAssetDTO(asset, basePath),
				});
			},
		],

		// GET /media/:id  (PUBLIC — an <img src> can't send an Authorization
		// header) -> the image bytes with cache headers, or a 302 to a
		// provider-served URL. Assets are immutable, so the id is a stable ETag.
		[
			'GET',
			'/media/:id',
			async (ctx) => {
				const id = ctx.meta.params?.['id'];
				if (!id || !UUID_RE.test(id)) return new Response('Not found', { status: 404 });

				const asset = await assets.get(id);
				if (!asset) return new Response('Not found', { status: 404 });

				const etag = `"${asset.id}"`;
				if (ctx.request.headers.get('if-none-match') === etag) {
					return new Response(null, { status: 304, headers: { ETag: etag } });
				}

				const fetched = await config.provider.get(asset.storageRef);
				if (!fetched) return new Response('Not found', { status: 404 });
				if (fetched.kind === 'redirect') {
					return new Response(null, { status: 302, headers: { Location: fetched.url } });
				}
				// Fresh Uint8Array (ArrayBuffer-backed) so it satisfies BodyInit; a
				// pg Buffer is typed Uint8Array<ArrayBufferLike>, which the lib rejects.
				return new Response(new Uint8Array(fetched.bytes), {
					status: 200,
					headers: {
						'Content-Type': asset.contentType,
						'Content-Length': String(asset.byteSize),
						'Cache-Control': 'public, max-age=300',
						ETag: etag,
					},
				});
			},
		],

		// DELETE /media/:id  -> removes the asset; only the uploader may delete it.
		[
			'DELETE',
			'/media/:id',
			requireAuth,
			async (ctx) => {
				const id = ctx.meta.params?.['id'];
				if (!id || !UUID_RE.test(id)) {
					return setApiResponse(HTTP.NOT_FOUND, 'ASSET_NOT_FOUND', 'No such asset.');
				}
				const asset = await assets.get(id);
				if (!asset) return setApiResponse(HTTP.NOT_FOUND, 'ASSET_NOT_FOUND', 'No such asset.');
				if (asset.createdBy !== ctx.user!.id) {
					return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'You can only delete assets you uploaded.');
				}
				await config.provider.delete(asset.storageRef);
				await assets.delete(id);
				return setApiResponse(HTTP.OK, 'ASSET_DELETED', 'Asset deleted.', { id });
			},
		],
	];
}
