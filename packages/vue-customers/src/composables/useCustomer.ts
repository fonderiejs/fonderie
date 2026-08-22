import type {
	ICustomerDetailD2DTO,
	ICustomerDetailDTO,
	IUpdateCustomerInput,
} from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseCustomerReturn {
	customer: Ref<ICustomerDetailDTO | ICustomerDetailD2DTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateCustomer: (input: IUpdateCustomerInput) => Promise<void>;
}

// depth 2 (default) nests relationships one level deeper than depth 1 — see
// ICustomerDetailD2DTO. Pass depth: 1 for a flatter shape.
export function useCustomer(
	customerId: MaybeRefOrGetter<string>,
	depth?: MaybeRefOrGetter<1 | 2>,
): IUseCustomerReturn;
export function useCustomer(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
	depth?: MaybeRefOrGetter<1 | 2>,
): IUseCustomerReturn;
export function useCustomer(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	customerIdOrDepth?: MaybeRefOrGetter<string> | MaybeRefOrGetter<1 | 2>,
	maybeDepth?: MaybeRefOrGetter<1 | 2>,
): IUseCustomerReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (customerIdOrDepth as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const depth = firstIsClient
		? maybeDepth
		: (customerIdOrDepth as MaybeRefOrGetter<1 | 2> | undefined);
	const resolveDepth = () => toValue(depth) ?? 2;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomer');
	const customer = ref<ICustomerDetailDTO | ICustomerDetailD2DTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		if (!toValue(customerId)) {
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await customers.getCustomer(
				toValue(customerId),
				{ depth: resolveDepth() },
				{ bust: opts?.force },
			);
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
			await customers.updateCustomer(toValue(customerId), input);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	onMounted(() => void refresh());
	watch(
		() => [toValue(customerId), toValue(depth)] as const,
		() => void refresh(),
	);

	return { customer, isLoading, error, refresh, updateCustomer };
}
