import type { ConfigAdminClient, IConfigEntry, ISecretEntry } from '@fonderie/client';
import { useConfigEntries, useRevealSecret, useSecrets } from '@fonderie/vue-config-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const ConfigListScreen = defineComponent({
	name: 'FonderieConfigListScreen',
	props: {
		client: { type: Object as PropType<ConfigAdminClient>, required: true },
		environment: { type: String, default: undefined },
	},
	emits: {
		'select-config': (_key: string) => true,
		'select-secret': (_key: string) => true,
	},
	setup(props, { emit }) {
		const {
			entries,
			isLoading: isLoadingConfig,
			error: configError,
		} = useConfigEntries(props.client, props.environment);
		const {
			secrets,
			isLoading: isLoadingSecrets,
			error: secretsError,
		} = useSecrets(props.client, props.environment);
		const { revealSecret, isLoading: isRevealing } = useRevealSecret(props.client);
		const revealed = ref<Record<string, string>>({});

		async function handleReveal(key: string) {
			try {
				revealed.value[key] = await revealSecret(key, props.environment);
			} catch {
				// Surfaced via useRevealSecret's own error state.
			}
		}

		function renderConfigRow(entry: IConfigEntry) {
			return h('li', { key: `${entry.key}:${entry.environment}`, style: styles.row }, [
				h(
					'button',
					{
						type: 'button',
						style: styles.rowButton,
						onClick: () => emit('select-config', entry.key),
					},
					[
						h('span', { style: styles.key }, entry.key),
						h('span', { style: styles.env }, entry.environment),
					],
				),
			]);
		}

		function renderSecretRow(secret: ISecretEntry) {
			return h('li', { key: `${secret.key}:${secret.environment}`, style: styles.row }, [
				h(
					'button',
					{
						type: 'button',
						style: styles.rowButton,
						onClick: () => emit('select-secret', secret.key),
					},
					[
						h('span', { style: styles.key }, secret.key),
						h('span', { style: styles.env }, secret.environment),
					],
				),
				h('span', { style: styles.revealed }, revealed.value[secret.key] ?? '••••••••'),
				h(
					'button',
					{
						type: 'button',
						disabled: isRevealing.value,
						style: styles.revealButton,
						onClick: () => handleReveal(secret.key),
					},
					'Reveal',
				),
			]);
		}

		return () =>
			h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Config'),
				isLoadingConfig.value
					? h('p', { style: styles.status }, 'Loading…')
					: configError.value
						? h('p', { style: styles.error, role: 'alert' }, configError.value.explanation)
						: h('ul', { style: styles.list }, entries.value.map(renderConfigRow)),

				h('h1', { style: styles.title }, 'Secrets'),
				isLoadingSecrets.value
					? h('p', { style: styles.status }, 'Loading…')
					: secretsError.value
						? h('p', { style: styles.error, role: 'alert' }, secretsError.value.explanation)
						: h('ul', { style: styles.list }, secrets.value.map(renderSecretRow)),
			]);
	},
});
