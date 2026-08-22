import type {
	ICustomerDetailD2DTO,
	ICustomerDetailDTO,
	IUpdateCustomerInput,
} from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseCustomerReturn {
	customer: Ref<ICustomerDetailDTO | ICustomerDetailD2DTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateCustomer: (input: IUpdateCustomerInput) => Promise<void>;
}

// depth 2 (default) nests relationships one level deeper than depth 1 — see
// ICustomerDetailD2DTO. Pass depth: 1 for a flatter shape.
export function useCustomer(customerId: string, depth?: 1 | 2): IUseCustomerReturn;
export function useCustomer(
	client: CustomersClient | undefined,
	customerId: string,
	depth?: 1 | 2,
): IUseCustomerReturn;
export function useCustomer(
	clientOrCustomerId: CustomersClient | string | undefined,
	customerIdOrDepth?: string | 1 | 2,
	maybeDepth?: 1 | 2,
): IUseCustomerReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (customerIdOrDepth as string) : clientOrCustomerId;
	const depth = (firstIsClient ? maybeDepth : (customerIdOrDepth as 1 | 2 | undefined)) ?? 2;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomer');
	const customer = ref<ICustomerDetailDTO | ICustomerDetailD2DTO | null>(null);
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
			const { result } = await customers.getCustomer(customerId, { depth }, { bust: opts?.force });
			customer.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function updateCustomer(input: IUpdateCustomerInput) {
		error.value = null;
		try {
			await customers.updateCustomer(customerId, input);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { customer, isLoading, error, refresh, updateCustomer };
}
