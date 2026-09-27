import type {
	CourierAdminClient,
	FonderieApiError,
	ISetTemplateInput,
	ITemplateRevision,
} from '@fonderie/client';
import {
	useTemplate,
	useTemplatePreview,
	useTemplateRevisions,
	useTemplates,
} from '@fonderie/vue-courier-admin';
import type { PropType } from 'vue';
import { computed, defineComponent, h, ref, watch } from 'vue';

const PREVIEW_DEBOUNCE_MS = 500;
import { styles } from '../styles';

// Implicit variables the layout injects — an operator never supplies these, so
// offering them as fields would just be noise.
const IMPLICIT = new Set(['subject', 'preheader', 'brandName']);

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

		const {
			preview,
			isPreviewing,
			error: previewError,
			renderPreview,
		} = useTemplatePreview(props.client);
		// Sample values as JSON text rather than an object, so a half-typed value
		// does not have to parse on every keystroke.
		const sampleJson = ref('{}');
		const sampleError = ref<string | null>(null);

		async function run() {
			let data: Record<string, unknown> = {};
			try {
				const parsed: unknown = JSON.parse(sampleJson.value || '{}');
				if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
					sampleError.value = 'Sample data must be a JSON object.';
					return;
				}
				data = parsed as Record<string, unknown>;
				sampleError.value = null;
			} catch {
				sampleError.value = 'Sample data is not valid JSON.';
				return;
			}
			const result = await renderPreview(
				props.type,
				{
					text: text.value,
					data,
					...(subject.value ? { subject: subject.value } : {}),
					...(html.value ? { html: html.value } : {}),
				},
				props.locale,
			);
			// The server reports which variables this content uses; seed the ones
			// with no value yet with their own name so the render shows where each
			// lands. Never overwrite something already typed.
			const missing = result.variables.filter((v) => !IMPLICIT.has(v) && !(v in data));
			if (missing.length > 0) {
				sampleJson.value = JSON.stringify(
					{ ...data, ...Object.fromEntries(missing.map((v) => [v, v])) },
					null,
					2,
				);
			}
		}

		// The preview is always live: it renders once the template loads, then
		// again PREVIEW_DEBOUNCE_MS after the last edit to the content or the sample
		// data — debounced, so typing a paragraph costs one request, not one per key.
		let previewTimer: ReturnType<typeof setTimeout> | undefined;
		watch([template, subject, html, text, sampleJson], () => {
			if (!template.value) return;
			clearTimeout(previewTimer);
			previewTimer = setTimeout(() => void run(), PREVIEW_DEBOUNCE_MS);
		});

		// Saving what is already stored would only mint an identical version (the
		// server treats it as a no-op anyway), so Save waits for a real change.
		const dirty = computed(() => {
			const tpl = template.value;
			return (
				!!tpl &&
				(subject.value !== (tpl.subject ?? '') ||
					html.value !== (tpl.html ?? '') ||
					text.value !== tpl.text ||
					active.value !== tpl.active)
			);
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
				h('div', { style: styles.split }, [
					h('div', { style: styles.column }, [
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
							h('div', { style: styles.saveRow }, [
								h(
									'button',
									{
										type: 'submit',
										disabled: isSaving.value || !dirty.value,
										style: dirty.value ? styles.button : styles.buttonDisabled,
									},
									isSaving.value ? 'Saving…' : 'Save',
								),
								!dirty.value && !isSaving.value
									? h('span', { style: styles.meta }, 'No changes to save')
									: null,
							]),
						]),
						h('label', { style: styles.label, for: 'template-sample' }, 'Sample data'),
						h('textarea', {
							id: 'template-sample',
							style: styles.textarea,
							rows: 6,
							spellcheck: false,
							value: sampleJson.value,
							onInput: (e: Event) => {
								sampleJson.value = (e.target as HTMLTextAreaElement).value;
							},
						}),
						sampleError.value
							? h('p', { style: styles.error, role: 'alert' }, sampleError.value)
							: null,
					]),
					h('div', { style: styles.previewColumn }, [
						h('div', { style: styles.previewHeader }, [
							h('span', { style: styles.label }, 'Preview'),
							h('span', { style: styles.meta }, isPreviewing.value ? 'Rendering…' : 'Live'),
						]),
						previewError.value
							? h('p', { style: styles.error, role: 'alert' }, previewError.value.explanation)
							: null,
						preview.value?.subject
							? h('p', { style: styles.previewSubject }, preview.value.subject)
							: null,
						preview.value?.html
							? // sandbox= — no scripts, no same-origin. Operator-authored HTML
								// must never execute in the dashboard's origin, where the admin
								// token lives.
								h('iframe', {
									title: 'Template preview',
									style: styles.previewFrame,
									sandbox: '',
									srcdoc: preview.value.html,
								})
							: preview.value
								? h('pre', { style: styles.previewText }, preview.value.text)
								: h('p', { style: styles.meta }, 'Nothing rendered yet.'),
					]),
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
