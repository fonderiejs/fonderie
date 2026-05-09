import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import type { IBillingConfig }              from '../config';
import { getPlanByName }                    from '../services/plans';
import { upsertSubscription }               from '../services/subscriptions';

export function createCheckoutHandler(store: IStoreAdapter, config: IBillingConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const body        = ctx.meta['body'] as Record<string, unknown> | undefined
		const planName    = body?.['plan'];
		const interval    = (body?.['interval'] ?? 'month') as 'month' | 'year'
		const workspaceId = resolveWorkspaceId(ctx);

		if (typeof planName !== 'string') {
			return setErrorResponse('INVALID_PARAMETER', 'plan is required', 422);
		}

		if (interval !== 'month' && interval !== 'year') {
			return setErrorResponse('INVALID_PARAMETER', 'interval must be month or year', 422);
		}

		if (!workspaceId) {
			return setErrorResponse('WORKSPACE_REQUIRED', 'Workspace context required', 400);
		}

		const plan = getPlanByName(planName, config);
		if (!plan) {
			return setErrorResponse('INVALID_PARAMETER', `Unknown plan: ${planName}`, 422);
		}

		const pricing = interval === 'year' ? plan.yearly : plan.monthly
		if (!pricing?.priceId) {
			return setErrorResponse('INVALID_PARAMETER', `Plan ${planName} does not support ${interval} billing`, 422);
		}

		const { customerId } = await config.provider.createCustomer({
			email:       ctx.user.email,
			workspaceId,
			userId:      ctx.user.id,
		});

		const sessionOpts: Parameters<typeof config.provider.createCheckoutSession>[0] = {
			customerId,
			priceId:    pricing.priceId,
			workspaceId,
			successUrl: config.successUrl,
			cancelUrl:  config.cancelUrl,
		}
		if (plan.trialDays !== undefined) sessionOpts.trialDays = plan.trialDays

		const { url } = await config.provider.createCheckoutSession(sessionOpts);

		await upsertSubscription(
			{
				workspaceId,
				plan:               planName,
				interval,
				status:             'incomplete',
				providerCustomerId: customerId,
			},
			store,
		);

		return setApiResponse('CHECKOUT_URL', 'Checkout session created.', { url });
	}
}

function resolveWorkspaceId(ctx: IFonderieContext): string | null {
	if (ctx.workspace?.id) return ctx.workspace.id

	const params = ctx.meta['params'] as Record<string, string> | undefined
	if (params?.['workspaceId']) return params['workspaceId']

	return ctx.request.headers.get('x-workspace-id');
}
