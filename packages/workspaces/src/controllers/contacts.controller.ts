import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { toWorkspaceContactsDTO, toWorkspaceEmailDTO, toWorkspaceLocationDTO, toWorkspacePhoneDTO } from '../dtos/workspace';
import {
	ContactError,
	addEmail,
	addPhone,
	archiveLocation,
	createLocation,
	listContacts,
	removeEmail,
	removePhone,
	restoreLocation,
	updateEmail,
	updateLocation,
	updatePhone,
} from '../services/contacts';

// The workspace's emails, phones and locations — the workspace from
// X-Workspace-ID (wsCtx); members read, managers write (routes.ts).

type Body = Record<string, unknown>;

const param = (ctx: IFonderieContext, name: string) => (ctx.meta['params'] as Record<string, string> | undefined)?.[name] ?? '';
const body = (ctx: IFonderieContext) => (ctx.meta['body'] as Body | undefined) ?? {};

async function guarded(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (err) {
		if (err instanceof ContactError) return setApiResponse(err.status, err.reason, err.message);
		// A unique index caught what the checks under the lock did not.
		if ((err as { code?: string }).code === '23505') return setApiResponse(HTTP.CONFLICT, 'DUPLICATE', 'This is already on the workspace');
		throw err;
	}
}

export function contactsController(store: IStoreAdapter) {
	const noWorkspace = () => setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const contacts = await listContacts(ctx.workspace.id, store);
			return setApiResponse(HTTP.OK, 'WORKSPACE_CONTACTS_FETCHED', 'Workspace contacts retrieved.', toWorkspaceContactsDTO(contacts));
		},

		// ── Emails
		async addEmail(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const email = await addEmail(store, id, body(ctx) as Parameters<typeof addEmail>[2]);
				return setApiResponse(HTTP.CREATED, 'WORKSPACE_EMAIL_ADDED', 'Email added.', { email: toWorkspaceEmailDTO(email) });
			});
		},
		async updateEmail(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const email = await updateEmail(store, id, param(ctx, 'emailId'), body(ctx));
				return setApiResponse(HTTP.OK, 'WORKSPACE_EMAIL_UPDATED', 'Email updated.', { email: toWorkspaceEmailDTO(email) });
			});
		},
		async removeEmail(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				await removeEmail(store, id, param(ctx, 'emailId'));
				return setApiResponse(HTTP.OK, 'WORKSPACE_EMAIL_REMOVED', 'Email removed.', { deleted: true });
			});
		},

		// ── Phones
		async addPhone(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const phone = await addPhone(store, id, body(ctx) as Parameters<typeof addPhone>[2]);
				return setApiResponse(HTTP.CREATED, 'WORKSPACE_PHONE_ADDED', 'Phone added.', { phone: toWorkspacePhoneDTO(phone) });
			});
		},
		async updatePhone(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const phone = await updatePhone(store, id, param(ctx, 'phoneId'), body(ctx));
				return setApiResponse(HTTP.OK, 'WORKSPACE_PHONE_UPDATED', 'Phone updated.', { phone: toWorkspacePhoneDTO(phone) });
			});
		},
		async removePhone(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				await removePhone(store, id, param(ctx, 'phoneId'));
				return setApiResponse(HTTP.OK, 'WORKSPACE_PHONE_REMOVED', 'Phone removed.', { deleted: true });
			});
		},

		// ── Locations
		async createLocation(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const location = await createLocation(store, id, body(ctx) as unknown as Parameters<typeof createLocation>[2]);
				return setApiResponse(HTTP.CREATED, 'WORKSPACE_LOCATION_CREATED', 'Location added.', { location: toWorkspaceLocationDTO(location) });
			});
		},
		async updateLocation(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const location = await updateLocation(store, id, param(ctx, 'locationId'), body(ctx));
				return setApiResponse(HTTP.OK, 'WORKSPACE_LOCATION_UPDATED', 'Location updated.', { location: toWorkspaceLocationDTO(location) });
			});
		},
		async archiveLocation(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const location = await archiveLocation(store, id, param(ctx, 'locationId'), ctx.user?.id ?? null);
				return setApiResponse(HTTP.OK, 'WORKSPACE_LOCATION_ARCHIVED', 'Location archived.', { location: toWorkspaceLocationDTO(location) });
			});
		},
		async restoreLocation(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const location = await restoreLocation(store, id, param(ctx, 'locationId'));
				return setApiResponse(HTTP.OK, 'WORKSPACE_LOCATION_RESTORED', 'Location restored.', { location: toWorkspaceLocationDTO(location) });
			});
		},
	};
}
