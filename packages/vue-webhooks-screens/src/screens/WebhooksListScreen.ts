import type { IWebhookEndpointDTO, WebhooksClient } from '@fonderie/client';
import { useTestWebhookEndpoint, useWebhookEndpoints } from '@fonderie/vue-webhooks';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const WebhooksListScreen = defineComponent({
	name: 'FonderieWebhooksListScreen',
	props: {
		client: { type: Object as PropType<WebhooksClient>, required: true },
	},
	emits: {
		'select-endpoint': (_endpointId: string) => true,
	},
	setup(props, { emit }) {
		const { endpoints, isLoading, error, createEndpoint, removeEndpoint } = useWebhookEndpoints(
			props.client,
		);
		const { testEndpoint, isLoading: isTesting } = useTestWebhookEndpoint(props.client);
		const url = ref('');
		const events = ref('');
		const newSecret = ref<string | null>(null);
		const testResult = ref<string | null>(null);

		async function handleCreate(event: Event) {
			event.preventDefault();
			try {
				const eventList = events.value
					.split(',')
					.map((e) => e.trim())
					.filter(Boolean);
				const input: Parameters<typeof createEndpoint>[0] = { url: url.value };
				if (eventList.length) input.events = eventList;
				const created = await createEndpoint(input);
				newSecret.value = created.secret;
				url.value = '';
				events.value = '';
			} catch {
				// Surfaced via error.
			}
		}

		async function handleTest(endpointId: string) {
			try {
				const result = await testEndpoint(endpointId);
				testResult.value = `${endpointId}: ${result.ok ? 'OK' : `failed (${result.status ?? result.error})`}`;
			} catch {
				// Surfaced via useTestWebhookEndpoint's error state.
			}
		}

		function renderEndpoint(endpoint: IWebhookEndpointDTO) {
			return h('li', { key: endpoint.id, style: styles.row }, [
				h(
					'button',
					{
						type: 'button',
						style: styles.rowButton,
						onClick: () => emit('select-endpoint', endpoint.id),
					},
					[
						h('span', { style: styles.url }, endpoint.url),
						h(
							'span',
							{ style: endpoint.enabled ? styles.enabled : styles.disabled },
							endpoint.enabled ? 'Enabled' : 'Disabled',
						),
					],
				),
				h(
					'button',
					{
						type: 'button',
						disabled: isTesting.value,
						style: styles.smallButton,
						onClick: () => handleTest(endpoint.id),
					},
					'Test',
				),
				h(
					'button',
					{
						type: 'button',
						style: styles.deleteButton,
						onClick: () => removeEndpoint(endpoint.id),
					},
					'Delete',
				),
			]);
		}

		return () =>
			h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Webhooks'),
				newSecret.value
					? h(
							'p',
							{ style: styles.secretBanner },
							`New endpoint secret (shown once): ${newSecret.value}`,
						)
					: null,
				testResult.value ? h('p', { style: styles.status }, testResult.value) : null,
				h('form', { style: styles.form, onSubmit: handleCreate }, [
					h('input', {
						style: styles.input,
						placeholder: 'https://example.com/webhook',
						value: url.value,
						onInput: (e: Event) => {
							url.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('input', {
						style: styles.input,
						placeholder: 'event.type, event.other (optional)',
						value: events.value,
						onInput: (e: Event) => {
							events.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('button', { type: 'submit', style: styles.createButton }, 'Add endpoint'),
				]),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				isLoading.value
					? h('p', { style: styles.status }, 'Loading…')
					: h('ul', { style: styles.list }, endpoints.value.map(renderEndpoint)),
			]);
	},
});
