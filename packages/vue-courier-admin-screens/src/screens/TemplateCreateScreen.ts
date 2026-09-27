import type {
	AdminLocale,
	AdminMessageKey,
	AdminMessageParams,
	CourierAdminClient,
	ISetTemplateInput,
} from '@fonderie/client';
import { createAdminT, FonderieApiError } from '@fonderie/client';
import type { PropType } from 'vue';
import { defineComponent, h, onMounted, ref } from 'vue';
import { styles } from '../styles';

const TYPE_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/;
const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

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
		// `tr`, not `t`: submit() uses `t` for the template type.
		const tr = (key: AdminMessageKey, params?: AdminMessageParams) =>
			createAdminT(props.locale)(key, params);

		// A new locale starts from the default copy, so translating is editing.
		onMounted(() => {
			if (!props.type) return;
			props.client
				.getTemplate(props.type, null)
				.then(({ result }) => {
					subject.value = result.subject ?? '';
					html.value = result.html ?? '';
					text.value = result.text;
				})
				.catch(() => undefined);
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
			h('div', { style: { ...styles.container, maxWidth: '760px' } }, [
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
					addingLocale
						? tr('templates.create.hintLocale')
						: tr('templates.create.hintNew'),
				),
				h('form', { style: styles.form, onSubmit: (ev: Event) => void submit(ev) }, [
					...(addingLocale
						? []
						: field('new-template-type', tr('templates.create.type'), newType, { placeholder: 'weekly-digest' })),
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
					...field('new-template-html', tr('templates.htmlBody'), html, { textarea: true, minHeight: '160px' }),
					...field('new-template-text', tr('templates.textBody'), text, {
						textarea: true,
						minHeight: '100px',
					}),
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
			]);
	},
});
