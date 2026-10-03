import type { ICustomerNoteDTO } from '@fonderie/client';
import { CustomersClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUseCustomerNotesReturn {
	notes: Ref<ICustomerNoteDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createNote: (body: string) => Promise<ICustomerNoteDTO>;
	updateNote: (noteId: string, body: string) => Promise<void>;
	deleteNote: (noteId: string) => Promise<void>;
}

export function useCustomerNotes(customerId: MaybeRefOrGetter<string>): IUseCustomerNotesReturn;
export function useCustomerNotes(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
): IUseCustomerNotesReturn;
export function useCustomerNotes(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	maybeCustomerId?: MaybeRefOrGetter<string>,
): IUseCustomerNotesReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (maybeCustomerId as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerNotes');
	// The key follows the id; an empty id reads nothing (not loading).
	const q = useScopedQuery(
		customers,
		() => `/customers/${encodeURIComponent(toValue(customerId))}/notes`,
		async (bust) => (await customers.listNotes(toValue(customerId), { bust })).result.notes,
		{ enabled: () => !!toValue(customerId) },
	);
	const w = useWrite(() => q.refresh());
	return {
		notes: computed(() => q.data.value ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		createNote: (body) => w.run(async () => (await customers.createNote(toValue(customerId), body)).result.note),
		updateNote: (noteId, body) =>
			w.run(async () => {
				await customers.updateNote(toValue(customerId), noteId, body);
			}),
		deleteNote: (noteId) =>
			w.run(async () => {
				await customers.deleteNote(toValue(customerId), noteId);
			}),
	};
}
