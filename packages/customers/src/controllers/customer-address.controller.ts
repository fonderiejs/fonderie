import type { IFonderieContext } from '@fonderie-js/core';
import { HTTP, setApiResponse } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';
import { toCustomerAddressDTO } from '../dtos/customer';
import { CustomerModel } from '../models/customer.model';
import { CustomerAddressModel } from '../models/customer-address.model';
import { isUuid } from '../utils';

export function customerAddressController(store: IStoreAdapter) {
	const customers = new CustomerModel(store);
	const addresses = new CustomerAddressModel(store);

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
		const id = params?.['customerId'];
		if (!isUuid(id))
			return { error: setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID') };

		const customer = await customers.findById(id, workspaceId);
		if (!customer)
			return { error: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found') };

		return { customer, workspaceId };
	}

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const list = await addresses.list(r.customer.id);
			return setApiResponse(HTTP.OK, 'ADDRESSES_FETCHED', 'Addresses retrieved successfully.', {
				addresses: list.map(toCustomerAddressDTO),
			});
		},

		async add(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const countryIso = body?.['countryIso'];
			const zipPostalCode = body?.['zipPostalCode'];

			if (typeof countryIso !== 'string' || countryIso.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'countryIso is required');
			}
			if (typeof zipPostalCode !== 'string' || zipPostalCode.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'zipPostalCode is required');
			}

			const created = await addresses.add({
				customerId: r.customer.id,
				countryIso: countryIso.trim(),
				zipPostalCode: zipPostalCode.trim(),
				subdivision1Iso: typeof body?.['subdivision1Iso'] === 'string' ? body['subdivision1Iso'] : null,
				subdivision2Iso: typeof body?.['subdivision2Iso'] === 'string' ? body['subdivision2Iso'] : null,
				line1: typeof body?.['line1'] === 'string' ? body['line1'] : null,
				line2: typeof body?.['line2'] === 'string' ? body['line2'] : null,
				label: typeof body?.['label'] === 'string' ? body['label'] : 'service',
				isPrimary: body?.['isPrimary'] === true,
			});

			return setApiResponse(HTTP.CREATED, 'ADDRESS_ADDED', 'Address added successfully.', {
				address: toCustomerAddressDTO(created),
			});
		},

		async setPrimary(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const addrId = params?.['addrId'];
			if (!isUuid(addrId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'addrId must be a valid UUID');
			}

			await addresses.setPrimary(addrId, r.customer.id);
			return setApiResponse(HTTP.OK, 'ADDRESS_PRIMARY_SET', 'Primary address updated successfully.');
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) return r.error;

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const addrId = params?.['addrId'];
			if (!isUuid(addrId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'addrId must be a valid UUID');
			}

			await addresses.remove(addrId, r.customer.id);
			return setApiResponse(HTTP.OK, 'ADDRESS_REMOVED', 'Address removed successfully.');
		},
	};
}
