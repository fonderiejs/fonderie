import type { IFonderieContext } from '@fonderie-js/core';
import { HTTP, setApiResponse } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';
import { toCustomerNoteDTO } from '../dtos/customer';
import { CustomerModel } from '../models/customer.model';
import { CustomerNoteModel } from '../models/customer-note.model';

export function customerNoteController(store: IStoreAdapter) {
	const customers = new CustomerModel(store);
	const notes = new CustomerNoteModel(store);

	async function resolveCustomer(ctx: IFonderieContext) {
		const workspaceId = ctx.meta['workspaceId'];
		if (!workspaceId)
			return {
				error: setApiResponse(
					HTTP.BAD_REQUEST,
					'MISSING_WORKSPACE',
					'Workspace context is required',
				),
			};

		const params = ctx.meta['params'] as Record<string, string> | undefined;
		const id = params?.['id'];
		if (!id)
			return { error: setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'id is required') };

		const customer = await customers.findById(id, workspaceId);
		if (!customer)
			return { error: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found') };

		return { customer, workspaceId };
	}

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const list = await notes.list(r.customer.id);
			return setApiResponse(HTTP.OK, 'NOTES_FETCHED', 'Notes retrieved successfully.', {
				notes: list.map(toCustomerNoteDTO),
			});
		},

		async create(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const bodyText = body?.['body'];
			if (typeof bodyText !== 'string' || bodyText.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'body is required');
			}

			const note = await notes.create({
				customerId: r.customer.id,
				authorId: ctx.user?.id ?? null,
				body: bodyText.trim(),
			});

			return setApiResponse(HTTP.CREATED, 'NOTE_CREATED', 'Note created successfully.', {
				note: toCustomerNoteDTO(note),
			});
		},

		async update(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const noteId = params?.['noteId'];
			if (!noteId) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'noteId is required');
			}

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const bodyText = body?.['body'];
			if (typeof bodyText !== 'string' || bodyText.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'body is required');
			}

			const note = await notes.update(noteId, r.customer.id, bodyText.trim());
			if (!note) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Note not found');
			}

			return setApiResponse(HTTP.OK, 'NOTE_UPDATED', 'Note updated successfully.', {
				note: toCustomerNoteDTO(note),
			});
		},

		async delete(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const noteId = params?.['noteId'];
			if (!noteId) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'noteId is required');
			}

			await notes.delete(noteId, r.customer.id);
			return setApiResponse(HTTP.OK, 'NOTE_DELETED', 'Note deleted successfully.');
		},
	};
}
