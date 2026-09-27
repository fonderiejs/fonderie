import {
	type ConfigAdminClient,
	type ConfigValueType,
	CONFIG_VALUE_TYPES,
	castConfigValue,
	configKeyProblem,
	configValueType,
	formatConfigValue,
} from '@fonderie/client';
import {
	FonderieApiError,
	useConfigEntries,
	useConfigEntry,
	useConfigRevisions,
	useRevealSecret,
	useSecret,
	useSecretRevisions,
	useSecrets,
} from '@fonderie/vue-config-admin';
import type { PropType } from 'vue';
import { computed, defineComponent, h, ref, watch } from 'vue';
import { styles } from '../styles';

const TYPE_LABEL: Record<ConfigValueType, string> = {
	string: 'Text',
	number: 'Number',
	boolean: 'On / off',
	json: 'JSON (list or object)',
};

export const ConfigEditorScreen = defineComponent({
	name: 'FonderieConfigEditorScreen',
	props: {
		client: { type: Object as PropType<ConfigAdminClient>, required: true },
		kind: { type: String as PropType<'config' | 'secret'>, required: true },
		/** Empty string ⇒ create mode: the operator names the new key. */
		configKey: { type: String, required: true },
		environment: { type: String, default: undefined },
	},
	emits: {
		saved: () => true,
	},
	setup(props, { emit }) {
		const isSecret = computed(() => props.kind === 'secret');
		const isNew = props.configKey === '';
		const newKey = ref('');
		const valueType = ref<ConfigValueType>('string');
		const inputError = ref<string | null>(null);
		const targetKey = () => (isNew ? newKey.value.trim() : props.configKey);

		const configEntry = useConfigEntry(
			props.client,
			isSecret.value || isNew ? '' : props.configKey,
			props.environment,
		);
		const secretEntry = useSecret(
			props.client,
			isSecret.value && !isNew ? props.configKey : '',
			props.environment,
		);
		// Saves go through the list composables (which re-fetch their lists after
		// each write); mounting them adds a config-list and a secrets-list fetch
		// to this single-entry editor — acceptable for an admin dashboard.
		const configEntries = useConfigEntries(props.client, props.environment);
		const secrets = useSecrets(props.client, props.environment);
		const configRevisions = useConfigRevisions(
			props.client,
			isSecret.value || isNew ? '' : props.configKey,
			props.environment,
		);
		const secretRevisions = useSecretRevisions(
			props.client,
			isSecret.value && !isNew ? props.configKey : '',
			props.environment,
		);
		const { revealSecret, isLoading: isRevealing } = useRevealSecret(props.client);

		const value = ref('');
		const description = ref('');
		const revealedValue = ref<string | null>(null);
		// The list composables' isLoading/error track their list fetches (and are
		// shared across mutations), so the save action keeps its own state.
		const isSaving = ref(false);
		const saveError = ref<FonderieApiError | null>(null);

		watch(
			() => configEntry.entry.value,
			(entry) => {
				if (isSecret.value || !entry) return;
				valueType.value = configValueType(entry.value);
				value.value = formatConfigValue(entry.value, valueType.value);
				description.value = entry.description ?? '';
			},
		);

		watch(
			() => secretEntry.secret.value,
			(secret) => {
				if (!isSecret.value || !secret) return;
				description.value = secret.description ?? '';
			},
		);

		async function handleSubmit(event: Event) {
			event.preventDefault();
			saveError.value = null;
			inputError.value = null;
			const key = targetKey();
			if (isNew) {
				const problem = configKeyProblem(key);
				if (problem) {
					inputError.value = problem;
					return;
				}
				// Creating must never overwrite: a save to an existing key would
				// silently replace its value.
				const taken = isSecret.value
					? secrets.secrets.value.some((s) => s.key === key)
					: configEntries.entries.value.some((e) => e.key === key);
				if (taken) {
					inputError.value = `"${key}" already exists — open it from the list to edit.`;
					return;
				}
			}
			let typed: unknown = value.value;
			if (!isSecret.value) {
				const cast = castConfigValue(valueType.value, value.value);
				if (!cast.ok) {
					inputError.value = cast.error;
					return;
				}
				typed = cast.value;
			}
			isSaving.value = true;
			try {
				if (isSecret.value) {
					const opts: Parameters<typeof secrets.saveSecret>[1] = { value: value.value };
					if (description.value) opts.description = description.value;
					await secrets.saveSecret(key, opts);
					// The list composable refreshes its own list; this screen renders
					// the single entry, so re-read it too.
					if (!isNew) await secretEntry.refresh();
				} else {
					const opts: Parameters<typeof configEntries.saveEntry>[1] = { value: typed };
					if (description.value) opts.description = description.value;
					await configEntries.saveEntry(key, opts);
					if (!isNew) await configEntry.refresh();
				}
				emit('saved');
			} catch (err) {
				if (err instanceof FonderieApiError) saveError.value = err;
				else inputError.value = (err as Error).message;
			} finally {
				isSaving.value = false;
			}
		}

		async function handleReveal() {
			try {
				revealedValue.value = await revealSecret(props.configKey, props.environment);
			} catch {
				// Surfaced via useRevealSecret's error state.
			}
		}

		return () => {
			const entry = isSecret.value ? secretEntry : configEntry;
			const revisions = isSecret.value ? secretRevisions : configRevisions;

			if (!isNew && entry.isLoading.value) return h('p', { style: styles.status }, 'Loading…');
			if (!isNew && entry.error.value)
				return h('p', { style: styles.error, role: 'alert' }, entry.error.value.explanation);

			const version = isSecret.value
				? secretEntry.secret.value?.version
				: configEntry.entry.value?.version;

			return h('div', { style: styles.container }, [
				h(
					'h1',
					{ style: styles.editorTitle },
					isNew ? (isSecret.value ? 'New secret' : 'New config entry') : props.configKey,
				),
				h('p', { style: styles.meta }, isNew ? (props.environment ?? 'all') : `${props.environment ?? 'all'} · v${version}`),

				isSecret.value && !isNew
					? h('div', { style: styles.revealBox }, [
							h('span', {}, revealedValue.value ?? '••••••••'),
							h(
								'button',
								{
									type: 'button',
									disabled: isRevealing.value,
									style: styles.revealButton,
									onClick: handleReveal,
								},
								'Reveal',
							),
						])
					: null,

				h('form', { style: styles.form, onSubmit: handleSubmit }, [
					...(isNew
						? [
								h('label', { style: styles.label, for: 'config-key' }, 'Key'),
								h('input', {
									id: 'config-key',
									style: styles.input,
									value: newKey.value,
									placeholder: isSecret.value ? 'STRIPE_SECRET_KEY' : 'ENABLE_JOB_LISTING',
									autocomplete: 'off',
									spellcheck: false,
									required: true,
									onInput: (e: Event) => {
										newKey.value = (e.target as HTMLInputElement).value;
									},
								}),
							]
						: []),
					...(!isSecret.value
						? [
								h('label', { style: styles.label, for: 'config-type' }, 'Type'),
								h(
									'select',
									{
										id: 'config-type',
										style: styles.input,
										value: valueType.value,
										onChange: (e: Event) => {
											const next = (e.target as HTMLSelectElement).value as ConfigValueType;
											// Carry the value across when it still makes sense
											// (e.g. "true" → On/off); otherwise start clean.
											const cast = castConfigValue(next, value.value);
											value.value = cast.ok ? formatConfigValue(cast.value, next) : next === 'boolean' ? 'false' : '';
											valueType.value = next;
											inputError.value = null;
										},
									},
									CONFIG_VALUE_TYPES.map((t) => h('option', { value: t, selected: t === valueType.value }, TYPE_LABEL[t])),
								),
							]
						: []),
					h(
						'label',
						{ style: styles.label, for: 'config-value' },
						isSecret.value ? (isNew ? 'Value' : 'New value') : 'Value',
					),
					!isSecret.value && valueType.value === 'boolean'
						? h('label', { style: styles.toggle }, [
								h('input', {
									id: 'config-value',
									type: 'checkbox',
									checked: value.value === 'true',
									onChange: (e: Event) => {
										value.value = (e.target as HTMLInputElement).checked ? 'true' : 'false';
									},
								}),
								value.value === 'true' ? 'On (true)' : 'Off (false)',
							])
						: !isSecret.value && (valueType.value === 'number' || valueType.value === 'string')
							? h('input', {
									id: 'config-value',
									style: styles.input,
									inputmode: valueType.value === 'number' ? 'decimal' : undefined,
									required: valueType.value === 'number',
									value: value.value,
									onInput: (e: Event) => {
										value.value = (e.target as HTMLInputElement).value;
									},
								})
							: h('textarea', {
									id: 'config-value',
									style: styles.textarea,
									rows: isSecret.value ? 2 : 8,
									spellcheck: false,
									required: true,
									value: value.value,
									onInput: (e: Event) => {
										value.value = (e.target as HTMLTextAreaElement).value;
									},
								}),
					inputError.value ? h('p', { style: styles.error, role: 'alert' }, inputError.value) : null,
					h('label', { style: styles.label, for: 'config-description' }, 'Description'),
					h('input', {
						id: 'config-description',
						style: styles.input,
						value: description.value,
						onInput: (e: Event) => {
							description.value = (e.target as HTMLInputElement).value;
						},
					}),
					saveError.value
						? h('p', { style: styles.error, role: 'alert' }, saveError.value.explanation)
						: null,
					h(
						'button',
						{ type: 'submit', disabled: isSaving.value, style: styles.button },
						isSaving.value ? 'Saving…' : 'Save',
					),
				]),

				!isNew && revisions.revisions.value.length > 0
					? h('div', { style: styles.revisions }, [
							h('h2', { style: styles.subtitle }, 'History'),
							h(
								'ul',
								{ style: styles.list },
								revisions.revisions.value.map((rev) =>
									h('li', { key: rev.version, style: styles.revisionRow }, [
										h(
											'span',
											`v${rev.version} — ${rev.actor ?? 'unknown'} — ${new Date(rev.createdAt).toLocaleString()}`,
										),
										h(
											'button',
											{
												type: 'button',
												style: styles.revealButton,
												onClick: () => revisions.rollback(rev.version),
											},
											'Roll back',
										),
									]),
								),
							),
						])
					: null,
			]);
		};
	},
});
