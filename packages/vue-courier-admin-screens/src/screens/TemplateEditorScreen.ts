import type {
	AdminLocale,
	AdminMessageKey,
	AdminMessageParams,
	CourierAdminClient,
	FonderieApiError,
	ISetTemplateInput,
	ITemplateRevision,
} from '@fonderie/client';
import {
	createAdminT,
	formatAdminDate,
	suggestTemplateLocales,
	templateLanguages,
} from '@fonderie/client';
import {
	useBuiltInTemplate,
	useTemplate,
	useTemplateCatalog,
	useTemplateResolution,
	useTemplatePreview,
	useTemplateRevisions,
	useTemplates,
} from '@fonderie/vue-courier-admin';
import type { CSSProperties, PropType } from 'vue';
import { computed, defineComponent, h, ref, watch } from 'vue';

const PREVIEW_DEBOUNCE_MS = 500;
import { styles } from '../styles';
import type { ITemplateSelection } from './TemplateListScreen';

// Implicit variables the layout injects — an operator never supplies these, so
// offering them as fields would just be noise.
const IMPLICIT = new Set(['subject', 'preheader', 'brandName']);

// One tab per locale of this email, underlined like a document's tabs.
const tab: CSSProperties = {
	height: '32px',
	padding: '0 10px',
	background: 'none',
	border: 'none',
	borderBottom: '2px solid transparent',
	color: 'var(--fonderie-text-muted,#5c5c5c)',
	fontSize: '13px',
	fontFamily:
		'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	cursor: 'pointer',
};
const tabSelected: CSSProperties = {
	...tab,
	color: 'var(--fonderie-text,#171717)',
	fontWeight: 600,
	borderBottomColor: 'var(--fonderie-text,#171717)',
	cursor: 'default',
};
const tabInactive: CSSProperties = { opacity: 0.55, textDecoration: 'line-through' };
// Fonderie's built-in copy, not saved by the app — the list's dashed chip.
const tabBuiltIn: CSSProperties = { fontStyle: 'italic' };
const tabBar: CSSProperties = {
	display: 'flex',
	alignItems: 'flex-end',
	gap: '12px',
	borderBottom: '1px solid var(--fonderie-border,#e0e0e0)',
	margin: '4px 0 12px',
	paddingBottom: '6px',
};
const tabs: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '-7px' };

