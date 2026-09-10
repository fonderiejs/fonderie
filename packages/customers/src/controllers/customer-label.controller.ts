import type { IFonderieContext } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import { CustomerLabelModel } from '../models/customer-label.model';
import { toCustomerLabelDTO } from '../dtos/customer';
import type { CustomerLabelType } from '../types';
import { isUuid } from '../utils';

const VALID_TYPES: CustomerLabelType[] = ['phone', 'email', 'address'];

export function customerLabelController(store: IStoreAdapter) {
	const labels = new CustomerLabelModel(store);

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			const query = ctx.request.url ? new URL(ctx.request.url).searchParams : null;
			const type = query?.get('type') as CustomerLabelType | null;

			if (!type || !VALID_TYPES.includes(type)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'type must be phone, email, or address');
			}
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const rows = await labels.list(type, ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'LABELS_FETCHED', 'Labels retrieved successfully.', {
				labels: rows.map(toCustomerLabelDTO),
			});
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const labelId = params?.['labelId'];

			if (!isUuid(labelId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'labelId must be a valid UUID');
			}
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const removed = await labels.remove(labelId, ctx.workspace.id);
			if (!removed) {
				// Not this workspace's label, a shared default, or still in use.
				return setApiResponse(
					HTTP.CONFLICT,
					'LABEL_IN_USE',
					'Label cannot be deleted — it is a shared default, not owned by this workspace, or still referenced.',
				);
			}
			return setApiResponse(HTTP.OK, 'LABEL_DELETED', 'Label deleted successfully.');
		},
	};
}
