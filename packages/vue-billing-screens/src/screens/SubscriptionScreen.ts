import type { BillingClient } from '@fonderie/client';
import {
	useBillingPortal,
	usePaymentMethod,
	useRemovePaymentMethod,
	useSubscription,
} from '@fonderie/vue-billing';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';

export const SubscriptionScreen = defineComponent({
	name: 'FonderieSubscriptionScreen',
	props: {
		client: { type: Object as PropType<BillingClient>, required: false },
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
		const { remove, isLoading: isRemoving, error: removeError } = useRemovePaymentMethod(props.client);

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
				return [h('p', { style: styles.status }, 'Loading payment method…')];
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
				pm
					? h(
							'p',
							{ style: styles.cardLine },
							`${brand} •••• ${pm.last4} · expires ${pm.expMonth}/${pm.expYear}`,
						)
					: h('p', { style: styles.status }, 'No card on file.'),
				h('div', { style: styles.buttonRow }, [
					h(
						'button',
						{
							type: 'button',
							style: styles.secondaryButton,
							onClick: () => emit('add-payment-method'),
						},
						pm ? 'Update card' : 'Add card',
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
								isRemoving.value ? 'Removing…' : 'Remove',
							)
						: null,
				]),
			];
		}

		return () => {
			if (isLoading.value) return h('p', { style: styles.status }, 'Loading subscription…');
			if (error.value)
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			if (!subscription.value) {
				return h('div', { style: styles.container }, [
					h('p', { style: styles.status }, "You don't have an active subscription."),
					h(
						'button',
						{ type: 'button', style: styles.button, onClick: () => emit('navigate-pricing') },
						'View plans',
					),
				]);
			}

			const sub = subscription.value;
			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Your subscription'),
				h('p', { style: styles.plan }, sub.plan),
				h(
					'p',
					{ style: styles.status },
					`Status: ${sub.status}${sub.cancelAtPeriodEnd ? ' (cancels at period end)' : ''}`,
				),
				sub.currentPeriodEnd
					? h(
							'p',
							{ style: styles.status },
							`Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`,
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
					isOpeningPortal.value ? 'Opening…' : 'Manage billing',
				),
				h('div', { style: styles.section }, [
					h('h2', { style: styles.sectionTitle }, 'Payment method'),
					...renderPaymentMethod(),
				]),
			]);
		};
	},
});
