import type { ICustomerNoteDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseCustomerNotesReturn {
	notes: Ref<ICustomerNoteDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: () => Promise<void>;
	createNote: (body: string) => Promise<ICustomerNoteDTO>;
	updateNote: (noteId: string, body: string) => Promise<void>;
	deleteNote: (noteId: string) => Promise<void>;
}

export function useCustomerNotes(customerId: string): IUseCustomerNotesReturn;
export function useCustomerNotes(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerNotesReturn;
export function useCustomerNotes(
	clientOrCustomerId: CustomersClient | string | undefined,
	maybeCustomerId?: string,
): IUseCustomerNotesReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeCustomerId as string) : clientOrCustomerId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerNotes');
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
			const { result } = await customers.listNotes(customerId);
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
			const { result } = await customers.createNote(customerId, body);
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
			await customers.updateNote(customerId, noteId, body);
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
			await customers.deleteNote(customerId, noteId);
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
