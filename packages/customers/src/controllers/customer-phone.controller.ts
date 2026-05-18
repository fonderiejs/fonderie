import type { IFonderieContext } from '@fonderie-js/core';
import { HTTP, setApiResponse } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';
import { toCustomerPhoneDTO } from '../dtos/customer';
import { CustomerModel } from '../models/customer.model';
import { CustomerPhoneModel } from '../models/customer-phone.model';
import { isUuid } from '../utils';

export function customerPhoneController(store: IStoreAdapter) {
	const customers = new CustomerModel(store);
	const phones = new CustomerPhoneModel(store);

	async function resolveCustomer(ctx: IFonderieContext) {
		const workspaceId = ctx.workspace?.id;
		if (!workspaceId) {
			return {
				error: setApiResponse(
					HTTP.BAD_REQUEST,
					'MISSING_WORKSPACE',
					'Workspace context is required',
				),
			};
		}

		const params = ctx.meta['params'] as Record<string, string> | undefined;
		const id = params?.['customerId'];
		if (!isUuid(id)) {
			return {error: setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID')};
		}

		const customer = await customers.findById(id, workspaceId);
		if (!customer) {
			return {error: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found')};
		}

		return { customer, workspaceId };
	}

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) {
				return r.error;
			}

			const list = await phones.list(r.customer.id);
			return setApiResponse(HTTP.OK, 'PHONES_FETCHED', 'Phones retrieved successfully.', {
				phones: list.map(toCustomerPhoneDTO),
			});
		},

		async add(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) {
				return r.error;
			}

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const phone = body?.['phone'];
			if (typeof phone !== 'string' || phone.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'phone is required');
			}

			const label = typeof body?.['label'] === 'string' ? body['label'] : 'mobile';
			const isPrimary = body?.['isPrimary'] === true;

			let created;
			try {
				created = await phones.add({
					customerId: r.customer.id,
					phone: phone.trim(),
					label,
					isPrimary,
				});
			} catch (err) {
				if (err instanceof Error && err.message.includes('idx_fcp_unique_phone')) {
					return setApiResponse(HTTP.CONFLICT, 'DUPLICATE_PHONE', 'This phone is already linked to this customer');
				}
				throw err;
			}

			return setApiResponse(HTTP.CREATED, 'PHONE_ADDED', 'Phone added successfully.', {
				phone: toCustomerPhoneDTO(created),
			});
		},

		async setPrimary(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) {
				return r.error;
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const phoneId = params?.['phoneId'];
			if (!isUuid(phoneId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'phoneId must be a valid UUID');
			}

			await phones.setPrimary(phoneId, r.customer.id);
			return setApiResponse(HTTP.OK, 'PHONE_PRIMARY_SET', 'Primary phone updated successfully.');
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) {
				return r.error;
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const phoneId = params?.['phoneId'];
			if (!isUuid(phoneId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'phoneId must be a valid UUID');
			}

			await phones.remove(phoneId, r.customer.id);
			return setApiResponse(HTTP.OK, 'PHONE_REMOVED', 'Phone removed successfully.');
		},
	};
}
