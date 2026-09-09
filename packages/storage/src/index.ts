// @fonderie/storage — content-agnostic, provider-abstracted object storage.
// The low-dependency foundation other bricks build on (media uploads, DB
// archives). Store any bytes; swap DbBlob → S3/MinIO with one config line.
//
// S3Provider is intentionally NOT exported here — import it from
// '@fonderie/storage/s3' so the AWS SDK is pulled in only when you use it.
export type { IStorageProvider, IFetched, IStoredRef } from './providers/types';
export { DbBlobProvider } from './providers/db-blob';
export { LocalFsProvider } from './providers/local-fs';
