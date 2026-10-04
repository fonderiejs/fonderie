import type { BillingClient, IPlanDTO } from '@fonderie/client';
import { canonicalLocaleTag, uiLocaleFor } from '@fonderie/client';
import { useUiT } from '@fonderie/vue';
import { useCheckout, usePlans } from '@fonderie/vue-billing';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

// In the UI language (undefined = the runtime's default), never a hard-coded one.
function formatPrice(cents: number, currency: string, locale: string | undefined): string {
	return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export const PricingScreen = defineComponent({
	name: 'FonderiePricingScreen',
	props: {
		client: { type: Object as PropType<BillingClient>, required: false },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'checkout-start': (_url: string) => true,
	},
	setup(props, { emit }) {
		const { plans, isLoading, error } = usePlans(props.client);
		const { checkout, isLoading: isCheckingOut, error: checkoutError } = useCheckout(props.client);
		const interval = ref<'month' | 'year'>('month');
		const t = useUiT(props.client, () => props.locale);
		// Read at render: t() re-renders on a language change, so this follows it.
		const formatLocale = () => canonicalLocaleTag(props.locale) ?? uiLocaleFor(props.client)?.get();

		async function handleChoose(planName: string) {
			try {
				const url = await checkout({ plan: planName, interval: interval.value });
				emit('checkout-start', url);
			} catch {
				// Surfaced via checkoutError.
			}
		}

		function renderPlanCard(plan: IPlanDTO) {
			const price = interval.value === 'year' ? plan.pricing.yearly : plan.pricing.monthly;
			return h('div', { key: plan.id, style: styles.card }, [
				h('h2', { style: styles.planName }, plan.name),
				h('p', { style: styles.planDescription }, plan.description),
				h('p', { style: styles.price }, [
					formatPrice(price, plan.pricing.currency, formatLocale()),
					h(
						'span',
						{ style: styles.priceInterval },
						interval.value === 'year'
							? t('billing.pricing.perYear')
							: t('billing.pricing.perMonth'),
					),
				]),
				h(
					'ul',
					{ style: styles.features },
					plan.features
						.filter((f) => f.enabled)
						.map((f) => h('li', { key: f.name }, f.description || f.name)),
				),
				h(
					'button',
					{
						type: 'button',
						disabled: isCheckingOut.value,
						style: styles.button,
						onClick: () => handleChoose(plan.name),
					},
					isCheckingOut.value
						? t('billing.pricing.redirecting')
						: t('billing.pricing.choose', { plan: plan.name }),
				),
			]);
		}

		return () => {
			if (isLoading.value) return h('p', { style: styles.status }, t('billing.pricing.loading'));
			if (error.value)
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			return h('div', { style: styles.container }, [
				h('div', { style: styles.toggle }, [
					h(
						'button',
						{
							type: 'button',
							style: interval.value === 'month' ? styles.toggleActive : styles.toggleButton,
							onClick: () => {
								interval.value = 'month';
							},
						},
						t('billing.pricing.monthly'),
					),
					h(
						'button',
						{
							type: 'button',
							style: interval.value === 'year' ? styles.toggleActive : styles.toggleButton,
							onClick: () => {
								interval.value = 'year';
							},
						},
						t('billing.pricing.yearly'),
					),
				]),
				checkoutError.value
					? h('p', { style: styles.error, role: 'alert' }, checkoutError.value.explanation)
					: null,
				h('div', { style: styles.grid }, plans.value.map(renderPlanCard)),
			]);
		};
	},
});
