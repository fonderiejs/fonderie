import type { IFonderieContext } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import { CustomerLabelModel } from '../models/customer-label.model';
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

			const rows = await labels.list(type);
			return setApiResponse(HTTP.OK, 'LABELS_FETCHED', 'Labels retrieved successfully.', { labels: rows });
		},

		async remove(ctx: IFonderieContext): Promise<Response> {
			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const labelId = params?.['labelId'];

			if (!isUuid(labelId)) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'labelId must be a valid UUID');
			}

			await labels.remove(labelId);
			return setApiResponse(HTTP.OK, 'LABEL_DELETED', 'Label deleted successfully.');
		},
	};
}
