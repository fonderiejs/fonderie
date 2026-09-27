import type {
	AdminLocale,
	AdminMessageKey,
	AdminMessageParams,
	CourierAdminClient,
	ISetTemplateInput,
} from '@fonderie/client';
import { createAdminT, FonderieApiError } from '@fonderie/client';
import { useTemplatePreview } from '@fonderie/vue-courier-admin';
import type { PropType } from 'vue';
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue';
import { styles } from '../styles';

const TYPE_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/;
const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
// Variables the layout injects — never sample values, as in the editor.
const IMPLICIT = new Set(['subject', 'preheader', 'brandName']);
const PREVIEW_DEBOUNCE_MS = 500;
const notice = {
	fontSize: '13px',
	color: 'var(--fonderie-text,#171717)',
	background: 'color-mix(in srgb, var(--fonderie-warning,#f5a623) 16%, transparent)',
	borderRadius: '6px',
	padding: '8px 12px',
	margin: '12px 0 0',
};

// Creating is its own screen: the editor loads an existing row, and a new
// template or locale has none yet. Once saved, the editor takes over.
export const TemplateCreateScreen = defineComponent({
	name: 'FonderieTemplateCreateScreen',
	props: {
		client: { type: Object as PropType<CourierAdminClient>, required: true },
		/**
		 * Given ⇒ add a LOCALE of this existing template: the type is fixed and the
		 * form starts from its default-locale copy. Omitted ⇒ a brand-new template
		 * type (one the app sends that has no stored copy yet).
		 */
		type: { type: String, default: undefined },
		/** Locales already in use, offered as suggestions. */
		locales: { type: Array as PropType<string[]>, default: () => [] },
		/** The system locale: the default version already is it, so adding it is refused. */
		defaultLocale: { type: String, default: undefined },
		/** The console language; defaults to English. */
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	emits: {
		/** What was created, so the caller can open it in the editor. */
		created: (_created: { type: string; locale: string | null }) => true,
	},
	setup(props, { emit }) {
		const addingLocale = props.type !== undefined;
		const newType = ref('');
		const targetLocale = ref('');
		const subject = ref('');
		const html = ref('');
		const text = ref('');
		const error = ref<string | null>(null);
		const busy = ref(false);
		// The default copy this locale started from, to flag fields not yet translated.
		const source = ref<{ subject: string; html: string; text: string } | null>(null);
		const {
			preview,
			isPreviewing,
			error: previewError,
			renderPreview,
		} = useTemplatePreview(props.client);
		// Each variable renders as its own name, so the preview shows where it
		// lands. Learned from the server's answer, not re-parsed here.
		let variables: string[] = [];
		// `tr`, not `t`: submit() uses `t` for the template type.
		const tr = (key: AdminMessageKey, params?: AdminMessageParams) =>
			createAdminT(props.locale)(key, params);

		// A new locale starts from the default copy, so translating is editing.
		onMounted(() => {
			if (!props.type) return;
			props.client
				.getTemplate(props.type, null)
				// A built-in email nobody saved has no stored default: start from
				// Fonderie's English instead of an empty form.
				.catch(() => props.client.getBuiltInTemplate(props.type as string, null))
				.then(({ result }) => {
					subject.value = result.subject ?? '';
					html.value = result.html ?? '';
					text.value = result.text;
					source.value = {
						subject: result.subject ?? '',
						html: result.html ?? '',
						text: result.text,
					};
				})
				.catch(() => undefined);
		});

		// Live preview, as in the editor: translating is where it matters most — a
		// half-translated email looks finished in a textarea and wrong in the render.
		let timer: ReturnType<typeof setTimeout> | undefined;
		watch([newType, targetLocale, subject, html, text], () => {
			clearTimeout(timer);
			const type = addingLocale ? (props.type as string) : newType.value.trim();
			const l = targetLocale.value.trim();
			if (!TYPE_RE.test(type) || !text.value.trim()) return;
			timer = setTimeout(async () => {
				const input = {
					text: text.value,
					...(subject.value ? { subject: subject.value } : {}),
					...(html.value ? { html: html.value } : {}),
				};
				const render = () =>
					renderPreview(
						type,
						{ ...input, data: Object.fromEntries(variables.map((v) => [v, v])) },
						LOCALE_RE.test(l) ? l : null,
					);
				try {
					const result = await render();
					const used = result.variables.filter((v) => !IMPLICIT.has(v));
					// A variable not seen before rendered empty: render once more with it.
					if (used.some((v) => !variables.includes(v))) {
						variables = used;
						await render();
					}
				} catch {
					// Shown through previewError.
				}
			}, PREVIEW_DEBOUNCE_MS);
		});

		const untranslated = computed(() => {
			const src = source.value;
			if (!src) return [];
			return [
				subject.value && subject.value === src.subject ? tr('templates.subject') : null,
				html.value && html.value === src.html ? tr('templates.htmlBody') : null,
				text.value === src.text ? tr('templates.textBody') : null,
			].filter((f): f is string => f !== null);
		});

		async function submit(e: Event) {
			e.preventDefault();
			error.value = null;
			const t = addingLocale ? (props.type as string) : newType.value.trim();
			const l = targetLocale.value.trim() || null;
			if (!TYPE_RE.test(t)) {
				error.value = tr('templates.create.errorType');
				return;
			}
			if (addingLocale && !l) {
				error.value = tr('templates.create.errorLocaleRequired');
				return;
			}
			if (l && !LOCALE_RE.test(l)) {
				error.value = tr('templates.create.errorLocale');
				return;
			}
			if (l && props.defaultLocale && l.toLowerCase() === props.defaultLocale.toLowerCase()) {
				error.value = tr('templates.create.errorDefaultLocale', { locale: props.defaultLocale });
				return;
			}
			if (!text.value.trim()) {
				error.value = tr('templates.create.errorText');
				return;
			}
			busy.value = true;
			try {
				// Refuse to overwrite: creating an existing row would replace it.
				const exists = await props.client.getTemplate(t, l).then(
					() => true,
					(err: unknown) => !(err instanceof FonderieApiError && err.status === 404),
				);
				if (exists) {
					error.value = l
						? tr('templates.create.existsLocale', { type: t, locale: l })
						: tr('templates.create.exists', { type: t });
					return;
				}
				const input: ISetTemplateInput = { text: text.value, active: true };
				if (subject.value) input.subject = subject.value;
				if (html.value) input.html = html.value;
				await props.client.setTemplate(t, input, l);
				emit('created', { type: t, locale: l });
			} catch (err) {
				error.value = err instanceof FonderieApiError ? err.explanation : String(err);
			} finally {
				busy.value = false;
			}
		}

		const field = (
			id: string,
			label: string,
			model: typeof subject,
			opts: Record<string, unknown> = {},
		) => [
			h('label', { style: styles.label, for: id }, label),
			h(opts.textarea ? 'textarea' : 'input', {
				id,
				style: opts.textarea ? { ...styles.textarea, minHeight: opts.minHeight } : styles.input,
				value: model.value,
				autocomplete: 'off',
				spellcheck: false,
				...(opts.placeholder ? { placeholder: opts.placeholder } : {}),
				...(opts.list ? { list: opts.list } : {}),
				onInput: (ev: Event) => {
					model.value = (ev.target as HTMLInputElement).value;
				},
			}),
		];

		return () =>
			h('div', { style: styles.container }, [
				h(
					'h1',
					{ style: styles.title },
					addingLocale
						? tr('templates.create.titleLocale', { type: props.type as string })
						: tr('templates.create.titleNew'),
				),
				h(
					'p',
					{ style: { ...styles.meta, lineHeight: 1.5 } },
					addingLocale ? tr('templates.create.hintLocale') : tr('templates.create.hintNew'),
				),
				h('div', { style: styles.split }, [
					h('form', { style: styles.form, onSubmit: (ev: Event) => void submit(ev) }, [
						...(addingLocale
							? []
							: field('new-template-type', tr('templates.create.type'), newType, {
									placeholder: 'weekly-digest',
								})),
						...field(
							'new-template-locale',
							addingLocale ? tr('templates.create.locale') : tr('templates.create.localeOptional'),
							targetLocale,
							{ placeholder: 'fr', list: 'new-template-locales' },
						),
						h(
							'datalist',
							{ id: 'new-template-locales' },
							[...new Set(props.locales)].map((l) => h('option', { key: l, value: l })),
						),
						...field('new-template-subject', tr('templates.subject'), subject),
						...field('new-template-html', tr('templates.htmlBody'), html, {
							textarea: true,
							minHeight: '160px',
						}),
						...field('new-template-text', tr('templates.textBody'), text, {
							textarea: true,
							minHeight: '100px',
						}),
						untranslated.value.length > 0
							? h(
									'p',
									{ style: notice },
									tr('templates.create.untranslated', { fields: untranslated.value.join(', ') }),
								)
							: null,
						error.value ? h('p', { style: styles.error, role: 'alert' }, error.value) : null,
						h(
							'button',
							{
								type: 'submit',
								disabled: busy.value,
								style: { ...styles.button, marginTop: '16px' },
							},
							busy.value
								? tr('templates.create.creating')
								: addingLocale
									? tr('templates.create.submitLocale')
									: tr('templates.create.submitNew'),
						),
					]),
					h('div', { style: styles.previewColumn }, [
						h('div', { style: styles.previewHeader }, [
							h('span', { style: styles.label }, tr('templates.editor.preview')),
							h(
								'span',
								{ style: styles.meta },
								isPreviewing.value ? tr('templates.editor.rendering') : tr('templates.editor.live'),
							),
						]),
						previewError.value
							? h('p', { style: styles.error, role: 'alert' }, previewError.value.explanation)
							: null,
						preview.value?.subject
							? h('p', { style: styles.previewSubject }, preview.value.subject)
							: null,
						preview.value?.html
							? // sandbox= — no scripts, no same-origin: operator-authored HTML must
								// never execute in the console's origin.
								h('iframe', {
									title: tr('templates.editor.previewTitle'),
									style: styles.previewFrame,
									sandbox: '',
									srcdoc: preview.value.html,
								})
							: preview.value
								? h('pre', { style: styles.previewText }, preview.value.text)
								: h('p', { style: styles.meta }, tr('templates.editor.nothingRendered')),
					]),
				]),
			]);
	},
});
