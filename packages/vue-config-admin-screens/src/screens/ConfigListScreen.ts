import type { ConfigAdminClient, IConfigEntry, ISecretEntry } from '@fonderie/client';
import { configValueType, formatConfigValue } from '@fonderie/client';
import { useConfigEntries, useRevealSecret, useSecrets } from '@fonderie/vue-config-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

const TYPE_BADGE = { string: 'text', number: 'number', boolean: 'on/off', json: 'json' } as const;

// One line of the value for the list: long text and JSON are cut, not wrapped.
function preview(value: unknown): string {
	const s = formatConfigValue(value).replace(/\s+/g, ' ');
	return s.length > 48 ? `${s.slice(0, 47)}…` : s;
}

export const ConfigListScreen = defineComponent({
	name: 'FonderieConfigListScreen',
	props: {
		client: { type: Object as PropType<ConfigAdminClient>, required: true },
		environment: { type: String, default: undefined },
		/** Show "New entry" / "New secret" buttons (emit create-config / create-secret). */
		allowCreate: { type: Boolean, default: false },
	},
	emits: {
		'select-config': (_key: string) => true,
		'select-secret': (_key: string) => true,
		'create-config': () => true,
		'create-secret': () => true,
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
						h('span', { style: styles.valuePreview }, preview(entry.value)),
						h('span', { style: styles.badge }, TYPE_BADGE[configValueType(entry.value)]),
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
			h('div', { style: styles.listContainer }, [
				h('div', { style: { ...styles.heading, marginTop: '0' } }, [
					h('h1', { style: styles.headingTitle }, 'Config'),
					props.allowCreate
						? h(
								'button',
								{ type: 'button', style: styles.newButton, onClick: () => emit('create-config') },
								'New entry',
							)
						: null,
				]),
				h(
					'p',
					{ style: styles.hint },
					'Feature flags and runtime settings — text, numbers, on/off or JSON. Read by the app without a deploy.',
				),
				isLoadingConfig.value
					? h('p', { style: styles.status }, 'Loading…')
					: configError.value
						? h('p', { style: styles.error, role: 'alert' }, configError.value.explanation)
						: entries.value.length === 0
							? h(
									'p',
									{ style: styles.empty },
									`No config entries yet.${props.allowCreate ? ' Create one to toggle a feature or tune a setting without redeploying.' : ''}`,
								)
							: h('ul', { style: styles.list }, entries.value.map(renderConfigRow)),

				h('div', { style: styles.heading }, [
					h('h2', { style: styles.headingTitle }, 'Secrets'),
					props.allowCreate
						? h(
								'button',
								{ type: 'button', style: styles.newButton, onClick: () => emit('create-secret') },
								'New secret',
							)
						: null,
				]),
				h('p', { style: styles.hint }, 'Encrypted at rest; values are hidden until revealed.'),
				isLoadingSecrets.value
					? h('p', { style: styles.status }, 'Loading…')
					: secretsError.value
						? h('p', { style: styles.error, role: 'alert' }, secretsError.value.explanation)
						: secrets.value.length === 0
							? h('p', { style: styles.empty }, 'No secrets yet.')
							: h('ul', { style: styles.list }, secrets.value.map(renderSecretRow)),
			]);
	},
});
