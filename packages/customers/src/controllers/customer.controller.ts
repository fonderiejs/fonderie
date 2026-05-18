import type { IFonderieContext } from '@fonderie-js/core';
import { HTTP, setApiResponse } from '@fonderie-js/core';
import type { EventBus } from '@fonderie-js/events';
import type { IStoreAdapter } from '@fonderie-js/store';

import { DEFAULT_REFERENCE_CODE_PREFIX, EVENT_KEYS, type ICustomersConfig } from '../config';
import { toCustomerDetailDTO, toCustomerDTO } from '../dtos/customer';
import { CustomerModel } from '../models/customer.model';
import { isUuid } from '../utils';

export function customerController(store: IStoreAdapter, config: ICustomersConfig = {}, bus?: EventBus) {
	const customers = new CustomerModel(store);
	const prefix = (config.referenceCodePrefix ?? DEFAULT_REFERENCE_CODE_PREFIX).toUpperCase();

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			const workspaceId = ctx.workspace?.id;
			if (!workspaceId) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'MISSING_WORKSPACE',
					'Workspace context is required',
				);
			}

			const query = ctx.request.url ? new URL(ctx.request.url).searchParams : null;
			const search = query?.get('search') ?? undefined;
			const archived = query?.get('archived');
			const limit = Number(query?.get('limit') ?? 50);
			const offset = Number(query?.get('offset') ?? 0);

			const listOpts: Parameters<typeof customers.list>[0] = {
				workspaceId,
				limit: Number.isFinite(limit) ? limit : 50,
				offset: Number.isFinite(offset) ? offset : 0,
			};

			if (search !== undefined) {
				listOpts.search = search;
			}

			if (archived !== null && archived !== undefined) {
				listOpts.archived = archived === 'true' || archived === '1';
			}

			const list = await customers.list(listOpts);

			return setApiResponse(HTTP.OK, 'CUSTOMERS_FETCHED', 'Customers retrieved successfully.', {
				customers: list.map(toCustomerDTO),
			});
		},

		async get(ctx: IFonderieContext): Promise<Response> {
			const workspaceId = ctx.workspace?.id;
			if (!workspaceId) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'MISSING_WORKSPACE',
					'Workspace context is required',
				);
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const id = params?.['customerId'];
			if (!isUuid(id)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID');
			}

			const customer = await customers.findDetail(id, workspaceId);
			if (!customer) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
			}

			return setApiResponse(HTTP.OK, 'CUSTOMER_FETCHED', 'Customer retrieved successfully.', {
				customer: toCustomerDetailDTO(customer),
			});
		},

		async create(ctx: IFonderieContext): Promise<Response> {
			const workspaceId = ctx.workspace?.id;
			if (!workspaceId) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'MISSING_WORKSPACE',
					'Workspace context is required',
				);
			}

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const type = body?.['type'];
			const sex = body?.['sex'];
			const firstName = body?.['firstName'];
			const lastName = body?.['lastName'];
			const companyName = body?.['companyName'];

			const avatarUrl = body?.['avatarUrl'];
			const locale = body?.['locale'];
			const referenceCode = body?.['referenceCode'];

			if (type !== undefined && type !== 'individual' && type !== 'business') {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'type must be individual or business',
				);
			}

			if (sex !== undefined && sex !== 'UNKNOWN' && sex !== 'MALE' && sex !== 'FEMALE') {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'sex must be UNKNOWN, MALE, or FEMALE',
				);
			}

			let customer;
			try {
				customer = await customers.create({
					workspaceId,
					type: typeof type === 'string' ? type : 'individual',
					sex: typeof sex === 'string' ? sex : 'UNKNOWN',
					firstName: typeof firstName === 'string' ? firstName : null,
					lastName: typeof lastName === 'string' ? lastName : null,
					companyName: typeof companyName === 'string' ? companyName : null,
	
					avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
					locale: typeof locale === 'string' ? locale : 'en-US',
					referenceCode: typeof referenceCode === 'string' ? referenceCode.toUpperCase() : undefined,
					referenceCodePrefix: prefix,
					createdBy: ctx.user?.id ?? null,
				});
			} catch (err: unknown) {
				if (err instanceof Error && err.message.includes('idx_fc_reference_code')) {
					return setApiResponse(HTTP.CONFLICT, 'DUPLICATE_REFERENCE_CODE', 'A customer with this reference code already exists');
				}
				throw err;
			}

			bus
				?.emit(EVENT_KEYS.customerCreated, {
					customerId: customer.id,
					workspaceId: customer.workspaceId,
				})
				.catch(() => {});

			return setApiResponse(HTTP.CREATED, 'CUSTOMER_CREATED', 'Customer created successfully.', {
				customer: toCustomerDTO(customer),
			});
		},

		async update(ctx: IFonderieContext): Promise<Response> {
			const workspaceId = ctx.workspace?.id;
			if (!workspaceId) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'MISSING_WORKSPACE',
					'Workspace context is required',
				);
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const id = params?.['customerId'];
			if (!isUuid(id)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID');
			}

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const opts: Parameters<typeof customers.update>[2] = {};

			if (body?.['type'] !== undefined) {
				const t = body['type'];
				if (t !== 'individual' && t !== 'business') {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'INVALID_PARAMETER',
						'type must be individual or business',
					);
				}
				opts.type = t;
			}

			if (body?.['sex'] !== undefined) {
				const s = body['sex'];
				if (s !== 'UNKNOWN' && s !== 'MALE' && s !== 'FEMALE') {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'INVALID_PARAMETER',
						'sex must be UNKNOWN, MALE, or FEMALE',
					);
				}
				opts.sex = s;
			}

			if (body?.['firstName'] !== undefined) {
				opts.firstName = typeof body['firstName'] === 'string' ? body['firstName'] : null;
			}

			if (body?.['lastName'] !== undefined) {
				opts.lastName = typeof body['lastName'] === 'string' ? body['lastName'] : null;
			}

			if (body?.['companyName'] !== undefined) {
				opts.companyName = typeof body['companyName'] === 'string' ? body['companyName'] : null;
			}

			if (body?.['avatarUrl'] !== undefined) {
				opts.avatarUrl = typeof body['avatarUrl'] === 'string' ? body['avatarUrl'] : null;
			}

			if (body?.['locale'] !== undefined && typeof body['locale'] === 'string') {
				opts.locale = body['locale'];
			}

			if (body?.['referenceCode'] !== undefined && typeof body['referenceCode'] === 'string') {
				opts.referenceCode = body['referenceCode'].toUpperCase();
			}

			const customer = await customers.update(id, workspaceId, opts, prefix);
			if (!customer) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
			}

			bus
				?.emit(EVENT_KEYS.customerUpdated, {
					customerId: customer.id,
					workspaceId: customer.workspaceId,
				})
				.catch(() => {});

			return setApiResponse(HTTP.OK, 'CUSTOMER_UPDATED', 'Customer updated successfully.', {
				customer: toCustomerDTO(customer),
			});
		},

		async delete(ctx: IFonderieContext): Promise<Response> {
			const workspaceId = ctx.workspace?.id;
			if (!workspaceId) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'MISSING_WORKSPACE',
					'Workspace context is required',
				);
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const id = params?.['customerId'];
			if (!isUuid(id)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID');
			}

			const existing = await customers.findById(id, workspaceId);
			if (!existing) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
			}

			await customers.delete(id, workspaceId);

			bus
				?.emit(EVENT_KEYS.customerDeleted, {
					customerId: id,
					workspaceId,
				})
				.catch(() => {});

			return setApiResponse(HTTP.OK, 'CUSTOMER_DELETED', 'Customer deleted successfully.');
		},

		async archive(ctx: IFonderieContext): Promise<Response> {
			const workspaceId = ctx.workspace?.id;
			if (!workspaceId) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'MISSING_WORKSPACE',
					'Workspace context is required',
				);
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const id = params?.['customerId'];
			if (!isUuid(id)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID');
			}

			const existing = await customers.findById(id, workspaceId);
			if (!existing) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
			}

			await customers.archive(id, workspaceId);

			bus
				?.emit(EVENT_KEYS.customerArchived, {
					customerId: id,
					workspaceId,
				})
				.catch(() => {});

			return setApiResponse(HTTP.OK, 'CUSTOMER_ARCHIVED', 'Customer archived successfully.');
		},

		async restore(ctx: IFonderieContext): Promise<Response> {
			const workspaceId = ctx.workspace?.id;
			if (!workspaceId) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'MISSING_WORKSPACE',
					'Workspace context is required',
				);
			}

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const id = params?.['customerId'];
			if (!isUuid(id)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID');
			}

			const existing = await customers.findById(id, workspaceId);
			if (!existing) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
			}

			await customers.restore(id, workspaceId);

			bus
				?.emit(EVENT_KEYS.customerRestored, {
					customerId: id,
					workspaceId,
				})
				.catch(() => {});

			return setApiResponse(HTTP.OK, 'CUSTOMER_RESTORED', 'Customer restored successfully.');
		},
	};
}
