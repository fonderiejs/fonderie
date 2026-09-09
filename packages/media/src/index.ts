export { MediaModule } from './module';
export { DEFAULT_ALLOWED_TYPES, DEFAULT_MAX_BYTES } from './config';
export type { IMediaConfig } from './config';

// Storage lives in @fonderie/storage now; re-exported here for convenience so
// existing consumers can keep importing the zero-infra providers from media.
// S3Provider (the object-storage backend) is at '@fonderie/storage/s3'.
export { DbBlobProvider, LocalFsProvider } from '@fonderie/storage';
export type { IStorageProvider, IFetched, IStoredRef } from '@fonderie/storage';

// For server-side resolution (e.g. wiring a user's avatar URL) and custom flows.
export { MediaAssetModel } from './models/asset.model';
export { toMediaAssetDTO } from './dtos/media';
export type { IMediaAssetDTO } from './dtos/media';
export type { IMediaAsset, ICreateAssetInput } from './types';
export { decodeBase64, sniffImageType } from './services/image';
