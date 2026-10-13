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
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback, useMemo } from 'react';

export interface IUseWorkspaceContactsReturn {
	/** The primary first. */
	emails: IWorkspaceEmailDTO[];
	/** The primary first. */
	phones: IWorkspacePhoneDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addEmail: (input: IAddWorkspaceEmailInput) => Promise<void>;
	updateEmail: (emailId: string, input: IUpdateWorkspaceEmailInput) => Promise<void>;
	/** The primary goes last: 409 PRIMARY_REQUIRED while others remain. */
	removeEmail: (emailId: string) => Promise<void>;
	addPhone: (input: IAddWorkspacePhoneInput) => Promise<void>;
	updatePhone: (phoneId: string, input: IUpdateWorkspacePhoneInput) => Promise<void>;
	removePhone: (phoneId: string) => Promise<void>;
}

const NO_EMAILS: IWorkspaceEmailDTO[] = [];
const NO_PHONES: IWorkspacePhoneDTO[] = [];

/** The key both contact hooks share: one read serves the emails, phones and locations. */
export const WORKSPACE_CONTACTS_KEY = '/workspaces/contacts';

export const fetchWorkspaceContacts = async (api: WorkspacesClient, bust?: boolean): Promise<IWorkspaceContactsResult> =>
	(await api.getContacts({ bust })).result;

// The selected workspace's emails and phones — re-read on a workspace switch
// and after every change (a change also re-reads the workspace, whose email /
// phone mirror the primary ones). Writes are for owners / managers.
/** Narrow to one branch's contacts; the read stays shared (one request serves every branch). */
export interface IWorkspaceContactsOptions {
	branchId?: string;
}

export function useWorkspaceContacts(client?: WorkspacesClient, opts?: IWorkspaceContactsOptions): IUseWorkspaceContactsReturn {
	const api = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceContacts');
	const q = useScopedQuery(api, WORKSPACE_CONTACTS_KEY, (bust) => fetchWorkspaceContacts(api, bust));
	const w = useWrite(q.refresh);
	const addEmail = useCallback((input: IAddWorkspaceEmailInput) => w.run(async () => void (await api.addEmail(input))), [api, w.run]);
	const updateEmail = useCallback(
		(emailId: string, input: IUpdateWorkspaceEmailInput) => w.run(async () => void (await api.updateEmail(emailId, input))),
		[api, w.run],
	);
	const removeEmail = useCallback((emailId: string) => w.run(async () => void (await api.removeEmail(emailId))), [api, w.run]);
	const addPhone = useCallback((input: IAddWorkspacePhoneInput) => w.run(async () => void (await api.addPhone(input))), [api, w.run]);
	const updatePhone = useCallback(
		(phoneId: string, input: IUpdateWorkspacePhoneInput) => w.run(async () => void (await api.updatePhone(phoneId, input))),
		[api, w.run],
	);
	const removePhone = useCallback((phoneId: string) => w.run(async () => void (await api.removePhone(phoneId))), [api, w.run]);
	const branchId = opts?.branchId;
	const emails = useMemo(() => (branchId ? (q.data?.emails ?? NO_EMAILS).filter((e) => e.branchId === branchId) : (q.data?.emails ?? NO_EMAILS)), [q.data, branchId]);
	const phones = useMemo(() => (branchId ? (q.data?.phones ?? NO_PHONES).filter((p) => p.branchId === branchId) : (q.data?.phones ?? NO_PHONES)), [q.data, branchId]);
	return {
		emails,
		phones,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		addEmail,
		updateEmail,
		removeEmail,
		addPhone,
		updatePhone,
		removePhone,
	};
}
