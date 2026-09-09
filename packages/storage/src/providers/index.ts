// Zero-infra providers only — S3Provider lives at '@fonderie/storage/s3' so the
// AWS SDK stays out of the default import path.
export type { IStorageProvider, IFetched, IStoredRef } from './types';
export { DbBlobProvider } from './db-blob';
export { LocalFsProvider } from './local-fs';
