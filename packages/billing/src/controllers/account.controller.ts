import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { SubscriptionModel } from '../models/subscription.model';
import {
	getWalletCustomer,
	setWalletCustomerCard,
	upsertWalletCustomer,
} from '../services/wallet-customers';
import { createRecordedCustomer, latestRecordedCustomer } from '../services/provider-customers';
import { toPaymentMethodDTO, toInvoiceDTO } from '../dtos/billing';
import { decodeInvoiceCursor, pageInvoices } from '../services/invoice-cursor';
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
				{
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					provider: config.provider.name,
				},
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

		// A customer created before anything pointed at it — card setup with the
		// wallet off and no subscription yet. Without this, the card was set up
		// on a customer the save step could not find (422 NO_CUSTOMER).
		const recorded = await latestRecordedCustomer(store, config.provider.name, subscriber);
		if (recorded) return { customerId: recorded, paymentMethodId: null };
		return null;
	}

	// Every provider customer a subscriber has. The wallet customer and the
	// subscription's customer CAN differ — a pay-as-you-go buyer gets a wallet
	// customer from their first pack, and a later subscription checkout may
	// resolve/create its own — which splits invoices across two customers.
	// Invoice listing must union both, or subscription invoices go unseen.
	async function resolveCustomerIds(ctx: IFonderieContext): Promise<string[]> {
		const subscriber = resolveSubscriber(ctx);
		if (!subscriber) return [];
		const ids = new Set<string>();
		if (config.wallet) {
			const wc = await getWalletCustomer(
				{
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					provider: config.provider.name,
				},
				store,
			);
			if (wc?.providerCustomerId) ids.add(wc.providerCustomerId);
		}
		const subscription = await subscriptions.get(subscriber.type, subscriber.id);
		if (subscription?.providerCustomerId) ids.add(subscription.providerCustomerId);
		return [...ids];
	}

	// Resolve the subscriber's provider customer, creating + recording one when
	// they have none yet (a pay-as-you-go user adding a card before any purchase).
	// The customer record (fonderie_billing_customers) makes later reads resolve
	// it with the wallet on or off; the wallet-customer row is kept as before.
	async function ensureCustomer(
		ctx: IFonderieContext,
	): Promise<{ subscriberType: SubscriberType; subscriberId: string; customerId: string } | null> {
		const subscriber = resolveSubscriber(ctx);
		if (!subscriber) return null;
		const existing = await resolveCustomer(ctx);
		if (existing) {
			return {
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				customerId: existing.customerId,
			};
		}
		const { customerId } = await createRecordedCustomer(store, config.provider, {
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
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
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
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}
			if (!config.provider.listInvoices) {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'NOT_IMPLEMENTED',
					'Provider does not support invoice listing',
				);
			}
			const params = new URL(ctx.request.url).searchParams;
			const rawLimit = params.get('limit');
			const limit = rawLimit !== null ? Number.parseInt(rawLimit, 10) : 20;
			if (Number.isNaN(limit) || limit < 1 || limit > 100) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'limit must be an integer between 1 and 100',
				);
			}
			const rawCursor = params.get('cursor');
			const cursor = rawCursor !== null ? decodeInvoiceCursor(rawCursor) : null;
			if (rawCursor !== null && cursor === null) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Malformed cursor');
			}

			const customerIds = await resolveCustomerIds(ctx);
			if (customerIds.length === 0) {
				return setApiResponse(HTTP.OK, 'INVOICES', 'No invoices.', {
					invoices: [],
					nextCursor: null,
				});
			}
			// Union invoices across all the subscriber's customers (wallet + subscription),
			// dedupe by id, newest first — so pack and subscription invoices show together.
			// Each source is asked for one row more than the page, at or before the
			// cursor, so the union knows whether a next page exists. (This used to
			// return the newest 20 and silently drop everything older.)
			const perCustomer = await Promise.all(
				customerIds.map((customerId) =>
					config.provider.listInvoices!({
						customerId,
						limit: limit + 1,
						...(cursor ? { createdLte: cursor.created } : {}),
					}),
				),
			);
			const page = pageInvoices(perCustomer, limit, cursor);
			return setApiResponse(HTTP.OK, 'INVOICES', `Retrieved ${page.invoices.length} invoices`, {
				invoices: page.invoices.map(toInvoiceDTO),
				nextCursor: page.nextCursor,
			});
		},

		// POST /billing/payment-method/setup → { clientSecret }
		// Begin in-app card entry: ensure a provider customer, hand back a
		// SetupIntent client secret for the embedded card element (no redirect).
		async setupPaymentMethod(ctx: IFonderieContext): Promise<Response> {
			if (!resolveSubscriber(ctx)) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
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
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}
			const { clientSecret } = await config.provider.createSetupIntent({
				customerId: ensured.customerId,
			});
			return setApiResponse(HTTP.OK, 'PAYMENT_METHOD_SETUP', 'Card setup ready.', { clientSecret });
		},

		// PUT /billing/payment-method { paymentMethodId } → { paymentMethod }
		// Called after the client confirms the SetupIntent (card now attached to
		// the customer): make it the default and record the consented card.
		async savePaymentMethod(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
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
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'NO_CUSTOMER',
					'Start card setup before saving a card.',
				);
			}
			try {
				// Verifies the card is attached to THIS customer (rejects otherwise).
				await config.provider.setDefaultPaymentMethod({
					customerId: customer.customerId,
					paymentMethodId,
				});
			} catch {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PAYMENT_METHOD',
					'That card could not be saved.',
				);
			}
			if (config.wallet) {
				const key = {
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					provider: config.provider.name,
				};
				// Ensure the row exists (customer may have resolved via a subscription),
				// then record the consented card without touching auto-recharge flags.
				await upsertWalletCustomer(
					{ ...key, providerCustomerId: customer.customerId, rearm: false },
					store,
				);
				await setWalletCustomerCard(key, paymentMethodId, store);
			}
			const card = config.provider.getPaymentMethod
				? await config.provider.getPaymentMethod({
						customerId: customer.customerId,
						paymentMethodId,
					})
				: null;
			return setApiResponse(HTTP.OK, 'PAYMENT_METHOD_SAVED', 'Payment method saved.', {
				paymentMethod: card ? toPaymentMethodDTO(card) : null,
			});
		},

		// DELETE /billing/payment-method → { paymentMethod: null }
		async removePaymentMethod(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
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
					{
						subscriberType: subscriber.type,
						subscriberId: subscriber.id,
						provider: config.provider.name,
					},
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
