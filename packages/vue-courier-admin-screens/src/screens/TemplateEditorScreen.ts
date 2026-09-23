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
import { defineComponent, h, ref, watch } from 'vue';
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

		// One render once the template has loaded, so the pane is never empty on
		// arrival. After that it is explicit — a request per keystroke is not a
		// preview, it is a load test.
		watch(template, (tpl) => {
			if (tpl) void run();
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
					h(
						'button',
						{ type: 'submit', disabled: isSaving.value, style: styles.button },
						isSaving.value ? 'Saving…' : 'Save',
					),
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
				h('div', { style: styles.column }, [
					h('div', { style: styles.previewHeader }, [
						h('span', { style: styles.label }, 'Preview'),
						h(
							'button',
							{
								type: 'button',
								style: styles.rollbackButton,
								disabled: isPreviewing.value,
								onClick: () => void run(),
							},
							isPreviewing.value ? 'Rendering…' : 'Render',
						),
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
