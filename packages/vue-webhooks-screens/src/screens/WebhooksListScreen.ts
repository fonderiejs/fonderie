import type { IWebhookEndpointDTO, WebhooksClient } from '@fonderie/client';
import { useUiError, useUiT } from '@fonderie/vue';
import { useWebhookEndpoints } from '@fonderie/vue-webhooks';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const WebhooksListScreen = defineComponent({
	name: 'FonderieWebhooksListScreen',
	props: {
		client: { type: Object as PropType<WebhooksClient>, required: false },
		/** The language for this screen only; default: the client's UI language (client.setLocale). */
		locale: { type: String, required: false },
	},
	emits: {
		'select-endpoint': (_endpointId: string) => true,
	},
	setup(props, { emit }) {
		const t = useUiT(props.client, () => props.locale);
		const errorText = useUiError(props.client, () => props.locale);
		const { endpoints, isLoading, error, createEndpoint, removeEndpoint, testEndpoint } =
			useWebhookEndpoints(props.client);
		const isTesting = ref(false);
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
			isTesting.value = true;
			try {
				const result = await testEndpoint(endpointId);
				testResult.value = result.ok
					? t('webhooks.list.testOk', { endpoint: endpointId })
					: t('webhooks.list.testFailed', {
							endpoint: endpointId,
							reason: String(result.status ?? result.error),
						});
			} catch {
				// Surfaced via `error` from useWebhookEndpoints.
			} finally {
				isTesting.value = false;
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
							endpoint.enabled ? t('webhooks.enabled') : t('webhooks.disabled'),
						),
					],
				),
				h(
					'button',
					{
						type: 'button',
						disabled: isTesting.value,
						style: styles.smallButton,
						'aria-label': t('webhooks.list.a11y.test', { url: endpoint.url }),
						onClick: () => handleTest(endpoint.id),
					},
					t('webhooks.list.test'),
				),
				h(
					'button',
					{
						type: 'button',
						style: styles.deleteButton,
						'aria-label': t('webhooks.list.a11y.delete', { url: endpoint.url }),
						onClick: () => removeEndpoint(endpoint.id),
					},
					t('webhooks.list.delete'),
				),
			]);
		}

		return () =>
			h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, t('webhooks.list.title')),
				newSecret.value
					? h(
							'p',
							{ style: styles.secretBanner },
							`${t('webhooks.list.newSecret')} ${newSecret.value}`,
						)
					: null,
				testResult.value ? h('p', { style: styles.status }, testResult.value) : null,
				h('form', { style: styles.form, onSubmit: handleCreate }, [
					h('input', {
						style: styles.input,
						placeholder: t('webhooks.list.urlPlaceholder'),
						'aria-label': t('webhooks.list.a11y.url'),
						value: url.value,
						onInput: (e: Event) => {
							url.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('input', {
						style: styles.input,
						placeholder: t('webhooks.list.eventsPlaceholder'),
						'aria-label': t('webhooks.list.a11y.events'),
						value: events.value,
						onInput: (e: Event) => {
							events.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('button', { type: 'submit', style: styles.createButton }, t('webhooks.list.add')),
				]),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, errorText(error.value))
					: null,
				isLoading.value
					? h('p', { style: styles.status }, t('webhooks.loading'))
					: h('ul', { style: styles.list }, endpoints.value.map(renderEndpoint)),
			]);
	},
});
