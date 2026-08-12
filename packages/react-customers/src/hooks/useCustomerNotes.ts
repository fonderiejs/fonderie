import type { CustomersClient, ICustomerNoteDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerNotesReturn {
	notes: ICustomerNoteDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	createNote: (body: string) => Promise<ICustomerNoteDTO>;
	updateNote: (noteId: string, body: string) => Promise<void>;
	deleteNote: (noteId: string) => Promise<void>;
}

export function useCustomerNotes(
	client: CustomersClient,
	customerId: string,
): IUseCustomerNotesReturn {
	const [notes, setNotes] = useState<ICustomerNoteDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		if (!customerId) {
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listNotes(customerId);
			setNotes(result.notes);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, customerId]);

	const createNote = useCallback(
		async (body: string) => {
			setError(null);
			try {
				const { result } = await client.createNote(customerId, body);
				await refresh();
				return result.note;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	const updateNote = useCallback(
		async (noteId: string, body: string) => {
			setError(null);
			try {
				await client.updateNote(customerId, noteId, body);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	const deleteNote = useCallback(
		async (noteId: string) => {
			setError(null);
			try {
				await client.deleteNote(customerId, noteId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { notes, isLoading, error, refresh, createNote, updateNote, deleteNote };
}
