import type { BillingClient, UiMessageKey, UiT } from '@fonderie/client';
import { canonicalLocaleTag, uiLocaleFor } from '@fonderie/client';
import { useUiT } from '@fonderie/vue';
import {
	useBillingPortal,
	usePaymentMethod,
	useRemovePaymentMethod,
	useSubscription,
} from '@fonderie/vue-billing';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';

// A server-reported state ('past_due') in words; an unknown one shown as-is.
function statusLabel(t: UiT, status: string): string {
	const key = `billing.status.${status}` as UiMessageKey;
	const word = t(key);
	return word === key ? status : word;
}

export const SubscriptionScreen = defineComponent({
	name: 'FonderieSubscriptionScreen',
	props: {
		client: { type: Object as PropType<BillingClient>, required: false },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'manage-billing': (_url: string) => true,
		'navigate-pricing': () => true,
		// The host owns the Stripe Payment Element (publishable key + <Elements>),
		// so adding/replacing a card is delegated up — same way `manage-billing`
		// hands a portal URL to the host. `useSetupPaymentMethod`/`useSavePaymentMethod`
		// live there; this provider-agnostic screen only shows + removes the card.
		'add-payment-method': () => true,
	},
	setup(props, { emit }) {
		const t = useUiT(props.client, () => props.locale);
		// Read at render: t() re-renders on a language change, so this follows it.
		const formatLocale = () => canonicalLocaleTag(props.locale) ?? uiLocaleFor(props.client)?.get();
		const { subscription, isLoading, error } = useSubscription(props.client);
		const {
			openPortal,
			isLoading: isOpeningPortal,
			error: portalError,
		} = useBillingPortal(props.client);
		const {
			paymentMethod,
			isLoading: isLoadingCard,
			error: cardError,
			refresh: refreshCard,
		} = usePaymentMethod(props.client);
		const {
			remove,
			isLoading: isRemoving,
			error: removeError,
		} = useRemovePaymentMethod(props.client);

		async function handleManage() {
			try {
				const url = await openPortal();
				emit('manage-billing', url);
			} catch {
				// Surfaced via portalError.
			}
		}

		async function handleRemove() {
			try {
				await remove();
				await refreshCard({ force: true });
			} catch {
				// Surfaced via removeError.
			}
		}

		function renderPaymentMethod() {
			// A card can't render until its read resolves; the initial read runs in
			// onMounted, so isLoadingCard starts true.
			if (isLoadingCard.value && !paymentMethod.value) {
				return [h('p', { style: styles.status }, t('billing.paymentMethod.loading'))];
			}

			const pm = paymentMethod.value;
			const brand = pm ? pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1) : '';
			return [
				cardError.value
					? h('p', { style: styles.error, role: 'alert' }, cardError.value.explanation)
					: null,
				removeError.value
					? h('p', { style: styles.error, role: 'alert' }, removeError.value.explanation)
					: null,
				pm?.type === 'link'
					? // Stripe Link: no card details — the Link account is what pays.
						h(
							'p',
							{ style: styles.cardLine },
							pm.email
								? t('billing.paymentMethod.linkWithEmail', { email: pm.email })
								: t('billing.paymentMethod.link'),
						)
					: pm
						? h(
								'p',
								{ style: styles.cardLine },
								t('billing.paymentMethod.card', {
									brand,
									last4: pm.last4,
									month: pm.expMonth,
									year: pm.expYear,
								}),
							)
						: h('p', { style: styles.status }, t('billing.paymentMethod.none')),
				h('div', { style: styles.buttonRow }, [
					h(
						'button',
						{
							type: 'button',
							style: styles.secondaryButton,
							onClick: () => emit('add-payment-method'),
						},
						pm ? t('billing.paymentMethod.update') : t('billing.paymentMethod.add'),
					),
					pm
						? h(
								'button',
								{
									type: 'button',
									disabled: isRemoving.value,
									style: styles.dangerButton,
									onClick: handleRemove,
								},
								isRemoving.value
									? t('billing.paymentMethod.removing')
									: t('billing.paymentMethod.remove'),
							)
						: null,
				]),
			];
		}

		return () => {
			if (isLoading.value)
				return h('p', { style: styles.status }, t('billing.subscription.loading'));
			if (error.value)
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			if (!subscription.value) {
				return h('div', { style: styles.container }, [
					h('p', { style: styles.status }, t('billing.subscription.none')),
					h(
						'button',
						{ type: 'button', style: styles.button, onClick: () => emit('navigate-pricing') },
						t('billing.subscription.viewPlans'),
					),
				]);
			}

			const sub = subscription.value;
			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, t('billing.subscription.title')),
				h('p', { style: styles.plan }, sub.plan),
				h(
					'p',
					{ style: styles.status },
					t(
						sub.cancelAtPeriodEnd
							? 'billing.subscription.statusLineCanceling'
							: 'billing.subscription.statusLine',
						{ status: statusLabel(t, sub.status) },
					),
				),
				sub.currentPeriodEnd
					? h(
							'p',
							{ style: styles.status },
							t(sub.cancelAtPeriodEnd ? 'billing.subscription.ends' : 'billing.subscription.renews', {
								date: new Date(sub.currentPeriodEnd).toLocaleDateString(formatLocale()),
							}),
						)
					: null,
				portalError.value
					? h('p', { style: styles.error, role: 'alert' }, portalError.value.explanation)
					: null,
				h(
					'button',
					{
						type: 'button',
						disabled: isOpeningPortal.value,
						style: styles.button,
						onClick: handleManage,
					},
					isOpeningPortal.value
						? t('billing.subscription.opening')
						: t('billing.subscription.manage'),
				),
				h('div', { style: styles.section }, [
					h('h2', { style: styles.sectionTitle }, t('billing.paymentMethod.title')),
					...renderPaymentMethod(),
				]),
			]);
		};
	},
});
