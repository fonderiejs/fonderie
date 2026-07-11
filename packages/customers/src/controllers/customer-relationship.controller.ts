import type { IFonderieContext } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { toCustomerRelationshipDTO } from '../dtos/customer';
import { CustomerModel } from '../models/customer.model';
import { CustomerRelationshipModel } from '../models/customer-relationship.model';
import { isUuid } from '../utils';

export function customerRelationshipController(store: IStoreAdapter) {
	const customers = new CustomerModel(store);
	const relationships = new CustomerRelationshipModel(store);

	async function resolveCustomer(ctx: IFonderieContext) {
		const workspaceId = ctx.workspace?.id;
		if (!workspaceId) {
			return {
				error: setApiResponse(HTTP.BAD_REQUEST, 'MISSING_WORKSPACE', 'Workspace context is required'),
			};
		}

		const params = ctx.meta['params'] as Record<string, string> | undefined;
		const id = params?.['customerId'];
		if (!isUuid(id)) {
			return { error: setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID') };
		}

		const customer = await customers.findById(id, workspaceId);
		if (!customer) {
			return { error: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found') };
		}

		return { customer, workspaceId };
	}

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const list = await relationships.list(r.customer.id);
			return setApiResponse(HTTP.OK, 'RELATIONSHIPS_FETCHED', 'Relationships retrieved successfully.', {
				relationships: list.map(toCustomerRelationshipDTO),
			});
		},

		async add(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const relatedId = body?.['relatedId'];
			const relationship = body?.['relationship'];

			if (!isUuid(relatedId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'relatedId must be a valid UUID');
			}
			if (typeof relationship !== 'string' || relationship.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'relationship is required');
			}
			if (relatedId === r.customer.id) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'A customer cannot be related to itself');
			}

			const related = await customers.findById(relatedId, r.workspaceId);
			if (!related) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Related customer not found');
			}

			const created = await relationships.add({
				workspaceId: r.workspaceId,
				customerId: r.customer.id,
				relatedId,
				relationship: relationship.trim(),
				isPrimary: body?.['isPrimary'] === true,
			});

			return setApiResponse(HTTP.CREATED, 'RELATIONSHIP_ADDED', 'Relationship added successfully.', {
				relationship: toCustomerRelationshipDTO(created),
			});
		},

		async setPrimary(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const relatedId = params?.['relatedId'];
			if (!isUuid(relatedId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'relatedId must be a valid UUID');
			}

			await relationships.setPrimary(r.customer.id, relatedId);
			return setApiResponse(HTTP.OK, 'RELATIONSHIP_PRIMARY_SET', 'Primary relationship updated successfully.');
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const relatedId = params?.['relatedId'];
			if (!isUuid(relatedId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'relatedId must be a valid UUID');
			}

			await relationships.remove(r.customer.id, relatedId);
			return setApiResponse(HTTP.OK, 'RELATIONSHIP_REMOVED', 'Relationship removed successfully.');
		},
	};
}
