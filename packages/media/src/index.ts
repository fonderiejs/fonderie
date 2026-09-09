export { MediaModule } from './module';
export { DEFAULT_ALLOWED_TYPES, DEFAULT_MAX_BYTES } from './config';
export type { IMediaConfig } from './config';

// Storage providers — DbBlobProvider (zero infra) ships built in; implement
// IStorageProvider to add object storage without touching product code.
export { DbBlobProvider, LocalFsProvider } from './providers';
export type { IStorageProvider, IFetched, IStoredRef } from './providers';

// For server-side resolution (e.g. wiring a user's avatar URL) and custom flows.
export { MediaAssetModel } from './models/asset.model';
export { toMediaAssetDTO } from './dtos/media';
export type { IMediaAssetDTO } from './dtos/media';
export type { IMediaAsset, ICreateAssetInput } from './types';
export { decodeBase64, sniffImageType } from './services/image';
