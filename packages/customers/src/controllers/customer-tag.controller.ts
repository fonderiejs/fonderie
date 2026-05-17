import type { IFonderieContext } from '@fonderie-js/core';
import { HTTP, setApiResponse } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import { CustomerModel } from '../models/customer.model';
import { CustomerTagModel } from '../models/customer-tag.model';

export function customerTagController(store: IStoreAdapter) {
	const customers = new CustomerModel(store);
	const tags = new CustomerTagModel(store);

	async function resolveCustomer(ctx: IFonderieContext) {
		const workspaceId = ctx.workspace?.id;
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

			const list = await tags.list(r.customer.id);
			return setApiResponse(HTTP.OK, 'TAGS_FETCHED', 'Tags retrieved successfully.', {
				tags: list,
			});
		},

		async add(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const tag = body?.['tag'];
			if (typeof tag !== 'string' || tag.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'tag is required');
			}

			await tags.add(r.customer.id, tag.trim());
			return setApiResponse(HTTP.CREATED, 'TAG_ADDED', 'Tag added successfully.');
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const tag = params?.['tag'];
			if (!tag) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'tag is required');
			}

			await tags.remove(r.customer.id, tag);
			return setApiResponse(HTTP.OK, 'TAG_REMOVED', 'Tag removed successfully.');
		},
	};
}