export const TemplateEditorScreen = defineComponent({
	name: 'FonderieTemplateEditorScreen',
	props: {
		client: { type: Object as PropType<CourierAdminClient>, required: true },
		type: { type: String, required: true },
		locale: { type: String as PropType<string | null>, default: null },
		/**
		 * A built-in email's default-locale row (the list's `system` flag): it can
		 * be edited and rolled back, never deleted — Delete is not offered.
		 */
		system: { type: Boolean, default: false },
		/** Shows "+ Add locale" (emits add-locale). */
		allowAddLocale: { type: Boolean, default: false },
		/**
		 * Shows a tab per locale this email exists in (emits select-locale).
		 * Unsaved edits are confirmed before switching away.
		 */
		localeTabs: { type: Boolean, default: false },
		/** The console language (`locale` is the template's); defaults to English. */
		uiLocale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	emits: {
		saved: () => true,
		/** The template was deleted and no longer exists. */
		deleted: () => true,
		/**
		 * Create a translation of this template. `locales` are the ones the app
		 * uses elsewhere that this email lacks — suggest them first.
		 */
		'add-locale': (_type: string, _context: { locales: string[]; defaultLocale?: string }) => true,
		/** Open another locale of this email. */
		'select-locale': (_template: ITemplateSelection) => true,
	},
	setup(props, { emit }) {
		const t = (key: AdminMessageKey, params?: AdminMessageParams) =>
			createAdminT(props.uiLocale)(key, params);
		const { template, isLoading, error, refresh } = useTemplate(
			props.client,
			props.type,
			props.locale,
		);
		// Saves go through the list composable (which re-fetches the template list
		// after each write); mounting it adds a template-list fetch to this
		// single-template editor — acceptable for an admin dashboard. Its
		// isLoading/error track that list fetch, so the save action keeps local state.
		const { saveTemplate, removeTemplate } = useTemplates(props.client);
		// No saved version in this language is not an error: it may be Fonderie's
		// built-in copy, which opens prefilled and saves as the app's own version.
		const notSaved = computed(() => error.value?.status === 404);
		const { builtIn, isLoading: builtInLoading } = useBuiltInTemplate(
			props.client,
			props.type,
			props.locale,
		);
		const { catalog, refresh: refreshCatalog } = useTemplateCatalog(props.client);
		const defaultLocale = computed(() => catalog.value?.defaultLocale ?? 'en-US');
		const email = computed(() => catalog.value?.emails.find((e) => e.type === props.type));
		const languages = computed(() =>
			email.value ? templateLanguages(email.value, defaultLocale.value) : [],
		);
		// What the fields start from, and what "dirty" is measured against.
		const source = computed(() => template.value ?? (notSaved.value ? builtIn.value : null));
		// Only the default version of a built-in email is protected; its language
		// versions are the app's to delete (the built-in copy then sends again).
		const protectedRow = computed(() => !props.locale && (email.value?.system ?? props.system));
		const shipsHere = computed(() =>
			props.locale
				? languages.value.some((l) => l.locale === props.locale && l.builtIn)
				: !!email.value?.builtIn.default,
		);
		const { resolution, resolve } = useTemplateResolution(props.client);
		const probe = ref('');
		// The chain this language falls back along, from the server's own decision.
		watch(defaultLocale, (dl) => void resolve(props.type, props.locale ?? dl), { immediate: true });
		const isDeleting = ref(false);
		const { revisions, rollback } = useTemplateRevisions(props.client, props.type, props.locale);
		const isSaving = ref(false);
		const saveError = ref<FonderieApiError | null>(null);

		const subject = ref('');
		const html = ref('');
		const text = ref('');
		const active = ref(true);

		watch(source, (src) => {
			if (!src) return;
			subject.value = src.subject ?? '';
			html.value = src.html ?? '';
			text.value = src.text;
			active.value = template.value ? template.value.active : true;
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
		const sampleError = ref<AdminMessageKey | null>(null);

		async function run() {
			let data: Record<string, unknown> = {};
			try {
				const parsed: unknown = JSON.parse(sampleJson.value || '{}');
				if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
					sampleError.value = 'templates.editor.sampleNotObject';
					return;
				}
				data = parsed as Record<string, unknown>;
				sampleError.value = null;
			} catch {
				sampleError.value = 'templates.editor.sampleInvalid';
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
			if (!source.value) return;
			clearTimeout(previewTimer);
			previewTimer = setTimeout(() => void run(), PREVIEW_DEBOUNCE_MS);
		});

		// Saving what is already stored would only mint an identical version (the
		// server treats it as a no-op anyway), so Save waits for a real change.
		// A built-in copy nobody saved is always saveable: saving is what makes it
		// the app's own version.
		const dirty = computed(() => {
			const tpl = template.value;
			return (
				(notSaved.value && !!builtIn.value) ||
				(!!tpl &&
					(subject.value !== (tpl.subject ?? '') ||
						html.value !== (tpl.html ?? '') ||
						text.value !== tpl.text ||
						active.value !== tpl.active))
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
				// single template and the tabs, so re-read both.
				await Promise.all([refresh(), refreshCatalog()]);
				emit('saved');
			} catch (err) {
				// useTemplates normalizes every failure to FonderieApiError before throwing.
				saveError.value = err as FonderieApiError;
			} finally {
				isSaving.value = false;
			}
		}

		// Leaving a locale with unsaved edits asks first: they would be lost.
		const leave = () =>
			!dirty.value ||
			(notSaved.value && !!builtIn.value) ||
			window.confirm(t('templates.editor.discardChanges'));

		// Back to what Fonderie ships. A language version is deleted, so the
		// built-in copy sends again and later Fonderie updates reach it; the default
		// version of a built-in email cannot be deleted, so it is saved over with the
		// built-in copy as a new version — its history keeps the old one.
		async function handleReset() {
			const copy = builtIn.value;
			if (
				!copy ||
				!window.confirm(
					t('templates.editor.confirmReset', { locale: props.locale ?? defaultLocale.value }),
				)
			)
				return;
			isDeleting.value = true;
			saveError.value = null;
			try {
				if (props.locale) {
					await removeTemplate(props.type, props.locale);
				} else {
					const input: ISetTemplateInput = { text: copy.text, active: active.value };
					if (copy.subject) input.subject = copy.subject;
					if (copy.html) input.html = copy.html;
					if (template.value?.version !== undefined) input.ifVersion = template.value.version;
					await saveTemplate(props.type, input, null);
				}
				await Promise.all([refresh(), refreshCatalog()]);
			} catch (err) {
				saveError.value = err as FonderieApiError;
			} finally {
				isDeleting.value = false;
			}
		}

		function renderTabBar() {
			if (!props.localeTabs && !props.allowAddLocale) return null;
			return h('div', { style: tabBar }, [
				props.localeTabs
					? // Each tab opens another stored row, so this is navigation, not an
						// ARIA tablist: plain buttons, the open one marked aria-current.
						h(
							'nav',
							{ 'aria-label': t('templates.editor.locales'), style: tabs },
							languages.value.map((l) => {
								const selected = l.locale === (props.locale ?? null);
								return h(
									'button',
									{
										key: l.label,
										type: 'button',
										'aria-current': selected ? 'true' : undefined,
										style: {
											...(selected ? tabSelected : tab),
											...(l.saved ? {} : tabBuiltIn),
											...(l.active ? {} : tabInactive),
										},
										title: l.active ? undefined : t('common.status.inactive'),
										onClick: () => {
											if (!selected && leave())
												emit('select-locale', {
													type: props.type,
													locale: l.locale,
													system: !!email.value?.system,
												});
										},
									},
									l.label,
								);
							}),
						)
					: null,
				props.allowAddLocale
					? h(
							'button',
							{
								type: 'button',
								style: { ...styles.rollbackButton, marginLeft: 'auto' },
								onClick: () => {
									if (leave())
										emit('add-locale', props.type, {
											locales: catalog.value
												? suggestTemplateLocales(catalog.value, props.type)
												: [],
											defaultLocale: defaultLocale.value,
										});
								},
							},
							t('templates.editor.addLocale'),
						)
					: null,
			]);
		}

		async function handleDelete() {
			const message = props.locale
				? t('templates.editor.confirmDeleteLocale', { locale: props.locale, type: props.type })
				: t('templates.editor.confirmDelete', { type: props.type });
			if (!window.confirm(message)) return;
			isDeleting.value = true;
			saveError.value = null;
			try {
				await removeTemplate(props.type, props.locale);
				emit('deleted');
			} catch (err) {
				saveError.value = err as FonderieApiError;
			} finally {
				isDeleting.value = false;
			}
		}

		function renderRevision(rev: ITemplateRevision) {
			return h('li', { key: rev.version, style: styles.revisionRow }, [
				h(
					'span',
					`v${rev.version} — ${rev.actor ?? t('templates.editor.unknownActor')} — ${formatAdminDate(rev.createdAt, props.uiLocale)}`,
				),
				h(
					'button',
					{ type: 'button', style: styles.rollbackButton, onClick: () => rollback(rev.version) },
					t('templates.editor.rollBack'),
				),
			]);
		}

		return () => {
			if (isLoading.value || (notSaved.value && builtInLoading.value))
				return h('p', { style: styles.status }, t('templates.editor.loading'));
			if (error.value && !(notSaved.value && builtIn.value))
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, props.type),
				renderTabBar(),
				h('p', { style: styles.meta }, [
					h('strong', props.locale ?? defaultLocale.value),
					template.value ? ` · v${template.value.version}` : '',
					template.value && protectedRow.value ? ` · ${t('templates.editor.builtInNote')}` : '',
					!template.value && builtIn.value ? ` · ${t('templates.editor.builtInCopy')}` : '',
					resolution.value &&
					resolution.value.chain.length > 1 &&
					resolution.value.requested === (props.locale ?? defaultLocale.value)
						? ` · ${t('templates.editor.chain', { chain: [...resolution.value.chain, defaultLocale.value].join(' → ') })}`
						: '',
				]),
				h('div', { style: styles.split }, [
					h('div', { style: styles.column }, [
						h('form', { style: styles.form, onSubmit: handleSubmit }, [
							h('label', { style: styles.label, for: 'template-subject' }, t('templates.subject')),
							h('input', {
								id: 'template-subject',
								style: styles.input,
								value: subject.value,
								onInput: (e: Event) => {
									subject.value = (e.target as HTMLInputElement).value;
								},
							}),
							h('label', { style: styles.label, for: 'template-html' }, t('templates.htmlBody')),
							h('textarea', {
								id: 'template-html',
								style: styles.textarea,
								rows: 8,
								value: html.value,
								onInput: (e: Event) => {
									html.value = (e.target as HTMLTextAreaElement).value;
								},
							}),
							h('label', { style: styles.label, for: 'template-text' }, t('templates.textBody')),
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
								t('templates.editor.active'),
							]),
							saveError.value?.reason === 'VERSION_CONFLICT'
								? h('p', { style: styles.error, role: 'alert' }, [
										`${t('templates.editor.conflict')} `,
										h(
											'button',
											{
												type: 'button',
												style: styles.rollbackButton,
												onClick: () => {
													saveError.value = null;
													void refresh();
												},
											},
											t('common.reload'),
										),
									])
								: saveError.value
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
									isSaving.value ? t('common.saving') : t('common.save'),
								),
								!dirty.value && !isSaving.value
									? h('span', { style: styles.meta }, t('templates.editor.noChanges'))
									: null,
								template.value && shipsHere.value && builtIn.value
									? h(
											'button',
											{
												type: 'button',
												disabled: isDeleting.value,
												onClick: () => void handleReset(),
												style: { ...styles.rollbackButton, height: '36px', marginLeft: 'auto' },
											},
											t('templates.editor.resetToBuiltIn'),
										)
									: template.value && !protectedRow.value
										? h(
												'button',
												{
													type: 'button',
													disabled: isDeleting.value,
													onClick: () => void handleDelete(),
													style: {
														...styles.rollbackButton,
														height: '36px',
														marginLeft: 'auto',
														color: 'var(--fonderie-danger,#e00)',
														borderColor:
															'color-mix(in srgb, var(--fonderie-danger,#e00) 40%, transparent)',
													},
												},
												isDeleting.value ? t('common.deleting') : t('common.delete'),
											)
										: null,
							]),
						]),
						h(
							'label',
							{ style: styles.label, for: 'template-sample' },
							t('templates.editor.sampleData'),
						),
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
							? h('p', { style: styles.error, role: 'alert' }, t(sampleError.value))
							: null,
					]),
					h('div', { style: styles.previewColumn }, [
						h('div', { style: styles.previewHeader }, [
							h('span', { style: styles.label }, t('templates.editor.preview')),
							h(
								'span',
								{ style: styles.meta },
								isPreviewing.value ? t('templates.editor.rendering') : t('templates.editor.live'),
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
									title: t('templates.editor.previewTitle'),
									style: styles.previewFrame,
									sandbox: '',
									srcdoc: preview.value.html,
								})
							: preview.value
								? h('pre', { style: styles.previewText }, preview.value.text)
								: h('p', { style: styles.meta }, t('templates.editor.nothingRendered')),
					]),
				]),
				// Who receives what: any locale, answered by the same decision a send makes.
				h('div', { style: styles.revisions }, [
					h('h2', { style: styles.subtitle }, t('templates.editor.whoReceives')),
					h(
						'form',
						{
							style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
							onSubmit: (event: Event) => {
								event.preventDefault();
								if (probe.value.trim()) void resolve(props.type, probe.value.trim());
							},
						},
						[
							h('input', {
								'aria-label': t('templates.editor.whoReceives'),
								style: { ...styles.input, width: '200px' },
								value: probe.value,
								placeholder: t('templates.editor.whoPlaceholder'),
								spellcheck: false,
								onInput: (e: Event) => {
									probe.value = (e.target as HTMLInputElement).value;
								},
							}),
							h(
								'button',
								{ type: 'submit', style: { ...styles.rollbackButton, height: '36px' } },
								t('templates.editor.check'),
							),
							resolution.value && probe.value.trim()
								? h('span', { style: { ...styles.meta, marginBottom: '0' }, role: 'status' }, [
										t('templates.editor.receives', {
											requested: resolution.value.requested,
											sent: resolution.value.sent,
										}),
										' ',
										resolution.value.source === 'saved'
											? t('templates.editor.sourceSaved')
											: t('templates.editor.sourceBuiltIn'),
										resolution.value.chain.length > 0
											? ` (${[...resolution.value.chain, resolution.value.defaultLocale].join(' → ')})`
											: '',
									])
								: null,
						],
					),
				]),
				revisions.value.length > 0
					? h('div', { style: styles.revisions }, [
							h('h2', { style: styles.subtitle }, t('templates.editor.history')),
							h('ul', { style: styles.list }, revisions.value.map(renderRevision)),
						])
					: null,
			]);
		};
	},
});
