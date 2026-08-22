import type { IAddEmailInput, ICustomerEmailDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseCustomerEmailsReturn {
	emails: Ref<ICustomerEmailDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: () => Promise<void>;
	addEmail: (input: IAddEmailInput) => Promise<ICustomerEmailDTO>;
	updateEmailLabel: (emailId: string, label: string) => Promise<void>;
	setPrimaryEmail: (emailId: string) => Promise<void>;
	removeEmail: (emailId: string) => Promise<void>;
}

export function useCustomerEmails(customerId: string): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	clientOrCustomerId: CustomersClient | string | undefined,
	maybeCustomerId?: string,
): IUseCustomerEmailsReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeCustomerId as string) : clientOrCustomerId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerEmails');
	const emails = ref<ICustomerEmailDTO[]>([]);
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
			const { result } = await customers.listEmails(customerId);
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
			const { result } = await customers.addEmail(customerId, input);
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
			await customers.updateEmailLabel(customerId, emailId, label);
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
			await customers.setPrimaryEmail(customerId, emailId);
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
			await customers.removeEmail(customerId, emailId);
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
