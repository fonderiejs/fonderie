import type { FonderieClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

import { blobToBase64 } from '../lib/blobToBase64';

export interface IUseUploadAvatarReturn {
	// Upload a new avatar and set it as the user's profile image. Resolves to the
	// absolute avatar URL now stored on the profile (surfaced as
	// user.profileImageUrl).
	uploadAvatar: (file: Blob) => Promise<string>;
	isUploading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

// The one-call avatar flow every SaaS needs: encode → POST /media → set it as
// the profile avatar (updateProfile) → best-effort delete the PREVIOUS avatar
// asset so replaced images don't accumulate. Cleanup runs AFTER the swap so a
// failed upload never strands the account without an avatar. Resolves the whole
// FonderieClient because it touches both client.media and client.auth.
export function useUploadAvatar(client?: FonderieClient): IUseUploadAvatarReturn {
	const fonderie = useFonderieSubClient(client, (c) => c, 'useUploadAvatar');
	const isUploading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function uploadAvatar(file: Blob): Promise<string> {
		isUploading.value = true;
		error.value = null;
		try {
			// Capture the current avatar first, to clean it up after the swap.
			const me = await fonderie.auth.getUser();
			const priorUrl = me.result.user.profileImageUrl;

			const dataBase64 = await blobToBase64(file);
			const { result } = await fonderie.media.upload({ dataBase64, purpose: 'avatar' });
			const avatarUrl = fonderie.media.assetUrl(result.asset.id);
			await fonderie.auth.updateProfile({ avatarUrl });

			const priorId = fonderie.media.assetIdFromUrl(priorUrl);
			if (priorId && priorId !== result.asset.id) {
				// Best-effort: a failed cleanup leaves one orphan, never an error.
				await fonderie.media.delete(priorId).catch(() => undefined);
			}
			return avatarUrl;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isUploading.value = false;
		}
	}

	return { uploadAvatar, isUploading, error };
}
