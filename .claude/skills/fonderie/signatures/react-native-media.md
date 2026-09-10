<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-native-media — signatures

## @fonderie/react-native-media

```ts
new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

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

interface IUploadMediaInput {
    dataBase64: string;
    purpose?: string;
    ownerType?: string;
    ownerId?: string;
}

new MediaClient(http: HttpClient, tokens: TokenStore): MediaClient
  .setAccessToken(token: string | undefined): void
  .upload(input: IUploadMediaInput): Promise<IApiResponse<IMediaAssetResult>>
  .delete(id: string): Promise<IApiResponse<{ id: string; }>>
  .assetUrl(id: string): string
  .assetIdFromUrl(url: string | null | undefined): string | null

interface IUseDeleteMediaReturn {
    remove: (id: string) => Promise<void>;
    isDeleting: boolean;
    error: FonderieApiError | null;
}

interface IUseUploadAvatarReturn {
    uploadAvatar: (file: Blob) => Promise<string>;
    isUploading: boolean;
    error: FonderieApiError | null;
}

interface IUseUploadMediaReturn {
    upload: (file: Blob, opts?: Omit<IUploadMediaInput, 'dataBase64'>) => Promise<IMediaAssetDTO>;
    isUploading: boolean;
    error: FonderieApiError | null;
}

function useDeleteMedia(client?: MediaClient | undefined): IUseDeleteMediaReturn

function useUploadAvatar(client?: FonderieClient | undefined): IUseUploadAvatarReturn

function useUploadMedia(client?: MediaClient | undefined): IUseUploadMediaReturn
```
