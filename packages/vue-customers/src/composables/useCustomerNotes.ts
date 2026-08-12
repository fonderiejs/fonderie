import type { CustomersClient, ICustomerNoteDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useCustomerNotes(client: CustomersClient, customerId: string) {
	const notes = ref<ICustomerNoteDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		if (!customerId) {
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listNotes(customerId);
			notes.value = result.notes;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function createNote(body: string) {
		error.value = null;
		try {
			const { result } = await client.createNote(customerId, body);
			await refresh();
			return result.note;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function updateNote(noteId: string, body: string) {
		error.value = null;
		try {
			await client.updateNote(customerId, noteId, body);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function deleteNote(noteId: string) {
		error.value = null;
		try {
			await client.deleteNote(customerId, noteId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { notes, isLoading, error, refresh, createNote, updateNote, deleteNote };
}
