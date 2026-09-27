import type { ConfigAdminClient, IConfigEntry, ISecretEntry } from '@fonderie/client';
import { configValueType, formatConfigValue } from '@fonderie/client';
import { useConfigEntries, useRevealSecret, useSecrets } from '@fonderie/vue-config-admin';
import type { CSSProperties, PropType } from 'vue';
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { styles } from '../styles';

const TYPE_BADGE = { string: 'text', number: 'number', boolean: 'on/off', json: 'json' } as const;

// One line of the value for the list: long text and JSON are cut, not wrapped.
function preview(value: unknown): string {
	const s = formatConfigValue(value).replace(/\s+/g, ' ');
	return s.length > 48 ? `${s.slice(0, 47)}…` : s;
}

const envOf = (e: { environment?: string | null }) => e.environment ?? 'all';

const control: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	height: '28px',
	boxSizing: 'border-box',
	borderRadius: '6px',
	padding: '0 12px',
	fontSize: '13px',
	fontWeight: 500,
	fontFamily: 'inherit',
	cursor: 'pointer',
	whiteSpace: 'nowrap',
};
const local: Record<string, CSSProperties> = {
	envBar: {
		display: 'flex',
		gap: '6px',
		flexWrap: 'wrap',
		border: 'none',
		margin: '0 0 12px',
		padding: '0',
		minWidth: '0',
	},
	envOn: {
		...control,
		backgroundColor: 'var(--fonderie-text,#171717)',
		color: 'var(--fonderie-surface,#fff)',
		border: '1px solid var(--fonderie-text,#171717)',
	},
	envOff: {
		...control,
		backgroundColor: 'var(--fonderie-surface,#fff)',
		color: 'var(--fonderie-text,#171717)',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
	},
	publicBadge: {
		fontSize: '11px',
		fontWeight: 600,
		padding: '1px 7px',
		borderRadius: '999px',
		marginLeft: '8px',
		color: 'var(--fonderie-accent-strong,#009767)',
		background: 'color-mix(in srgb, var(--fonderie-accent-strong,#009767) 13%, transparent)',
	},
	publicBox: {
		marginTop: '16px',
		padding: '12px 16px',
		background: 'var(--fonderie-surface,#fff)',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 'var(--fonderie-radius-lg,8px)',
	},
	publicPre: {
		margin: '0',
		fontSize: '12.5px',
		fontFamily: 'var(--fonderie-mono,ui-monospace,monospace)',
		background: 'var(--fonderie-surface-alt,#fafafa)',
		padding: '12px',
		borderRadius: '6px',
		overflowX: 'auto',
	},
};

export interface IConfigCreateContext {
	environments: string[];
	environment: string | null;
}

