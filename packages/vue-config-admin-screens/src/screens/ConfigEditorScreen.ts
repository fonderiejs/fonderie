import {
	type ConfigAdminClient,
	type ConfigValueType,
	castConfigValue,
	configKeyProblem,
	configValueLabel,
	configValueType,
	formatConfigValue,
	inferConfigValue,
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

export const ConfigEditorScreen = defineComponent({
	name: 'FonderieConfigEditorScreen',
	props: {
		client: { type: Object as PropType<ConfigAdminClient>, required: true },
		kind: { type: String as PropType<'config' | 'secret'>, required: true },
		/** Empty string ⇒ create mode: the operator names the new key. */
		configKey: { type: String, required: true },
		environment: { type: String, default: undefined },
		/** Environments already in use, offered when creating an entry. */
		environments: { type: Array as PropType<string[]>, default: () => [] },
	},
	emits: {
		saved: () => true,
		/** The entry was deleted and no longer exists. */
		deleted: () => true,
	},
	setup(props, { emit }) {
		const isSecret = computed(() => props.kind === 'secret');
		const isNew = props.configKey === '';
		const newKey = ref('');
		const valueType = ref<ConfigValueType>('string');
		// Free-form mode: creating, or deliberately changing an entry's type. The
		// type is inferred from what is typed; ambiguous input ("true", "42") can
		// be kept as text with one click. Editing otherwise locks the type to
		// what is stored, so a flag cannot silently turn into text.
		const changingType = ref(false);
		const asText = ref(false);
		const freeForm = () => isNew || changingType.value;
		const inputError = ref<string | null>(null);
		const targetKey = () => (isNew ? newKey.value.trim() : props.configKey);
		// Creating: which environment the new entry belongs to. 'all' is the
		// shared value every environment reads unless it has its own.
		const targetEnv = ref(props.environment ?? 'all');
		const isDeleting = ref(false);

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
				const env = targetEnv.value.trim() || 'all';
				const inEnv = (e: { key: string; environment?: string | null }) =>
					e.key === key && (e.environment ?? 'all') === env;
				const taken = isSecret.value
					? secrets.secrets.value.some(inEnv)
					: configEntries.entries.value.some(inEnv);
				if (taken) {
					inputError.value = `"${key}" already exists in ${env} — open it from the list to edit.`;
					return;
				}
			}
			let typed: unknown = value.value;
			if (!isSecret.value) {
				if (freeForm()) {
					typed = asText.value ? value.value : inferConfigValue(value.value).value;
				} else {
					const cast = castConfigValue(valueType.value, value.value);
					if (!cast.ok) {
						inputError.value = cast.error;
						return;
					}
					typed = cast.value;
				}
			}
			isSaving.value = true;
			try {
				// Editing sends the version this screen loaded: if someone changed the
				// entry since, the server answers 409 VERSION_CONFLICT instead of
				// silently overwriting their change.
				const loadedVersion = isSecret.value
					? secretEntry.secret.value?.version
					: configEntry.entry.value?.version;
				const env = isNew ? targetEnv.value.trim() || 'all' : (props.environment ?? 'all');
				const envArg = env === 'all' ? undefined : env;
				if (isSecret.value) {
					const opts: Parameters<typeof secrets.saveSecret>[1] = { value: value.value };
					if (description.value) opts.description = description.value;
					if (!isNew && loadedVersion !== undefined) opts.ifVersion = loadedVersion;
					if (isNew) await props.client.setSecret(key, opts, envArg);
					else await secrets.saveSecret(key, opts);
					// The list composable refreshes its own list; this screen renders
					// the single entry, so re-read it too.
					if (!isNew) await secretEntry.refresh();
				} else {
					const opts: Parameters<typeof configEntries.saveEntry>[1] = { value: typed };
					if (description.value) opts.description = description.value;
					// Only an explicit "Change type" may change an existing key's shape;
					// the server refuses it otherwise (409 CONFIG_TYPE_CHANGE).
					if (changingType.value) opts.allowTypeChange = true;
					if (!isNew && loadedVersion !== undefined) opts.ifVersion = loadedVersion;
					if (isNew) await props.client.setConfig(key, opts, envArg);
					else await configEntries.saveEntry(key, opts);
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

		async function handleDelete() {
			const where =
				props.environment && props.environment !== 'all' ? ` from ${props.environment}` : '';
			if (
				!window.confirm(
					`Delete "${props.configKey}"${where}? Anything that reads it falls back to its default.`,
				)
			)
				return;
			isDeleting.value = true;
			saveError.value = null;
			try {
				if (isSecret.value) await secrets.removeSecret(props.configKey);
				else await configEntries.removeEntry(props.configKey);
				emit('deleted');
			} catch (err) {
				if (err instanceof FonderieApiError) saveError.value = err;
				else inputError.value = (err as Error).message;
			} finally {
				isDeleting.value = false;
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
				h('p', { style: styles.meta }, [
					'Environment: ',
					h('strong', isNew ? targetEnv.value || 'all' : (props.environment ?? 'all')),
					isNew ? null : ` · v${version}`,
				]),

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
								h('label', { style: styles.label, for: 'config-env' }, 'Environment'),
								h('input', {
									id: 'config-env',
									style: styles.input,
									value: targetEnv.value,
									list: 'config-env-options',
									autocomplete: 'off',
									spellcheck: false,
									onInput: (e: Event) => {
										targetEnv.value = (e.target as HTMLInputElement).value;
									},
								}),
								h(
									'datalist',
									{ id: 'config-env-options' },
									[...new Set(['all', ...props.environments])].map((e) =>
										h('option', { key: e, value: e }),
									),
								),
								h(
									'p',
									{
										style: {
											fontSize: '12.5px',
											color: 'var(--fonderie-text-muted,#5c5c5c)',
											margin: '4px 0 0',
										},
									},
									[
										h('code', 'all'),
										' is shared by every environment; a named one (production, staging…) overrides it there.',
									],
								),
							]
						: []),
					h(
						'label',
						{ style: styles.label, for: 'config-value' },
						isSecret.value ? (isNew ? 'Value' : 'New value') : 'Value',
					),
					...(!isSecret.value && freeForm()
						? (() => {
								const inferred = inferConfigValue(value.value);
								return [
									// One field for every shape: text, a number, true/false, or JSON
									// for an object or a list of objects.
									h('textarea', {
										id: 'config-value',
										style: styles.textarea,
										rows: /^\s*[[{]/.test(value.value) || value.value.includes('\n') ? 8 : 2,
										placeholder:
											'true · 42 · Scheduled maintenance tonight · {"ids": ["m1", "m2"]}',
										spellcheck: false,
										value: value.value,
										onInput: (e: Event) => {
											value.value = (e.target as HTMLTextAreaElement).value;
											asText.value = false;
										},
									}),
									h('div', { style: styles.detected }, [
										h('span', ['Detected: ', h('strong', asText.value ? 'Text' : inferred.label)]),
										inferred.ambiguous
											? h('label', { style: styles.inline }, [
													h('input', {
														type: 'checkbox',
														checked: asText.value,
														onChange: (e: Event) => {
															asText.value = (e.target as HTMLInputElement).checked;
														},
													}),
													'Save as text instead',
												])
											: null,
									]),
								];
							})()
						: [
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
									: !isSecret.value &&
											(valueType.value === 'number' || valueType.value === 'string')
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
								!isSecret.value && configEntry.entry.value
									? h('div', { style: styles.detected }, [
											h('span', [
												'Type: ',
												h('strong', configValueLabel(configEntry.entry.value.value)),
											]),
											h(
												'button',
												{
													type: 'button',
													style: styles.linkButton,
													onClick: () => {
														changingType.value = true;
														asText.value = false;
													},
												},
												'Change type…',
											),
										])
									: null,
							]),
					changingType.value
						? h(
								'p',
								{ style: styles.warning },
								'Changing the type changes what every screen reading this key receives. Check the code that reads it first.',
							)
						: null,
					inputError.value
						? h('p', { style: styles.error, role: 'alert' }, inputError.value)
						: null,
					h('label', { style: styles.label, for: 'config-description' }, 'Description'),
					h('input', {
						id: 'config-description',
						style: styles.input,
						value: description.value,
						onInput: (e: Event) => {
							description.value = (e.target as HTMLInputElement).value;
						},
					}),
					saveError.value?.reason === 'VERSION_CONFLICT'
						? h('p', { style: styles.error, role: 'alert' }, [
								'Someone changed this entry since you opened it. Reload to see their change, then edit again. ',
								h(
									'button',
									{
										type: 'button',
										style: styles.revealButton,
										onClick: () => {
											saveError.value = null;
											void entry.refresh();
										},
									},
									'Reload',
								),
							])
						: saveError.value
							? h('p', { style: styles.error, role: 'alert' }, saveError.value.explanation)
							: null,
					h(
						'div',
						{ style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px' } },
						[
							h(
								'button',
								{
									type: 'submit',
									disabled: isSaving.value,
									style: { ...styles.button, marginTop: '0' },
								},
								isSaving.value ? 'Saving…' : 'Save',
							),
							!isNew
								? h(
										'button',
										{
											type: 'button',
											disabled: isDeleting.value,
											onClick: () => void handleDelete(),
											style: {
												...styles.revealButton,
												height: '36px',
												marginLeft: 'auto',
												color: 'var(--fonderie-danger,#e00)',
												borderColor:
													'color-mix(in srgb, var(--fonderie-danger,#e00) 40%, transparent)',
											},
										},
										isDeleting.value ? 'Deleting…' : 'Delete',
									)
								: null,
						],
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
