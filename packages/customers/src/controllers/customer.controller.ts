import type { IFonderieContext } from '@fonderie/core';
import { HTTP, setApiResponse, background } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';
import { getWorkspaceSettings } from '@fonderie/workspaces';

import { DEFAULT_REFERENCE_CODE_PREFIX, EVENT_KEYS, type ICustomersConfig } from '../config';
import { toCustomerDetailD2DTO, toCustomerDetailDTO, toCustomerDTO } from '../dtos/customer';
import type { ICustomerDetailD2 } from '../types';
import { CustomerInUseError, CustomerModel, duplicateCode } from '../models/customer.model';
import { isUuid } from '../utils';

// A code the caller chose that another customer in the workspace holds: theirs
// to change, so a 409 that says which code — not a 500 from the unique index.
function duplicateCodeResponse(err: unknown): Response | null {
	switch (duplicateCode(err)) {
		case 'reference':
			return setApiResponse(HTTP.CONFLICT, 'DUPLICATE_REFERENCE_CODE', 'A customer with this reference code already exists');
		case 'referral':
			return setApiResponse(HTTP.CONFLICT, 'DUPLICATE_REFERRAL_CODE', 'A customer with this referral code already exists');
		default:
			return null;
	}
}

export function customerController(store: IStoreAdapter, config: ICustomersConfig = {}, bus?: EventBus) {
	const customers = new CustomerModel(store);
	const prefix = (config.referenceCodePrefix ?? DEFAULT_REFERENCE_CODE_PREFIX).toUpperCase();

	async function setArchived(ctx: IFonderieContext, archived: boolean): Promise<Response> {
		const workspaceId = ctx.workspace?.id;
		if (!workspaceId) return setApiResponse(HTTP.BAD_REQUEST, 'MISSING_WORKSPACE', 'Workspace context is required');
		const id = (ctx.meta['params'] as Record<string, string> | undefined)?.['customerId'];
		if (!isUuid(id)) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'customerId must be a valid UUID');
		const ok = archived ? await customers.archive(id, workspaceId) : await customers.unarchive(id, workspaceId);
		if (!ok) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
		const customer = await customers.findById(id, workspaceId);
		return setApiResponse(
			HTTP.OK,
			archived ? 'CUSTOMER_ARCHIVED' : 'CUSTOMER_UNARCHIVED',
			archived ? 'Customer archived.' : 'Customer restored.',
			{ customer: toCustomerDTO(customer!) },
		);
	}

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
			const blacklisted = query?.get('blacklisted');
			// Archived customers are hidden unless asked for: ?archived=true for
			// only them, ?archived=all for everyone.
			const archivedParam = query?.get('archived');
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

			if (blacklisted !== null && blacklisted !== undefined) {
				listOpts.blacklisted = blacklisted === 'true' || blacklisted === '1';
			}
			if (archivedParam === 'all') listOpts.archived = 'all';
			else if (archivedParam === 'true' || archivedParam === '1') listOpts.archived = true;

			const { limit: _limit, offset: _offset, ...countOpts } = listOpts;
			const [list, total] = await Promise.all([
				customers.list(listOpts),
				customers.count(countOpts),
			]);

			return setApiResponse(HTTP.OK, 'CUSTOMERS_FETCHED', 'Customers retrieved successfully.', {
				customers: list.map(toCustomerDTO),
				total,
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

			const query = ctx.request.url ? new URL(ctx.request.url).searchParams : null;
			const depth = query?.get('depth') === '1' ? 1 : 2;

			if (depth === 2) {
				const customer = await customers.findDetail(id, workspaceId, 2);
				if (!customer) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
				return setApiResponse(HTTP.OK, 'CUSTOMER_FETCHED', 'Customer retrieved successfully.', toCustomerDetailD2DTO(customer));
			}

			const customer = await customers.findDetail(id, workspaceId);
			if (!customer) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
			}

			return setApiResponse(HTTP.OK, 'CUSTOMER_FETCHED', 'Customer retrieved successfully.', toCustomerDetailDTO(customer));
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
			const timezone = body?.['timezone'];
			const referenceCode = body?.['referenceCode'];
			const referralCode = body?.['referralCode'];
			const referredByCode = body?.['referredByCode'];

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

			let customer: Awaited<ReturnType<typeof customers.create>>;
			try {
				customer = await customers.create({
					workspaceId,
					type: typeof type === 'string' ? type : 'individual',
					sex: typeof sex === 'string' ? sex : 'UNKNOWN',
					firstName: typeof firstName === 'string' ? firstName : null,
					lastName: typeof lastName === 'string' ? lastName : null,
					companyName: typeof companyName === 'string' ? companyName : null,

					avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
					// No language given: the business's own (workspace settings).
					locale: typeof locale === 'string' ? locale : (await getWorkspaceSettings(workspaceId, store)).locale,
					// No time zone given: none — documents fall back to the business's.
					timezone: typeof timezone === 'string' ? timezone : null,
					// exactOptionalPropertyTypes: omit the key entirely when absent
					...(typeof referenceCode === 'string' ? { referenceCode: referenceCode.toUpperCase() } : {}),
					referenceCodePrefix: prefix,
					// referral: explicit code override is rare; referredByCode is the signup input
					...(typeof referralCode === 'string' ? { referralCode: referralCode.toUpperCase() } : {}),
					...(typeof referredByCode === 'string' ? { referredByCode: referredByCode.toUpperCase() } : {}),
					createdBy: ctx.user?.id ?? null,
				});
			} catch (err: unknown) {
				const duplicate = duplicateCodeResponse(err);
				if (duplicate) return duplicate;
				throw err;
			}

			await background(bus
				?.emit(EVENT_KEYS.customerCreated, {
					customerId: customer.id,
					workspaceId: customer.workspaceId,
				}));

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

			if (body?.['timezone'] !== undefined) {
				opts.timezone = typeof body['timezone'] === 'string' ? body['timezone'] : null;
			}

			if (body?.['referenceCode'] !== undefined && typeof body['referenceCode'] === 'string') {
				opts.referenceCode = body['referenceCode'].toUpperCase();
			}

			let customer: Awaited<ReturnType<typeof customers.update>>;
			try {
				customer = await customers.update(id, workspaceId, opts, prefix);
			} catch (err: unknown) {
				const duplicate = duplicateCodeResponse(err);
				if (duplicate) return duplicate;
				throw err;
			}
			if (!customer) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Customer not found');
			}

			await background(bus
				?.emit(EVENT_KEYS.customerUpdated, {
					customerId: customer.id,
					workspaceId: customer.workspaceId,
				}));

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

			const inUse = 'Still on a job, quote or invoice — archive this customer instead.';
			if (config.isInUse && (await config.isInUse(id, workspaceId))) {
				return setApiResponse(HTTP.CONFLICT, 'CUSTOMER_IN_USE', inUse);
			}
			try {
				await customers.delete(id, workspaceId, ctx.user?.id ?? null);
			} catch (err) {
				if (err instanceof CustomerInUseError) return setApiResponse(HTTP.CONFLICT, 'CUSTOMER_IN_USE', inUse);
				throw err;
			}

			await background(bus
				?.emit(EVENT_KEYS.customerDeleted, {
					customerId: id,
					workspaceId,
				}));

			return setApiResponse(HTTP.OK, 'CUSTOMER_DELETED', 'Customer deleted successfully.');
		},

		// Hide a customer from lists and pickers without losing them from the
		// documents that name them. Reversible with unarchive.
		async archive(ctx: IFonderieContext): Promise<Response> {
			return setArchived(ctx, true);
		},

		async unarchive(ctx: IFonderieContext): Promise<Response> {
			return setArchived(ctx, false);
		},

		async blacklist(ctx: IFonderieContext): Promise<Response> {
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

			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const reason = typeof body?.['reason'] === 'string' ? body['reason'].trim() || null : null;

			await customers.blacklist(id, workspaceId, reason);

			await background(bus
				?.emit(EVENT_KEYS.customerBlacklisted, {
					customerId: id,
					workspaceId,
				}));

			return setApiResponse(HTTP.OK, 'CUSTOMER_BLACKLISTED', 'Customer blacklisted successfully.');
		},

		async unblacklist(ctx: IFonderieContext): Promise<Response> {
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

			await customers.unblacklist(id, workspaceId);

			await background(bus
				?.emit(EVENT_KEYS.customerUnblacklisted, {
					customerId: id,
					workspaceId,
				}));

			return setApiResponse(HTTP.OK, 'CUSTOMER_UNBLACKLISTED', 'Customer removed from blacklist successfully.');
		},
	};
}
