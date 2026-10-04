import type { FonderieApiError, ICustomerNoteDTO } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

import type { ICustomerSectionOptions } from './section-options';

export interface IUseCustomerNotesReturn {
	notes: ICustomerNoteDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createNote: (body: string) => Promise<ICustomerNoteDTO>;
	updateNote: (noteId: string, body: string) => Promise<void>;
	deleteNote: (noteId: string) => Promise<void>;
}

const NONE: ICustomerNoteDTO[] = [];

// One customer's notes: shown at once when seen before, refreshed behind
// what is shown; any write under /customers marks it stale everywhere.
export function useCustomerNotes(customerId: string, opts?: ICustomerSectionOptions): IUseCustomerNotesReturn;
export function useCustomerNotes(
	client: CustomersClient | undefined,
	customerId: string,
	opts?: ICustomerSectionOptions,
): IUseCustomerNotesReturn;
export function useCustomerNotes(
	clientOrId: CustomersClient | string | undefined,
	maybeIdOrOpts?: string | ICustomerSectionOptions,
	maybeOpts?: ICustomerSectionOptions,
): IUseCustomerNotesReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeIdOrOpts as string) : clientOrId;
	const read = ((firstIsClient ? maybeOpts : maybeIdOrOpts) as ICustomerSectionOptions | undefined)?.read !== false;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerNotes');
	const q = useScopedQuery(
		customers,
		`/customers/${encodeURIComponent(customerId ?? '')}/notes`,
		async (bust) => (await customers.listNotes(customerId, { bust })).result.notes,
		// Nothing to read until there is a customer.
		{ enabled: !!customerId && read },
	);
	const w = useWrite(q.refresh);
	const createNote = useCallback(
		(body: string) =>
			w.run(async () => (await customers.createNote(customerId, body)).result.note),
		[customers, customerId, w.run],
	);
	const updateNote = useCallback(
		(noteId: string, body: string) =>
			w.run(async () => {
				await customers.updateNote(customerId, noteId, body);
			}),
		[customers, customerId, w.run],
	);
	const deleteNote = useCallback(
		(noteId: string) =>
			w.run(async () => {
				await customers.deleteNote(customerId, noteId);
			}),
		[customers, customerId, w.run],
	);
	return {
		notes: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		createNote, updateNote, deleteNote,
	};
}
