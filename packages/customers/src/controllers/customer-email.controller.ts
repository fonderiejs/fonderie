import type { IFonderieContext } from '@fonderie-js/core';
import { HTTP, setApiResponse } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';
import { toCustomerEmailDTO } from '../dtos/customer';
import { CustomerModel } from '../models/customer.model';
import { CustomerEmailModel } from '../models/customer-email.model';
import { isUuid } from '../utils';

export function customerEmailController(store: IStoreAdapter) {
	const customers = new CustomerModel(store);
	const emails = new CustomerEmailModel(store);

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

			const list = await emails.list(r.customer.id);
			return setApiResponse(HTTP.OK, 'EMAILS_FETCHED', 'Emails retrieved successfully.', {
				emails: list.map(toCustomerEmailDTO),
			});
		},

		async add(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) {
				return r.error;
			}

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const email = body?.['email'];
			if (typeof email !== 'string' || email.trim().length === 0) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'email is required');
			}

			const label = typeof body?.['label'] === 'string' ? body['label'] : 'work';
			const isPrimary = body?.['isPrimary'] === true;

			let created;
			try {
				created = await emails.add({
					customerId: r.customer.id,
					email: email.trim(),
					label,
					isPrimary,
				});
			} catch (err) {
				if (err instanceof Error && err.message.includes('idx_fce_unique_email')) {
					return setApiResponse(HTTP.CONFLICT, 'DUPLICATE_EMAIL', 'This email is already linked to this customer');
				}
				throw err;
			}

			return setApiResponse(HTTP.CREATED, 'EMAIL_ADDED', 'Email added successfully.', {
				email: toCustomerEmailDTO(created),
			});
		},

		async setPrimary(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) {
				return r.error;
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const emailId = params?.['emailId'];
			if (!isUuid(emailId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'emailId must be a valid UUID');
			}

			await emails.setPrimary(emailId, r.customer.id);
			return setApiResponse(HTTP.OK, 'EMAIL_PRIMARY_SET', 'Primary email updated successfully.');
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			const r = await resolveCustomer(ctx);
			if ('error' in r) {
				return r.error;
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const emailId = params?.['emailId'];
			if (!isUuid(emailId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'emailId must be a valid UUID');
			}

			await emails.remove(emailId, r.customer.id);
			return setApiResponse(HTTP.OK, 'EMAIL_REMOVED', 'Email removed successfully.');
		},
	};
}
