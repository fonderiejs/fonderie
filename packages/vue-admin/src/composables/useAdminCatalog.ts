import type {
	BillingAdminClient,
	IAdminCatalog,
	IAdminPlanInput,
	IPlanDTO,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// What am I selling — as configured and as stored — with the stored side editable.
export function useAdminCatalog(client: BillingAdminClient) {
	const catalog = ref<IAdminCatalog | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);
	const toError = (err: unknown) =>
		err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.catalog();
			catalog.value = result;
		} catch (err) {
			error.value = toError(err);
		} finally {
			isLoading.value = false;
		}
	}

	async function write<T>(fn: () => Promise<{ result: T }>): Promise<T> {
		error.value = null;
		try {
			const { result } = await fn();
			await refresh();
			return result;
		} catch (err) {
			const e = toError(err);
			error.value = e;
			throw e;
		}
	}

	void refresh();

	return {
		catalog,
		isLoading,
		error,
		refresh,
		createPlan: (input: IAdminPlanInput & { name: string }): Promise<IPlanDTO> =>
			write(() => client.createPlan(input)),
		updatePlan: (planId: string, input: IAdminPlanInput): Promise<IPlanDTO> =>
			write(() => client.updatePlan(planId, input)),
		deletePlan: async (planId: string): Promise<void> => {
			await write(() => client.deletePlan(planId));
		},
	};
}
