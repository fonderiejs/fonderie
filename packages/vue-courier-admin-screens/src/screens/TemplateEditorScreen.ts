import type {
	CourierAdminClient,
	FonderieApiError,
	ISetTemplateInput,
	ITemplateRevision,
} from '@fonderie/client';
import { useTemplate, useTemplateRevisions, useTemplates } from '@fonderie/vue-courier-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref, watch } from 'vue';
import { styles } from '../styles';

export const TemplateEditorScreen = defineComponent({
	name: 'FonderieTemplateEditorScreen',
	props: {
		client: { type: Object as PropType<CourierAdminClient>, required: true },
		type: { type: String, required: true },
		locale: { type: String as PropType<string | null>, default: null },
	},
	emits: {
		saved: () => true,
	},
	setup(props, { emit }) {
		const { template, isLoading, error, refresh } = useTemplate(
			props.client,
			props.type,
			props.locale,
		);
		// Saves go through the list composable (which re-fetches the template list
		// after each write); mounting it adds a template-list fetch to this
		// single-template editor — acceptable for an admin dashboard. Its
		// isLoading/error track that list fetch, so the save action keeps local state.
		const { saveTemplate } = useTemplates(props.client);
		const { revisions, rollback } = useTemplateRevisions(props.client, props.type, props.locale);
		const isSaving = ref(false);
		const saveError = ref<FonderieApiError | null>(null);

		const subject = ref('');
		const html = ref('');
		const text = ref('');
		const active = ref(true);

		watch(template, (tpl) => {
			if (!tpl) return;
			subject.value = tpl.subject ?? '';
			html.value = tpl.html ?? '';
			text.value = tpl.text;
			active.value = tpl.active;
		});

		async function handleSubmit(event: Event) {
			event.preventDefault();
			isSaving.value = true;
			saveError.value = null;
			try {
				const input: ISetTemplateInput = { text: text.value, active: active.value };
				if (subject.value) input.subject = subject.value;
				if (html.value) input.html = html.value;
				if (template.value?.version !== undefined) input.ifVersion = template.value.version;
				await saveTemplate(props.type, input, props.locale);
				// The list composable refreshes its own list; this screen renders the
				// single template, so re-read it too.
				await refresh();
				emit('saved');
			} catch (err) {
				// useTemplates normalizes every failure to FonderieApiError before throwing.
				saveError.value = err as FonderieApiError;
			} finally {
				isSaving.value = false;
			}
		}

		function renderRevision(rev: ITemplateRevision) {
			return h('li', { key: rev.version, style: styles.revisionRow }, [
				h(
					'span',
					`v${rev.version} — ${rev.actor ?? 'unknown'} — ${new Date(rev.createdAt).toLocaleString()}`,
				),
				h(
					'button',
					{ type: 'button', style: styles.rollbackButton, onClick: () => rollback(rev.version) },
					'Roll back',
				),
			]);
		}

		return () => {
			if (isLoading.value) return h('p', { style: styles.status }, 'Loading template…');
			if (error.value)
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, props.type),
				h(
					'p',
					{ style: styles.meta },
					`${props.locale ?? 'base'} · v${template.value?.version ?? 1}`,
				),
				h('form', { style: styles.form, onSubmit: handleSubmit }, [
					h('label', { style: styles.label, for: 'template-subject' }, 'Subject'),
					h('input', {
						id: 'template-subject',
						style: styles.input,
						value: subject.value,
						onInput: (e: Event) => {
							subject.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('label', { style: styles.label, for: 'template-html' }, 'HTML body'),
					h('textarea', {
						id: 'template-html',
						style: styles.textarea,
						rows: 8,
						value: html.value,
						onInput: (e: Event) => {
							html.value = (e.target as HTMLTextAreaElement).value;
						},
					}),
					h('label', { style: styles.label, for: 'template-text' }, 'Plain-text body'),
					h('textarea', {
						id: 'template-text',
						style: styles.textarea,
						rows: 4,
						required: true,
						value: text.value,
						onInput: (e: Event) => {
							text.value = (e.target as HTMLTextAreaElement).value;
						},
					}),
					h('label', { style: styles.checkboxLabel }, [
						h('input', {
							type: 'checkbox',
							checked: active.value,
							onChange: (e: Event) => {
								active.value = (e.target as HTMLInputElement).checked;
							},
						}),
						'Active',
					]),
					saveError.value
						? h('p', { style: styles.error, role: 'alert' }, saveError.value.explanation)
						: null,
					h(
						'button',
						{ type: 'submit', disabled: isSaving.value, style: styles.button },
						isSaving.value ? 'Saving…' : 'Save',
					),
				]),
				revisions.value.length > 0
					? h('div', { style: styles.revisions }, [
							h('h2', { style: styles.subtitle }, 'History'),
							h('ul', { style: styles.list }, revisions.value.map(renderRevision)),
						])
					: null,
			]);
		};
	},
});
