import type { BillingClient } from '@fonderie/client';
import { useBillingPortal, useSubscription } from '@fonderie/vue-billing';
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
	},
	setup(props, { emit }) {
		const { subscription, isLoading, error } = useSubscription(props.client);
		const {
			openPortal,
			isLoading: isOpeningPortal,
			error: portalError,
		} = useBillingPortal(props.client);

		async function handleManage() {
			try {
				const url = await openPortal();
				emit('manage-billing', url);
			} catch {
				// Surfaced via portalError.
			}
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
			]);
		};
	},
});
