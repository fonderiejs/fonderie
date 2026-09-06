import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { SubscriptionModel } from '../models/subscription.model';
import { getWalletCustomer } from '../services/wallet-customers';
import { toPaymentMethodDTO, toInvoiceDTO } from '../dtos/billing';
import { resolveSubscriber } from '../utils';

// Read-only billing-account surface for an in-app billing page: the card on
// file and the invoice history. Both resolve the provider customer the same
// way — prefer the wallet customer (it holds the card a pack buyer consented
// to, and exists for free/pay-as-you-go users with no subscription), then the
// subscription's provider customer. Neither route mutates anything.
export function accountController(store: IStoreAdapter, config: IBillingConfig) {
	const subscriptions = new SubscriptionModel(store);

	async function resolveCustomer(
		ctx: IFonderieContext,
	): Promise<{ customerId: string; paymentMethodId: string | null } | null> {
		const subscriber = resolveSubscriber(ctx);
		if (!subscriber) return null;

		// Wallet customer first — it carries the saved card id, and pay-as-you-go
		// users have one without ever subscribing.
		if (config.wallet) {
			const wc = await getWalletCustomer(
				{ subscriberType: subscriber.type, subscriberId: subscriber.id, provider: config.provider.name },
				store,
			);
			if (wc?.providerCustomerId) {
				return { customerId: wc.providerCustomerId, paymentMethodId: wc.paymentMethodId };
			}
		}

		const subscription = await subscriptions.get(subscriber.type, subscriber.id);
		if (subscription?.providerCustomerId) {
			return { customerId: subscription.providerCustomerId, paymentMethodId: null };
		}
		return null;
	}

	return {
		// GET /billing/payment-method → { paymentMethod: IPaymentMethodDTO | null }
		async getPaymentMethod(ctx: IFonderieContext): Promise<Response> {
			if (!resolveSubscriber(ctx)) {
				return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required');
			}
			if (!config.provider.getPaymentMethod) {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'NOT_IMPLEMENTED',
					'Provider does not support payment-method retrieval',
				);
			}
			const customer = await resolveCustomer(ctx);
			if (!customer) {
				return setApiResponse(HTTP.OK, 'PAYMENT_METHOD', 'No payment method on file.', {
					paymentMethod: null,
				});
			}
			const card = await config.provider.getPaymentMethod({
				customerId: customer.customerId,
				paymentMethodId: customer.paymentMethodId,
			});
			return setApiResponse(
				HTTP.OK,
				'PAYMENT_METHOD',
				card ? 'Payment method retrieved.' : 'No payment method on file.',
				{ paymentMethod: card ? toPaymentMethodDTO(card) : null },
			);
		},

		// GET /billing/invoices → { invoices: IInvoiceDTO[] }
		async listInvoices(ctx: IFonderieContext): Promise<Response> {
			if (!resolveSubscriber(ctx)) {
				return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required');
			}
			if (!config.provider.listInvoices) {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'NOT_IMPLEMENTED',
					'Provider does not support invoice listing',
				);
			}
			const customer = await resolveCustomer(ctx);
			if (!customer) {
				return setApiResponse(HTTP.OK, 'INVOICES', 'No invoices.', { invoices: [] });
			}
			const invoices = await config.provider.listInvoices({ customerId: customer.customerId });
			return setApiResponse(HTTP.OK, 'INVOICES', `Retrieved ${invoices.length} invoices`, {
				invoices: invoices.map(toInvoiceDTO),
			});
		},
	};
}
