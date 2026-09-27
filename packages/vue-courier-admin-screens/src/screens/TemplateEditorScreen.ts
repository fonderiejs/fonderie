import type {
	AdminLocale,
	AdminMessageKey,
	AdminMessageParams,
	CourierAdminClient,
	FonderieApiError,
	ISetTemplateInput,
	ITemplateEntry,
	ITemplateRevision,
} from '@fonderie/client';
import {
	createAdminT,
	formatAdminDate,
	groupTemplatesByType,
	missingTemplateLocales,
} from '@fonderie/client';
import {
	useTemplate,
	useTemplatePreview,
	useTemplateRevisions,
	useTemplates,
} from '@fonderie/vue-courier-admin';
import type { CSSProperties, PropType } from 'vue';
import { computed, defineComponent, h, ref, watch } from 'vue';

const PREVIEW_DEBOUNCE_MS = 500;
import { styles } from '../styles';

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
const tabInactive: CSSProperties = { ...tab, opacity: 0.55, textDecoration: 'line-through' };
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
		'add-locale': (_type: string, _context: { locales: string[] }) => true,
		/** Open another locale of this email. */
		'select-locale': (_template: ITemplateEntry) => true,
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
		const { templates, saveTemplate, removeTemplate } = useTemplates(props.client);
		// This email's locales, for the tabs. The list is already fetched for saves.
		const siblings = computed(
			() => groupTemplatesByType(templates.value).find((g) => g.type === props.type)?.entries ?? [],
		);
		const isDeleting = ref(false);
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

		// Leaving a locale with unsaved edits asks first: they would be lost.
		const leave = () => !dirty.value || window.confirm(t('templates.editor.discardChanges'));

		function renderTabBar() {
			if (!props.localeTabs && !props.allowAddLocale) return null;
			return h('div', { style: tabBar }, [
				props.localeTabs
					? // Each tab opens another stored row, so this is navigation, not an
						// ARIA tablist: plain buttons, the open one marked aria-current.
						h(
							'nav',
							{ 'aria-label': t('templates.editor.locales'), style: tabs },
							siblings.value.map((entry) => {
								const selected = entry.locale === (props.locale ?? null);
								return h(
									'button',
									{
										key: entry.locale ?? '',
										type: 'button',
										'aria-current': selected ? 'true' : undefined,
										style: selected ? tabSelected : entry.active ? tab : tabInactive,
										title: entry.active ? undefined : t('common.status.inactive'),
										onClick: () => {
											if (!selected && leave()) emit('select-locale', entry);
										},
									},
									entry.locale ?? t('templates.defaultChip'),
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
											locales: missingTemplateLocales(templates.value, props.type),
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
			if (isLoading.value) return h('p', { style: styles.status }, t('templates.editor.loading'));
			if (error.value)
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, props.type),
				renderTabBar(),
				h('p', { style: styles.meta }, [
					h('strong', props.locale ?? t('templates.defaultLocale')),
					` · v${template.value?.version ?? 1}`,
					props.system ? ` · ${t('templates.editor.builtInNote')}` : '',
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
								!props.system
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
