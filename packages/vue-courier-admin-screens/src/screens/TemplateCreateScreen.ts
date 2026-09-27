import type { CourierAdminClient, ISetTemplateInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
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
	},
	emits: {
		/** What was created, so the caller can open it in the editor. */
		created: (_created: { type: string; locale: string | null }) => true,
	},
	setup(props, { emit }) {
		const addingLocale = props.type !== undefined;
		const newType = ref('');
		const locale = ref('');
		const subject = ref('');
		const html = ref('');
		const text = ref('');
		const error = ref<string | null>(null);
		const busy = ref(false);

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
			const l = locale.value.trim() || null;
			if (!TYPE_RE.test(t)) {
				error.value = 'Type: lowercase letters, digits, - and _ (e.g. weekly-digest).';
				return;
			}
			if (addingLocale && !l) {
				error.value = 'Choose the locale to add, e.g. fr or fr-CA.';
				return;
			}
			if (l && !LOCALE_RE.test(l)) {
				error.value = 'Locale: a language tag such as fr, es or fr-CA.';
				return;
			}
			if (!text.value.trim()) {
				error.value = 'The plain-text body is required — it is what every email client can show.';
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
					error.value = `"${t}"${l ? ` (${l})` : ''} already exists — open it from the list to edit.`;
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
					addingLocale ? `Add a locale to ${props.type}` : 'New template',
				),
				h(
					'p',
					{ style: { ...styles.meta, lineHeight: 1.5 } },
					addingLocale
						? 'Starts from the default copy. People whose locale matches receive this version; everyone else keeps the default.'
						: 'For an email your app sends that has no stored copy yet. The type must match what the app sends.',
				),
				h('form', { style: styles.form, onSubmit: (ev: Event) => void submit(ev) }, [
					...(addingLocale
						? []
						: field('new-template-type', 'Type', newType, { placeholder: 'weekly-digest' })),
					...field(
						'new-template-locale',
						addingLocale ? 'Locale' : 'Locale (optional — empty is the default)',
						locale,
						{ placeholder: 'fr', list: 'new-template-locales' },
					),
					h(
						'datalist',
						{ id: 'new-template-locales' },
						[...new Set(props.locales)].map((l) => h('option', { key: l, value: l })),
					),
					...field('new-template-subject', 'Subject', subject),
					...field('new-template-html', 'HTML body', html, { textarea: true, minHeight: '160px' }),
					...field('new-template-text', 'Plain-text body', text, {
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
						busy.value ? 'Creating…' : addingLocale ? 'Add locale' : 'Create template',
					),
				]),
			]);
	},
});
