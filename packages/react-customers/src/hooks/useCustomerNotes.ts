import type { ICustomerNoteDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
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

export function useCustomerNotes(customerId: string): IUseCustomerNotesReturn;
export function useCustomerNotes(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerNotesReturn;
export function useCustomerNotes(
	clientOrId: CustomersClient | string | undefined,
	maybeId?: string,
): IUseCustomerNotesReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeId as string) : clientOrId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerNotes');
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
			const { result } = await customers.listNotes(customerId);
			setNotes(result.notes);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [customers, customerId]);

	const createNote = useCallback(
		async (body: string) => {
			setError(null);
			try {
				const { result } = await customers.createNote(customerId, body);
				await refresh();
				return result.note;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	const updateNote = useCallback(
		async (noteId: string, body: string) => {
			setError(null);
			try {
				await customers.updateNote(customerId, noteId, body);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	const deleteNote = useCallback(
		async (noteId: string) => {
			setError(null);
			try {
				await customers.deleteNote(customerId, noteId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { notes, isLoading, error, refresh, createNote, updateNote, deleteNote };
}
