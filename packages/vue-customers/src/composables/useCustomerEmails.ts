import type { IAddEmailInput, ICustomerEmailDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseCustomerEmailsReturn {
	emails: Ref<ICustomerEmailDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addEmail: (input: IAddEmailInput) => Promise<ICustomerEmailDTO>;
	updateEmailLabel: (emailId: string, label: string) => Promise<void>;
	setPrimaryEmail: (emailId: string) => Promise<void>;
	removeEmail: (emailId: string) => Promise<void>;
}

export function useCustomerEmails(customerId: MaybeRefOrGetter<string>): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	maybeCustomerId?: MaybeRefOrGetter<string>,
): IUseCustomerEmailsReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (maybeCustomerId as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerEmails');
	const emails = ref<ICustomerEmailDTO[]>([]);
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
			const { result } = await customers.listEmails(toValue(customerId), { bust: opts?.force });
			emails.value = result.emails;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function addEmail(input: IAddEmailInput) {
		error.value = null;
		try {
			const { result } = await customers.addEmail(toValue(customerId), input);
			await refresh();
			return result.email;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function updateEmailLabel(emailId: string, label: string) {
		error.value = null;
		try {
			await customers.updateEmailLabel(toValue(customerId), emailId, label);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function setPrimaryEmail(emailId: string) {
		error.value = null;
		try {
			await customers.setPrimaryEmail(toValue(customerId), emailId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeEmail(emailId: string) {
		error.value = null;
		try {
			await customers.removeEmail(toValue(customerId), emailId);
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

	return {
		emails,
		isLoading,
		error,
		refresh,
		addEmail,
		updateEmailLabel,
		setPrimaryEmail,
		removeEmail,
	};
}
