import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IBillingConfig }   from '../config';

import { getPlanByName }         from '../services/plans';
import { upsertSubscription }    from '../services/subscriptions';

export function createCheckoutHandler(store: IStoreAdapter, config: IBillingConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body        = ctx.meta['body'] as Record<string, unknown> | undefined
		const planName    = body?.['plan'];
		const interval    = (body?.['interval'] ?? 'month') as 'month' | 'year'
		const workspaceId = resolveWorkspaceId(ctx);

		if (typeof planName !== 'string') {
			return Response.json({ error: 'plan is required' }, { status: 422 });
		}

		if (interval !== 'month' && interval !== 'year') {
			return Response.json({ error: 'interval must be month or year' }, { status: 422 });
		}

		if (!workspaceId) {
			return Response.json({ error: 'Workspace context required' }, { status: 400 });
		}

		const plan = getPlanByName(planName, config);
		if (!plan) {
			return Response.json({ error: `Unknown plan: ${planName}` }, { status: 422 })
		}

		const pricing = interval === 'year' ? plan.yearly : plan.monthly
		if (!pricing?.priceId) {
			return Response.json(
				{ error: `Plan ${planName} does not support ${interval} billing` },
				{ status: 422 },
			);
		}

		const { customerId } = await config.provider.createCustomer({
			email:       ctx.user.email,
			workspaceId,
			userId:      ctx.user.id,
		});

		const { url } = await config.provider.createCheckoutSession({
			customerId,
			priceId:    pricing.priceId,
			workspaceId,
			trialDays:  plan.trialDays,
			successUrl: config.successUrl,
			cancelUrl:  config.cancelUrl,
		});

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

		return Response.json({ url }, { status: 200 });
	}
}

function resolveWorkspaceId(ctx: IFonderieContext): string | null {
	if (ctx.workspace?.id) {
		return ctx.workspace.id;
	}

	const params = ctx.meta['params'] as Record<string, string> | undefined
	if (params?.['workspaceId']) {
		return params['workspaceId'];
	}

	return ctx.request.headers.get('x-workspace-id');
}
