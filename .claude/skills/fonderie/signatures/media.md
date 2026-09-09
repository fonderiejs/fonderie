<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/media — signatures

## @fonderie/media

Subpath exports: `@fonderie/media/migrations`

```ts
new MediaModule(store: IStoreAdapter, config: IMediaConfig): MediaModule
  .name: "@fonderie/media"
  .deps: string[]
  .install(app: IFonderieApp): void

const DEFAULT_ALLOWED_TYPES: string[]

const DEFAULT_MAX_BYTES: 1000000

interface IMediaConfig {
    provider: IStorageProvider;
    maxBytes?: number;
    allowedTypes?: string[];
}

new DbBlobProvider(store: IStoreAdapter): DbBlobProvider
  .name: "db-blob"
  .put({ bytes }: { bytes: Uint8Array<ArrayBufferLike>; contentType: string; }): Promise<IStoredRef>
  .get(ref: string): Promise<IFetched | null>
  .delete(ref: string): Promise<void>

new LocalFsProvider(dir: string): LocalFsProvider
  .name: "local-fs"
  .put({ bytes }: { bytes: Uint8Array<ArrayBufferLike>; contentType: string; }): Promise<IStoredRef>
  .get(ref: string): Promise<IFetched | null>
  .delete(ref: string): Promise<void>

interface IStorageProvider {
    readonly name: string;
    put(input: {
        bytes: Uint8Array;
        contentType: string;
    }): Promise<IStoredRef>;
    get(ref: string): Promise<IFetched | null>;
    delete(ref: string): Promise<void>;
}

type IFetched = {
    kind: 'bytes';
    bytes: Uint8Array;
} | {
    kind: 'redirect';
    url: string;
};

interface IStoredRef {
    ref: string;
}

new MediaAssetModel(store: IStoreAdapter): MediaAssetModel
  .create(input: ICreateAssetInput): Promise<IMediaAsset>
  .get(id: string): Promise<IMediaAsset | null>
  .latestFor(ownerType: string, ownerId: string, purpose: string): Promise<IMediaAsset | null>
  .delete(id: string): Promise<void>

function toMediaAssetDTO(asset: IMediaAsset, basePath?: string): IMediaAssetDTO

interface IMediaAssetDTO {
    id: string;
    url: string;
    contentType: string;
    byteSize: number;
    ownerType: string;
    ownerId: string;
    purpose: string;
    createdAt: string;
}

interface IMediaAsset {
    id: string;
    ownerType: string;
    ownerId: string;
    purpose: string;
    contentType: string;
    byteSize: number;
    storageRef: string;
    createdBy: string | null;
    createdAt: Date;
}

interface ICreateAssetInput {
    ownerType: string;
    ownerId: string;
    purpose: string;
    contentType: string;
    byteSize: number;
    storageRef: string;
    createdBy: string | null;
}

function decodeBase64(input: string): Uint8Array<ArrayBufferLike>

function sniffImageType(bytes: Uint8Array<ArrayBufferLike>): string | null
```
