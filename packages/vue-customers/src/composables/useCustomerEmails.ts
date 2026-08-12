import type { CustomersClient, IAddEmailInput, ICustomerEmailDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useCustomerEmails(client: CustomersClient, customerId: string) {
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
			const { result } = await client.listEmails(customerId);
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
			const { result } = await client.addEmail(customerId, input);
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
			await client.updateEmailLabel(customerId, emailId, label);
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
			await client.setPrimaryEmail(customerId, emailId);
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
			await client.removeEmail(customerId, emailId);
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
