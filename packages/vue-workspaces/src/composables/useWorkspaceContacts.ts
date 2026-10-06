import type {
	FonderieApiError,
	IAddWorkspaceEmailInput,
	IAddWorkspacePhoneInput,
	IUpdateWorkspaceEmailInput,
	IUpdateWorkspacePhoneInput,
	IWorkspaceContactsResult,
	IWorkspaceEmailDTO,
	IWorkspacePhoneDTO,
	WorkspacesClient,
} from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseWorkspaceContactsReturn {
	/** The primary first. */
	emails: Ref<IWorkspaceEmailDTO[]>;
	/** The primary first. */
	phones: Ref<IWorkspacePhoneDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addEmail: (input: IAddWorkspaceEmailInput) => Promise<void>;
	updateEmail: (emailId: string, input: IUpdateWorkspaceEmailInput) => Promise<void>;
	/** The primary goes last: 409 PRIMARY_REQUIRED while others remain. */
	removeEmail: (emailId: string) => Promise<void>;
	addPhone: (input: IAddWorkspacePhoneInput) => Promise<void>;
	updatePhone: (phoneId: string, input: IUpdateWorkspacePhoneInput) => Promise<void>;
	removePhone: (phoneId: string) => Promise<void>;
}

/** The key both contact composables share: one read serves the emails, phones and locations. */
export const WORKSPACE_CONTACTS_KEY = '/workspaces/contacts';

export const fetchWorkspaceContacts = async (api: WorkspacesClient, bust?: boolean): Promise<IWorkspaceContactsResult> =>
	(await api.getContacts({ bust })).result;

// The selected workspace's emails and phones — re-read on a workspace switch
// and after every change. Writes are for owners / managers.
export function useWorkspaceContacts(client?: WorkspacesClient): IUseWorkspaceContactsReturn {
	const api = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceContacts');
	const q = useScopedQuery(api, WORKSPACE_CONTACTS_KEY, (bust) => fetchWorkspaceContacts(api, bust));
	const w = useWrite(() => q.refresh());
	return {
		emails: computed(() => q.data.value?.emails ?? []),
		phones: computed(() => q.data.value?.phones ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		addEmail: (input) => w.run(async () => void (await api.addEmail(input))),
		updateEmail: (emailId, input) => w.run(async () => void (await api.updateEmail(emailId, input))),
		removeEmail: (emailId) => w.run(async () => void (await api.removeEmail(emailId))),
		addPhone: (input) => w.run(async () => void (await api.addPhone(input))),
		updatePhone: (phoneId, input) => w.run(async () => void (await api.updatePhone(phoneId, input))),
		removePhone: (phoneId) => w.run(async () => void (await api.removePhone(phoneId))),
	};
}
