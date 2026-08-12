import type { ConfigAdminClient } from '@fonderie/client';
import {
	useConfigEntry,
	useConfigRevisions,
	useRevealSecret,
	useSaveConfigEntry,
	useSaveSecret,
	useSecret,
	useSecretRevisions,
} from '@fonderie/vue-config-admin';
import type { PropType } from 'vue';
import { computed, defineComponent, h, ref, watch } from 'vue';
import { styles } from '../styles';

export const ConfigEditorScreen = defineComponent({
	name: 'FonderieConfigEditorScreen',
	props: {
		client: { type: Object as PropType<ConfigAdminClient>, required: true },
		kind: { type: String as PropType<'config' | 'secret'>, required: true },
		configKey: { type: String, required: true },
		environment: { type: String, default: undefined },
	},
	emits: {
		saved: () => true,
	},
	setup(props, { emit }) {
		const isSecret = computed(() => props.kind === 'secret');

		const configEntry = useConfigEntry(
			props.client,
			isSecret.value ? '' : props.configKey,
			props.environment,
		);
		const secretEntry = useSecret(
			props.client,
			isSecret.value ? props.configKey : '',
			props.environment,
		);
		const saveConfig = useSaveConfigEntry(props.client);
		const saveSecret = useSaveSecret(props.client);
		const configRevisions = useConfigRevisions(
			props.client,
			isSecret.value ? '' : props.configKey,
			props.environment,
		);
		const secretRevisions = useSecretRevisions(
			props.client,
			isSecret.value ? props.configKey : '',
			props.environment,
		);
		const { revealSecret, isLoading: isRevealing } = useRevealSecret(props.client);

		const value = ref('');
		const description = ref('');
		const revealedValue = ref<string | null>(null);

		watch(
			() => configEntry.entry.value,
			(entry) => {
				if (isSecret.value || !entry) return;
				value.value = JSON.stringify(entry.value, null, 2);
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
			try {
				if (isSecret.value) {
					const opts: Parameters<typeof saveSecret.saveSecret>[1] = { value: value.value };
					if (description.value) opts.description = description.value;
					await saveSecret.saveSecret(props.configKey, opts, props.environment);
					await secretEntry.refresh();
				} else {
					const opts: Parameters<typeof saveConfig.saveConfigEntry>[1] = {
						value: JSON.parse(value.value),
					};
					if (description.value) opts.description = description.value;
					await saveConfig.saveConfigEntry(props.configKey, opts, props.environment);
					await configEntry.refresh();
				}
				emit('saved');
			} catch {
				// Surfaced via save.error.
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
			const save = isSecret.value ? saveSecret : saveConfig;
			const revisions = isSecret.value ? secretRevisions : configRevisions;

			if (entry.isLoading.value) return h('p', { style: styles.status }, 'Loading…');
			if (entry.error.value)
				return h('p', { style: styles.error, role: 'alert' }, entry.error.value.explanation);

			const version = isSecret.value
				? secretEntry.secret.value?.version
				: configEntry.entry.value?.version;

			return h('div', { style: styles.container }, [
				h('h1', { style: styles.editorTitle }, props.configKey),
				h('p', { style: styles.meta }, `${props.environment ?? 'all'} · v${version}`),

				isSecret.value
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
					h(
						'label',
						{ style: styles.label, for: 'config-value' },
						isSecret.value ? 'New value' : 'Value (JSON)',
					),
					h('textarea', {
						id: 'config-value',
						style: styles.textarea,
						rows: isSecret.value ? 2 : 8,
						required: true,
						value: value.value,
						onInput: (e: Event) => {
							value.value = (e.target as HTMLTextAreaElement).value;
						},
					}),
					h('label', { style: styles.label, for: 'config-description' }, 'Description'),
					h('input', {
						id: 'config-description',
						style: styles.input,
						value: description.value,
						onInput: (e: Event) => {
							description.value = (e.target as HTMLInputElement).value;
						},
					}),
					save.error.value
						? h('p', { style: styles.error, role: 'alert' }, save.error.value.explanation)
						: null,
					h(
						'button',
						{ type: 'submit', disabled: save.isLoading.value, style: styles.button },
						save.isLoading.value ? 'Saving…' : 'Save',
					),
				]),

				revisions.revisions.value.length > 0
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