export const ConfigListScreen = defineComponent({
	name: 'FonderieConfigListScreen',
	props: {
		client: { type: Object as PropType<ConfigAdminClient>, required: true },
		environment: { type: String, default: undefined },
		/** Show "New entry" / "New secret" buttons (emit create-config / create-secret). */
		allowCreate: { type: Boolean, default: false },
		/**
		 * Where the app serves `GET /config/public` (unauthenticated). Given ⇒
		 * keys exposed to frontends are marked "public", with a preview of exactly
		 * what a browser receives.
		 */
		publicConfigUrl: { type: String, default: undefined },
	},
	emits: {
		// The row's environment comes too: the same key can exist per environment.
		'select-config': (_key: string, _environment: string) => true,
		'select-secret': (_key: string, _environment: string) => true,
		// The environments in use and the one being viewed, to offer and preselect.
		'create-config': (_context: IConfigCreateContext) => true,
		'create-secret': (_context: IConfigCreateContext) => true,
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
		// Every environment in use; the list shows one at a time, or all of them.
		const envFilter = ref<string | null>(null);
		const publicValues = ref<Record<string, unknown> | null>(null);

		onMounted(() => {
			if (!props.publicConfigUrl) return;
			fetch(props.publicConfigUrl, { credentials: 'omit' })
				.then((r) => (r.ok ? r.json() : null))
				.then((body: { result?: { values?: Record<string, unknown> } } | null) => {
					publicValues.value = body?.result?.values ?? null;
				})
				.catch(() => undefined);
		});

		const envs = computed(() =>
			[...new Set([...entries.value.map(envOf), ...secrets.value.map(envOf)])].sort((a, b) =>
				a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b),
			),
		);
		const shownEntries = computed(() =>
			envFilter.value ? entries.value.filter((e) => envOf(e) === envFilter.value) : entries.value,
		);
		const shownSecrets = computed(() =>
			envFilter.value ? secrets.value.filter((e) => envOf(e) === envFilter.value) : secrets.value,
		);
		const createContext = (): IConfigCreateContext => ({
			environments: envs.value,
			environment: envFilter.value,
		});

		// Reveal the row's own environment — the same key can hold a different
		// value per environment, and revealing the list's scope would show the wrong one.
		async function handleReveal(key: string, env: string) {
			try {
				revealed.value[`${key}:${env}`] = await revealSecret(key, env === 'all' ? undefined : env);
			} catch {
				// Surfaced via useRevealSecret's own error state.
			}
		}

		function renderConfigRow(entry: IConfigEntry) {
			const isPublic = publicValues.value !== null && Object.hasOwn(publicValues.value, entry.key);
			return h('li', { key: `${entry.key}:${entry.environment}`, style: styles.row }, [
				h(
					'button',
					{
						type: 'button',
						style: styles.rowButton,
						onClick: () => emit('select-config', entry.key, envOf(entry)),
					},
					[
						h('span', { style: styles.key }, entry.key),
						isPublic
							? h(
									'span',
									{ style: local.publicBadge, title: 'Served to frontends by GET /config/public' },
									'public',
								)
							: null,
						h('span', { style: styles.valuePreview }, preview(entry.value)),
						h('span', { style: styles.badge }, TYPE_BADGE[configValueType(entry.value)]),
						h('span', { style: styles.env }, entry.environment),
					],
				),
			]);
		}

		function renderSecretRow(secret: ISecretEntry) {
			const env = envOf(secret);
			return h('li', { key: `${secret.key}:${secret.environment}`, style: styles.row }, [
				h(
					'button',
					{
						type: 'button',
						style: styles.rowButton,
						onClick: () => emit('select-secret', secret.key, env),
					},
					[
						h('span', { style: styles.key }, secret.key),
						h('span', { style: styles.env }, secret.environment),
					],
				),
				h('span', { style: styles.revealed }, revealed.value[`${secret.key}:${env}`] ?? '••••••••'),
				h(
					'button',
					{
						type: 'button',
						disabled: isRevealing.value,
						style: styles.revealButton,
						onClick: () => handleReveal(secret.key, env),
					},
					'Reveal',
				),
			]);
		}

		return () => {
			const pv = publicValues.value;
			const nPublic = pv ? Object.keys(pv).length : 0;
			return h('div', { style: styles.listContainer }, [
				h('div', { style: { ...styles.heading, marginTop: '0' } }, [
					h('h1', { style: styles.headingTitle }, 'Config'),
					props.allowCreate
						? h(
								'button',
								{
									type: 'button',
									style: styles.newButton,
									onClick: () => emit('create-config', createContext()),
								},
								'New entry',
							)
						: null,
				]),
				h(
					'p',
					{ style: styles.hint },
					'Feature flags and runtime settings — text, numbers, on/off or JSON. Read by the app without a deploy.',
				),
				envs.value.length > 1
					? h(
							'fieldset',
							{ style: local.envBar, 'aria-label': 'Environment' },
							[null, ...envs.value].map((e) =>
								h(
									'button',
									{
										key: e ?? '*',
										type: 'button',
										'aria-pressed': envFilter.value === e,
										style: envFilter.value === e ? local.envOn : local.envOff,
										onClick: () => {
											envFilter.value = e;
										},
									},
									e ?? 'All environments',
								),
							),
						)
					: null,
				isLoadingConfig.value
					? h('p', { style: styles.status }, 'Loading…')
					: configError.value
						? h('p', { style: styles.error, role: 'alert' }, configError.value.explanation)
						: shownEntries.value.length === 0
							? h(
									'p',
									{ style: styles.empty },
									envFilter.value
										? `No config in ${envFilter.value}. Entries in "all" still apply there.`
										: `No config entries yet.${props.allowCreate ? ' Create one to toggle a feature or tune a setting without redeploying.' : ''}`,
								)
							: h('ul', { style: styles.list }, shownEntries.value.map(renderConfigRow)),

				pv
					? h('details', { style: local.publicBox }, [
							h(
								'summary',
								{ style: { cursor: 'pointer', fontWeight: 600, fontSize: '13.5px' } },
								`What frontends receive (${nPublic} public ${nPublic === 1 ? 'key' : 'keys'})`,
							),
							h('p', { style: { ...styles.hint, margin: '8px 0' } }, [
								'Exactly the body of ',
								h('code', 'GET /config/public'),
								' — unauthenticated, so anyone can read it. Only keys the app lists as public appear.',
							]),
							h('pre', { style: local.publicPre }, JSON.stringify(pv, null, 2)),
						])
					: null,

				h('div', { style: styles.heading }, [
					h('h2', { style: styles.headingTitle }, 'Secrets'),
					props.allowCreate
						? h(
								'button',
								{
									type: 'button',
									style: styles.newButton,
									onClick: () => emit('create-secret', createContext()),
								},
								'New secret',
							)
						: null,
				]),
				h('p', { style: styles.hint }, 'Encrypted at rest; values are hidden until revealed.'),
				isLoadingSecrets.value
					? h('p', { style: styles.status }, 'Loading…')
					: secretsError.value
						? h('p', { style: styles.error, role: 'alert' }, secretsError.value.explanation)
						: shownSecrets.value.length === 0
							? h(
									'p',
									{ style: styles.empty },
									envFilter.value ? `No secrets in ${envFilter.value}.` : 'No secrets yet.',
								)
							: h('ul', { style: styles.list }, shownSecrets.value.map(renderSecretRow)),
			]);
		};
	},
});
