// Opt-in S3-compatible provider (AWS S3 / MinIO / R2 / B2 / Spaces). Imported
// separately from the main entry so the AWS SDK peer is only loaded when used:
//   import { S3Provider } from '@fonderie/storage/s3'
export { S3Provider } from './providers/s3';
export type { IS3ProviderOptions } from './providers/s3';
