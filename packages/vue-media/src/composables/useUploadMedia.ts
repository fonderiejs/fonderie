import type { IMediaAssetDTO, IUploadMediaInput, MediaClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

import { blobToBase64 } from '../lib/blobToBase64';

export interface IUseUploadMediaReturn {
	// Encode the file and POST it to /media; resolves to the stored asset (its id
	// + monomorphic /media/:id url). Extra fields (purpose, ownerType, ownerId)
	// default server-side to a self-owned 'avatar' when omitted.
	upload: (file: Blob, opts?: Omit<IUploadMediaInput, 'dataBase64'>) => Promise<IMediaAssetDTO>;
	isUploading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

// Generic image upload. For avatars, prefer useUploadAvatar — it also persists
// the URL to the user's profile and cleans up the previous avatar.
export function useUploadMedia(client?: MediaClient): IUseUploadMediaReturn {
	const media = useFonderieSubClient(client, (c) => c.media, 'useUploadMedia');
	const isUploading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function upload(
		file: Blob,
		opts?: Omit<IUploadMediaInput, 'dataBase64'>,
	): Promise<IMediaAssetDTO> {
		isUploading.value = true;
		error.value = null;
		try {
			const dataBase64 = await blobToBase64(file);
			const { result } = await media.upload({ dataBase64, ...opts });
			return result.asset;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isUploading.value = false;
		}
	}

	return { upload, isUploading, error };
}
