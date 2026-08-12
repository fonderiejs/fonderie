import type { IWebhookDeliveryDTO, WebhooksClient } from '@fonderie/client';
import { useWebhookDeliveries, useWebhookEndpoint } from '@fonderie/vue-webhooks';
import type { PropType } from 'vue';
import { defineComponent, h, ref, watch } from 'vue';
import { styles } from '../styles';

export const WebhookDetailScreen = defineComponent({
	name: 'FonderieWebhookDetailScreen',
	props: {
		client: { type: Object as PropType<WebhooksClient>, required: true },
		endpointId: { type: String, required: true },
	},
	emits: {
		'navigate-list': () => true,
	},
	setup(props, { emit }) {
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
					`${delivery.status} · ${delivery.attempts} attempt${delivery.attempts === 1 ? '' : 's'}${
						delivery.responseStatus !== null ? ` · HTTP ${delivery.responseStatus}` : ''
					}`,
				),
			]);
		}

		return () => {
			if (isLoading.value) return h('p', { style: styles.status }, 'Loading…');
			if (error.value)
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Webhook endpoint'),
				h('form', { style: styles.editForm, onSubmit: handleSubmit }, [
					h('label', { style: styles.label, for: 'webhook-url' }, 'URL'),
					h('input', {
						id: 'webhook-url',
						style: styles.input,
						value: url.value,
						onInput: (e: Event) => {
							url.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('label', { style: styles.label, for: 'webhook-events' }, 'Events (comma-separated)'),
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
						'Enabled',
					]),
					h('button', { type: 'submit', style: styles.button }, 'Save'),
				]),
				h('h2', { style: styles.subtitle }, 'Deliveries'),
				isLoadingDeliveries.value
					? h('p', { style: styles.status }, 'Loading…')
					: h('ul', { style: styles.list }, deliveries.value.map(renderDelivery)),
				h(
					'button',
					{ type: 'button', style: styles.link, onClick: () => emit('navigate-list') },
					'Back to webhooks',
				),
			]);
		};
	},
});
