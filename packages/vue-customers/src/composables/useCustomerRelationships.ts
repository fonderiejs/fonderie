import type { IAddRelationshipInput, ICustomerRelationshipDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseCustomerRelationshipsReturn {
	relationships: Ref<ICustomerRelationshipDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addRelationship: (input: IAddRelationshipInput) => Promise<ICustomerRelationshipDTO>;
	setPrimaryRelationship: (relatedId: string) => Promise<void>;
	removeRelationship: (relatedId: string) => Promise<void>;
}

export function useCustomerRelationships(customerId: string): IUseCustomerRelationshipsReturn;
export function useCustomerRelationships(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerRelationshipsReturn;
export function useCustomerRelationships(
	clientOrCustomerId: CustomersClient | string | undefined,
	maybeCustomerId?: string,
): IUseCustomerRelationshipsReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeCustomerId as string) : clientOrCustomerId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerRelationships');
	const relationships = ref<ICustomerRelationshipDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		if (!customerId) {
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await customers.listRelationships(customerId, { bust: opts?.force });
			relationships.value = result.relationships;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function addRelationship(input: IAddRelationshipInput) {
		error.value = null;
		try {
			const { result } = await customers.addRelationship(customerId, input);
			await refresh();
			return result.relationship;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function setPrimaryRelationship(relatedId: string) {
		error.value = null;
		try {
			await customers.setPrimaryRelationship(customerId, relatedId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeRelationship(relatedId: string) {
		error.value = null;
		try {
			await customers.removeRelationship(customerId, relatedId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return {
		relationships,
		isLoading,
		error,
		refresh,
		addRelationship,
		setPrimaryRelationship,
		removeRelationship,
	};
}
