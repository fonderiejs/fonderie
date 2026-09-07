import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { SubscriptionModel } from '../models/subscription.model';
import { getWalletCustomer, setWalletCustomerCard, upsertWalletCustomer } from '../services/wallet-customers';
import { toPaymentMethodDTO, toInvoiceDTO } from '../dtos/billing';
import { resolveSubscriber } from '../utils';
import type { SubscriberType } from '../types';

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

	// Resolve the subscriber's provider customer, creating + recording one when
	// they have none yet (a pay-as-you-go user adding a card before any purchase).
	// Recording it via the wallet-customer row means later reads resolve it.
	async function ensureCustomer(
		ctx: IFonderieContext,
	): Promise<{ subscriberType: SubscriberType; subscriberId: string; customerId: string } | null> {
		const subscriber = resolveSubscriber(ctx);
		if (!subscriber) return null;
		const existing = await resolveCustomer(ctx);
		if (existing) {
			return { subscriberType: subscriber.type, subscriberId: subscriber.id, customerId: existing.customerId };
		}
		const { customerId } = await config.provider.createCustomer({
			email: ctx.user?.email ?? '',
			subscriberType: subscriber.type,
			subscriberId: subscriber.id,
			userId: ctx.user?.id ?? '',
		});
		if (config.wallet) {
			await upsertWalletCustomer(
				{
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					provider: config.provider.name,
					providerCustomerId: customerId,
					rearm: false,
				},
				store,
			);
		}
		return { subscriberType: subscriber.type, subscriberId: subscriber.id, customerId };
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

		// POST /billing/payment-method/setup → { clientSecret }
		// Begin in-app card entry: ensure a provider customer, hand back a
		// SetupIntent client secret for the embedded card element (no redirect).
		async setupPaymentMethod(ctx: IFonderieContext): Promise<Response> {
			if (!resolveSubscriber(ctx)) {
				return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required');
			}
			if (!config.provider.createSetupIntent) {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'NOT_IMPLEMENTED',
					'Provider does not support in-app card setup',
				);
			}
			const ensured = await ensureCustomer(ctx);
			if (!ensured) {
				return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required');
			}
			const { clientSecret } = await config.provider.createSetupIntent({ customerId: ensured.customerId });
			return setApiResponse(HTTP.OK, 'PAYMENT_METHOD_SETUP', 'Card setup ready.', { clientSecret });
		},

		// PUT /billing/payment-method { paymentMethodId } → { paymentMethod }
		// Called after the client confirms the SetupIntent (card now attached to
		// the customer): make it the default and record the consented card.
		async savePaymentMethod(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required');
			}
			if (!config.provider.setDefaultPaymentMethod) {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'NOT_IMPLEMENTED',
					'Provider does not support in-app card setup',
				);
			}
			const { paymentMethodId } = ctx.meta['body'] as { paymentMethodId: string };
			const customer = await resolveCustomer(ctx);
			if (!customer) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'NO_CUSTOMER', 'Start card setup before saving a card.');
			}
			try {
				// Verifies the card is attached to THIS customer (rejects otherwise).
				await config.provider.setDefaultPaymentMethod({
					customerId: customer.customerId,
					paymentMethodId,
				});
			} catch {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PAYMENT_METHOD', 'That card could not be saved.');
			}
			if (config.wallet) {
				const key = {
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					provider: config.provider.name,
				};
				// Ensure the row exists (customer may have resolved via a subscription),
				// then record the consented card without touching auto-recharge flags.
				await upsertWalletCustomer({ ...key, providerCustomerId: customer.customerId, rearm: false }, store);
				await setWalletCustomerCard(key, paymentMethodId, store);
			}
			const card = config.provider.getPaymentMethod
				? await config.provider.getPaymentMethod({ customerId: customer.customerId, paymentMethodId })
				: null;
			return setApiResponse(HTTP.OK, 'PAYMENT_METHOD_SAVED', 'Payment method saved.', {
				paymentMethod: card ? toPaymentMethodDTO(card) : null,
			});
		},

		// DELETE /billing/payment-method → { paymentMethod: null }
		async removePaymentMethod(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required');
			}
			if (!config.provider.detachPaymentMethod) {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'NOT_IMPLEMENTED',
					'Provider does not support payment-method removal',
				);
			}
			const customer = await resolveCustomer(ctx);
			if (customer?.paymentMethodId) {
				try {
					await config.provider.detachPaymentMethod({
						customerId: customer.customerId,
						paymentMethodId: customer.paymentMethodId,
					});
				} catch {
					// already detached / not ours — fall through and clear our record
				}
			}
			if (config.wallet) {
				await setWalletCustomerCard(
					{ subscriberType: subscriber.type, subscriberId: subscriber.id, provider: config.provider.name },
					null,
					store,
				);
			}
			return setApiResponse(HTTP.OK, 'PAYMENT_METHOD_REMOVED', 'Payment method removed.', {
				paymentMethod: null,
			});
		},
	};
}
