import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseCustomerTagsReturn {
	tags: Ref<string[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addTag: (tag: string) => Promise<void>;
	removeTag: (tag: string) => Promise<void>;
}

export function useCustomerTags(customerId: MaybeRefOrGetter<string>): IUseCustomerTagsReturn;
export function useCustomerTags(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
): IUseCustomerTagsReturn;
export function useCustomerTags(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	maybeCustomerId?: MaybeRefOrGetter<string>,
): IUseCustomerTagsReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (maybeCustomerId as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerTags');
	const tags = ref<string[]>([]);
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
			const { result } = await customers.listTags(toValue(customerId), { bust: opts?.force });
			tags.value = result.tags;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function addTag(tag: string) {
		error.value = null;
		try {
			await customers.addTag(toValue(customerId), tag);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeTag(tag: string) {
		error.value = null;
		try {
			await customers.removeTag(toValue(customerId), tag);
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
		() => toValue(customerId),
		() => void refresh(),
	);

	return { tags, isLoading, error, refresh, addTag, removeTag };
}
