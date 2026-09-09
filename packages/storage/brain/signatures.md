<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/storage — signatures

## @fonderie/storage

Subpath exports: `@fonderie/storage/s3`, `@fonderie/storage/migrations`

```ts
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
```
