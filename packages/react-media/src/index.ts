export type { IMediaAssetDTO, IUploadMediaInput, MediaClient } from '@fonderie/client';
export { FonderieApiError } from '@fonderie/client';
export type {
	IUseDeleteMediaReturn,
	IUseUploadAvatarReturn,
	IUseUploadMediaReturn,
} from './hooks';
export { useDeleteMedia, useUploadAvatar, useUploadMedia } from './hooks';
