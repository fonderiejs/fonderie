import { randomUUID } from 'node:crypto';

import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { IFetched, IStorageProvider, IStoredRef } from './types';

export interface IS3ProviderOptions {
	/** Target bucket. Must already exist. */
	bucket: string;
	region?: string;
	/**
	 * Custom endpoint for S3-compatible services. Set this for MinIO / R2 / B2 /
	 * Spaces (e.g. `http://localhost:9000`); omit for AWS S3. When set,
	 * path-style addressing is enabled by default (what MinIO expects).
	 */
	endpoint?: string;
	forcePathStyle?: boolean;
	accessKeyId?: string;
	secretAccessKey?: string;
	/** How long a presigned GET URL stays valid, in seconds. Default 300. */
	presignTtlSeconds?: number;
	/** Optional key prefix, e.g. 'avatars/' or 'archive/'. */
	keyPrefix?: string;
}

/**
 * Object-storage provider for any S3-compatible service — AWS S3, **MinIO**,
 * Cloudflare R2, Backblaze B2, DigitalOcean Spaces. They're one provider
 * parameterized by `endpoint`; MinIO is just `endpoint: 'http://minio:9000'`.
 *
 * `get` returns a **presigned redirect URL** rather than bytes, so the app
 * hands the client straight to the object store / CDN and never proxies the
 * payload — the point of moving off DB blobs at scale.
 *
 * Requires the `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` optional
 * peers; import from `@fonderie/storage/s3` only when you actually use it, so
 * DbBlob / LocalFs consumers never pull the AWS SDK.
 */
export class S3Provider implements IStorageProvider {
	readonly name = 's3';
	private readonly client: S3Client;
	private readonly bucket: string;
	private readonly ttl: number;
	private readonly prefix: string;

	constructor(opts: IS3ProviderOptions) {
		this.bucket = opts.bucket;
		this.ttl = opts.presignTtlSeconds ?? 300;
		this.prefix = opts.keyPrefix ?? '';
		this.client = new S3Client({
			region: opts.region ?? 'us-east-1',
			...(opts.endpoint
				? { endpoint: opts.endpoint, forcePathStyle: opts.forcePathStyle ?? true }
				: {}),
			...(opts.accessKeyId && opts.secretAccessKey
				? { credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey } }
				: {}),
		});
	}

	async put({ bytes, contentType }: { bytes: Uint8Array; contentType: string }): Promise<IStoredRef> {
		const ref = `${this.prefix}${randomUUID()}`;
		await this.client.send(
			new PutObjectCommand({ Bucket: this.bucket, Key: ref, Body: bytes, ContentType: contentType }),
		);
		return { ref };
	}

	async get(ref: string): Promise<IFetched | null> {
		// A presigned URL doesn't verify existence — a deleted key simply 404s at
		// the store when the client follows the redirect. Callers that hold their
		// own metadata row (e.g. media) have already confirmed the asset exists.
		const url = await getSignedUrl(
			this.client,
			new GetObjectCommand({ Bucket: this.bucket, Key: ref }),
			{ expiresIn: this.ttl },
		);
		return { kind: 'redirect', url };
	}

	async delete(ref: string): Promise<void> {
		await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: ref }));
	}
}
