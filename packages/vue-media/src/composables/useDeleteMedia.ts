import type { MediaClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseDeleteMediaReturn {
	remove: (id: string) => Promise<void>;
	isDeleting: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

// Delete an asset you uploaded (DELETE /media/:id — uploader-only server-side).
export function useDeleteMedia(client?: MediaClient): IUseDeleteMediaReturn {
	const media = useFonderieSubClient(client, (c) => c.media, 'useDeleteMedia');
	const isDeleting = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function remove(id: string): Promise<void> {
		isDeleting.value = true;
		error.value = null;
		try {
			await media.delete(id);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isDeleting.value = false;
		}
	}

	return { remove, isDeleting, error };
}
