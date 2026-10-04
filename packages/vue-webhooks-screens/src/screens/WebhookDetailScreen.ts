import type { IWebhookDeliveryDTO, WebhooksClient } from '@fonderie/client';
import { useUiT } from '@fonderie/vue';
import { useWebhookDeliveries, useWebhookEndpoint } from '@fonderie/vue-webhooks';
import type { PropType } from 'vue';
import { defineComponent, h, ref, watch } from 'vue';
import { styles } from '../styles';

export const WebhookDetailScreen = defineComponent({
	name: 'FonderieWebhookDetailScreen',
	props: {
		client: { type: Object as PropType<WebhooksClient>, required: false },
		endpointId: { type: String, required: true },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'navigate-list': () => true,
	},
	setup(props, { emit }) {
		const t = useUiT(props.client, () => props.locale);
		const statusLabel = (status: string) =>
			status === 'pending' || status === 'delivered' || status === 'failed'
				? t(`webhooks.status.${status}`)
				: status;
		const { endpoint, isLoading, error, updateEndpoint } = useWebhookEndpoint(
			props.client,
			props.endpointId,
		);
		const { deliveries, isLoading: isLoadingDeliveries } = useWebhookDeliveries(
			props.client,
			props.endpointId,
		);

		const url = ref('');
		const events = ref('');
		const enabled = ref(true);

		watch(
			() => endpoint.value,
			(ep) => {
				if (!ep) return;
				url.value = ep.url;
				events.value = ep.events.join(', ');
				enabled.value = ep.enabled;
			},
		);

		async function handleSubmit(event: Event) {
			event.preventDefault();
			try {
				await updateEndpoint({
					url: url.value,
					events: events.value
						.split(',')
						.map((e) => e.trim())
						.filter(Boolean),
					enabled: enabled.value,
				});
			} catch {
				// Surfaced via error.
			}
		}

		function renderDelivery(delivery: IWebhookDeliveryDTO) {
			return h('li', { key: delivery.id, style: styles.deliveryRow }, [
				h('span', { style: styles.eventType }, delivery.eventType),
				h(
					'span',
					{ style: styles.meta },
					`${statusLabel(delivery.status)} · ${t(
						delivery.attempts === 1
							? 'webhooks.detail.attemptsOne'
							: 'webhooks.detail.attemptsOther',
						{ count: delivery.attempts },
					)}${delivery.responseStatus !== null ? ` · HTTP ${delivery.responseStatus}` : ''}`,
				),
			]);
		}

		return () => {
			if (isLoading.value) return h('p', { style: styles.status }, t('webhooks.loading'));
			if (error.value)
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, t('webhooks.detail.title')),
				h('form', { style: styles.editForm, onSubmit: handleSubmit }, [
					h('label', { style: styles.label, for: 'webhook-url' }, t('webhooks.detail.url')),
					h('input', {
						id: 'webhook-url',
						style: styles.input,
						value: url.value,
						onInput: (e: Event) => {
							url.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('label', { style: styles.label, for: 'webhook-events' }, t('webhooks.detail.events')),
					h('input', {
						id: 'webhook-events',
						style: styles.input,
						value: events.value,
						onInput: (e: Event) => {
							events.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('label', { style: styles.checkboxLabel }, [
						h('input', {
							type: 'checkbox',
							checked: enabled.value,
							onChange: (e: Event) => {
								enabled.value = (e.target as HTMLInputElement).checked;
							},
						}),
						t('webhooks.enabled'),
					]),
					h('button', { type: 'submit', style: styles.button }, t('webhooks.detail.save')),
				]),
				h('h2', { style: styles.subtitle }, t('webhooks.detail.deliveries')),
				isLoadingDeliveries.value
					? h('p', { style: styles.status }, t('webhooks.loading'))
					: h('ul', { style: styles.list }, deliveries.value.map(renderDelivery)),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-list') },
					t('webhooks.detail.back'),
				),
			]);
		};
	},
});
