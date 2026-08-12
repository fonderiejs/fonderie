import type {
	CustomersClient,
	IAddRelationshipInput,
	ICustomerRelationshipDTO,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useCustomerRelationships(client: CustomersClient, customerId: string) {
	const relationships = ref<ICustomerRelationshipDTO[]>([]);
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
			const { result } = await client.listRelationships(customerId);
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
			const { result } = await client.addRelationship(customerId, input);
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
			await client.setPrimaryRelationship(customerId, relatedId);
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
			await client.removeRelationship(customerId, relatedId);
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
