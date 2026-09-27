import {
	type AdminLocale,
	type CourierAdminClient,
	type FonderieApiError,
	type ISetTemplateInput,
	createAdminT,
	formatAdminDate,
	suggestTemplateLocales,
	templateLanguages,
} from '@fonderie/client';
import {
	useBuiltInTemplate,
	useTemplate,
	useTemplateCatalog,
	useTemplatePreview,
	useTemplateResolution,
	useTemplateRevisions,
	useTemplates,
} from '@fonderie/react-courier-admin';
import type { CSSProperties, FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ITemplateSelection } from './TemplateListScreen';

// Implicit variables the layout injects — an operator never supplies these, so
// offering them as fields would just be noise.
const IMPLICIT = new Set(['subject', 'preheader', 'brandName']);

const PREVIEW_DEBOUNCE_MS = 500;

export interface ITemplateEditorScreenProps {
	client: CourierAdminClient;
	type: string;
	locale?: string | null;
	onSaved?: () => void;
	/**
	 * A built-in email's default-locale row (the list's `system` flag): it can
	 * be edited and rolled back, never deleted — Delete is not offered.
	 */
	system?: boolean;
	/** Called after a delete; the template no longer exists. */
	onDeleted?: () => void;
	/**
	 * Shows "Add locale": create a translation of this template. `locales` are
	 * the ones the app uses elsewhere that this email lacks — suggest them first.
	 */
	onAddLocale?: (type: string, context: { locales: string[]; defaultLocale?: string }) => void;
	/**
	 * Shows a tab per locale this email exists in; receives the row to open.
	 * Unsaved edits are confirmed before switching away.
	 */
	onSelectLocale?: (template: ITemplateSelection) => void;
	/**
	 * The CONSOLE's language (default English). Named `uiLocale` because
	 * `locale` here is the template's own locale.
	 */
	uiLocale?: AdminLocale | undefined;
}

export function TemplateEditorScreen({
	client,
	type,
	locale,
	onSaved,
	system = false,
	onDeleted,
	onAddLocale,
	onSelectLocale,
	uiLocale,
}: ITemplateEditorScreenProps) {
	// Memoized: `run` below depends on it, and a new translator per render would
	// restart the preview debounce on every render.
	const t = useMemo(() => createAdminT(uiLocale), [uiLocale]);
	const { template, isLoading, error, refresh } = useTemplate(client, type, locale);
	// No saved version in this language is not an error: it may be Fonderie's
	// built-in copy, which opens prefilled and saves as the app's own version.
	const notSaved = error?.status === 404;
	const { builtIn, isLoading: builtInLoading } = useBuiltInTemplate(client, type, locale);
	const { catalog, refresh: refreshCatalog } = useTemplateCatalog(client);
	const defaultLocale = catalog?.defaultLocale ?? 'en-US';
	const email = catalog?.emails.find((e) => e.type === type);
	const languages = email ? templateLanguages(email, defaultLocale) : [];
	// What the fields start from, and what "dirty" is measured against.
	const source = template ?? (notSaved ? builtIn : null);
	const { resolution, resolve } = useTemplateResolution(client);
	const [probe, setProbe] = useState('');
	// Saves go through the list hook (which re-fetches the template list after
	// each write); mounting it adds a template-list fetch to this single-template
	// editor — acceptable for an admin dashboard. Its isLoading/error track that
	// list fetch, so the save action keeps local state.
	const { saveTemplate, removeTemplate } = useTemplates(client);
	const [isDeleting, setIsDeleting] = useState(false);
	const { revisions, rollback } = useTemplateRevisions(client, type, locale);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<FonderieApiError | null>(null);

	const [subject, setSubject] = useState('');
	const [html, setHtml] = useState('');
	const [text, setText] = useState('');
	const [active, setActive] = useState(true);

	const { preview, isPreviewing, error: previewError, renderPreview } = useTemplatePreview(client);
	// The sample values, as JSON the operator can edit. Text rather than an
	// object so a half-typed value does not have to parse on every keystroke.
	const [sampleJson, setSampleJson] = useState('{}');
	const [sampleError, setSampleError] = useState<string | null>(null);

	useEffect(() => {
		if (!source) return;
		setSubject(source.subject ?? '');
		setHtml(source.html ?? '');
		setText(source.text);
		setActive(template ? template.active : true);
	}, [source, template]);

	// The chain this language falls back along, from the server's own decision.
	useEffect(() => {
		void resolve(type, locale ?? defaultLocale);
	}, [resolve, type, locale, defaultLocale]);

	const run = useCallback(async () => {
		let data: Record<string, unknown> = {};
		try {
			const parsed: unknown = JSON.parse(sampleJson || '{}');
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				setSampleError(t('templates.editor.sampleNotObject'));
				return;
			}
			data = parsed as Record<string, unknown>;
			setSampleError(null);
		} catch {
			setSampleError(t('templates.editor.sampleInvalid'));
			return;
		}
		const result = await renderPreview(
			type,
			{ text, data, ...(subject ? { subject } : {}), ...(html ? { html } : {}) },
			locale,
		);
		// The server reports which variables this content uses; seed the ones
		// that have no value yet with their own name, so the render shows where
		// each lands. Never overwrite something already typed.
		const missing = result.variables.filter((v) => !IMPLICIT.has(v) && !(v in data));
		if (missing.length > 0) {
			const seeded = { ...data, ...Object.fromEntries(missing.map((v) => [v, v])) };
			setSampleJson(JSON.stringify(seeded, null, 2));
		}
	}, [renderPreview, type, text, subject, html, locale, sampleJson, t]);

	// The preview is always live: it renders once the template loads, then again
	// PREVIEW_DEBOUNCE_MS after the last edit to the content or the sample data.
	// Debounced, not per keystroke, so typing a paragraph costs one request.
	// `run` is a new function on every keystroke (it closes over the fields), so
	// the effect keys on the fields themselves and calls the latest `run`.
	const runRef = useRef(run);
	runRef.current = run;
	const loadedType = source ? `${type}:${locale ?? ''}` : null;
	// The fields ARE the trigger: each edit restarts the debounce. The effect
	// body reads the latest `run` through the ref, so it does not use them.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		if (!loadedType) return;
		const timer = setTimeout(() => void runRef.current(), PREVIEW_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [loadedType, subject, html, text, sampleJson]);

	// Saving what is already stored would only mint an identical version (the
	// server treats it as a no-op anyway), so Save waits for a real change.
	// A built-in copy nobody saved is always saveable: saving is what makes it
	// the app's own version.
	const dirty =
		(notSaved && !!builtIn) ||
		(!!template &&
			(subject !== (template.subject ?? '') ||
				html !== (template.html ?? '') ||
				text !== template.text ||
				active !== template.active));
	// Only the default version of a built-in email is protected; its language
	// versions are the app's to delete (the built-in copy then sends again).
	const protectedRow = !locale && (email?.system ?? system);
	// Fonderie ships this language (or, for the default version, the English).
	const shipsHere = locale
		? languages.some((l) => l.locale === locale && l.builtIn)
		: !!email?.builtIn.default;

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setIsSaving(true);
		setSaveError(null);
		try {
			const input: ISetTemplateInput = { text, active };
			if (subject) input.subject = subject;
			if (html) input.html = html;
			if (template?.version !== undefined) input.ifVersion = template.version;
			await saveTemplate(type, input, locale);
			// The list hook refreshes its own list; this screen renders the single
			// template and the tabs, so re-read both.
			await Promise.all([refresh(), refreshCatalog()]);
			onSaved?.();
		} catch (err) {
			// useTemplates normalizes every failure to FonderieApiError before throwing.
			setSaveError(err as FonderieApiError);
		} finally {
			setIsSaving(false);
		}
	};

	const switchTo = (next: ITemplateSelection) => {
		if (dirty && !(notSaved && !!builtIn) && !window.confirm(t('templates.editor.discardChanges')))
			return;
		onSelectLocale?.(next);
	};

	// Back to what Fonderie ships. A language version is deleted, so the built-in
	// copy sends again and later Fonderie updates reach it; the default version
	// of a built-in email cannot be deleted, so it is saved over with the
	// built-in copy as a new version — its history keeps the old one.
	const handleReset = async () => {
		if (
			!builtIn ||
			!window.confirm(t('templates.editor.confirmReset', { locale: locale ?? defaultLocale }))
		)
			return;
		setIsDeleting(true);
		setSaveError(null);
		try {
			if (locale) {
				await removeTemplate(type, locale);
			} else {
				const input: ISetTemplateInput = { text: builtIn.text, active };
				if (builtIn.subject) input.subject = builtIn.subject;
				if (builtIn.html) input.html = builtIn.html;
				if (template?.version !== undefined) input.ifVersion = template.version;
				await saveTemplate(type, input, null);
			}
			await Promise.all([refresh(), refreshCatalog()]);
		} catch (err) {
			setSaveError(err as FonderieApiError);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDelete = async () => {
		const message = locale
			? t('templates.editor.confirmDeleteLocale', { type, locale })
			: t('templates.editor.confirmDelete', { type });
		if (!window.confirm(message)) return;
		setIsDeleting(true);
		setSaveError(null);
		try {
			await removeTemplate(type, locale);
			onDeleted?.();
		} catch (err) {
			setSaveError(err as FonderieApiError);
		} finally {
			setIsDeleting(false);
		}
	};

	if (isLoading || (notSaved && builtInLoading))
		return <p style={styles.status}>{t('templates.editor.loading')}</p>;
	if (error && !(notSaved && builtIn))
		return (
			<p style={styles.error} role="alert">
				{error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>{type}</h1>
			{onSelectLocale || onAddLocale ? (
				<div style={styles.tabBar}>
					{onSelectLocale ? (
						// Each tab opens another stored row, so this is navigation, not an
						// ARIA tablist: plain buttons, the open one marked aria-current.
						<nav aria-label={t('templates.editor.locales')} style={styles.tabs}>
							{languages.map((l) => {
								const selected = l.locale === (locale ?? null);
								return (
									<button
										key={l.label}
										type="button"
										aria-current={selected ? 'true' : undefined}
										onClick={() =>
											selected
												? undefined
												: switchTo({ type, locale: l.locale, system: !!email?.system })
										}
										style={{
											...(selected ? styles.tabSelected : styles.tab),
											...(l.saved ? {} : styles.tabBuiltIn),
											...(l.active ? {} : styles.tabInactive),
										}}
										title={l.active ? undefined : t('common.status.inactive')}
									>
										{l.label}
									</button>
								);
							})}
						</nav>
					) : null}
					{onAddLocale ? (
						<button
							type="button"
							style={{ ...styles.rollbackButton, marginLeft: 'auto' }}
							onClick={() => {
								if (dirty && !window.confirm(t('templates.editor.discardChanges'))) return;
								onAddLocale(type, {
									locales: catalog ? suggestTemplateLocales(catalog, type) : [],
									defaultLocale,
								});
							}}
						>
							{t('templates.editor.addLocale')}
						</button>
					) : null}
				</div>
			) : null}
			<p style={styles.meta}>
				<strong>{locale ?? defaultLocale}</strong>
				{template ? ` · v${template.version}` : ''}
				{template && protectedRow ? ` · ${t('templates.editor.builtInNote')}` : ''}
				{!template && builtIn ? ` · ${t('templates.editor.builtInCopy')}` : ''}
				{resolution &&
				resolution.chain.length > 1 &&
				resolution.requested === (locale ?? defaultLocale)
					? ` · ${t('templates.editor.chain', { chain: [...resolution.chain, defaultLocale].join(' → ') })}`
					: ''}
			</p>

			<div style={styles.split}>
				<div style={styles.column}>
					<form style={styles.form} onSubmit={handleSubmit}>
						<label style={styles.label} htmlFor="template-subject">
							{t('templates.subject')}
						</label>
						<input
							id="template-subject"
							style={styles.input}
							value={subject}
							onChange={(event) => setSubject(event.target.value)}
						/>

						<label style={styles.label} htmlFor="template-html">
							{t('templates.htmlBody')}
						</label>
						<textarea
							id="template-html"
							style={styles.textarea}
							value={html}
							onChange={(event) => setHtml(event.target.value)}
							rows={8}
						/>

						<label style={styles.label} htmlFor="template-text">
							{t('templates.textBody')}
						</label>
						<textarea
							id="template-text"
							style={styles.textarea}
							value={text}
							onChange={(event) => setText(event.target.value)}
							rows={4}
							required
						/>

						<label style={styles.checkboxLabel}>
							<input
								type="checkbox"
								checked={active}
								onChange={(event) => setActive(event.target.checked)}
							/>
							{t('templates.editor.active')}
						</label>

						{saveError?.reason === 'VERSION_CONFLICT' ? (
							<p style={styles.error} role="alert">
								{t('templates.editor.conflict')}{' '}
								<button
									type="button"
									style={styles.rollbackButton}
									onClick={() => {
										setSaveError(null);
										void refresh();
									}}
								>
									{t('common.reload')}
								</button>
							</p>
						) : saveError ? (
							<p style={styles.error} role="alert">
								{saveError.explanation}
							</p>
						) : null}

						<div style={styles.saveRow}>
							<button
								type="submit"
								disabled={isSaving || !dirty}
								style={dirty ? styles.button : styles.buttonDisabled}
							>
								{isSaving ? t('common.saving') : t('common.save')}
							</button>
							{!dirty && !isSaving && (
								<span style={styles.meta}>{t('templates.editor.noChanges')}</span>
							)}
							{template && shipsHere && builtIn ? (
								<button
									type="button"
									disabled={isDeleting}
									onClick={() => void handleReset()}
									style={{ ...styles.rollbackButton, height: 36, marginLeft: 'auto' }}
								>
									{t('templates.editor.resetToBuiltIn')}
								</button>
							) : template && !protectedRow ? (
								<button
									type="button"
									disabled={isDeleting}
									onClick={() => void handleDelete()}
									style={{
										...styles.rollbackButton,
										height: 36,
										marginLeft: 'auto',
										color: 'var(--fonderie-danger,#e00)',
										borderColor: 'color-mix(in srgb, var(--fonderie-danger,#e00) 40%, transparent)',
									}}
								>
									{isDeleting ? t('common.deleting') : t('common.delete')}
								</button>
							) : null}
						</div>
					</form>

					<label style={styles.label} htmlFor="template-sample">
						{t('templates.editor.sampleData')}
					</label>
					<textarea
						id="template-sample"
						style={styles.textarea}
						value={sampleJson}
						onChange={(event) => setSampleJson(event.target.value)}
						rows={6}
						spellCheck={false}
					/>
					{sampleError && (
						<p style={styles.error} role="alert">
							{sampleError}
						</p>
					)}
				</div>

				<div style={styles.previewColumn}>
					<div style={styles.previewHeader}>
						<span style={styles.label}>{t('templates.editor.preview')}</span>
						<span style={styles.meta}>
							{isPreviewing ? t('templates.editor.rendering') : t('templates.editor.live')}
						</span>
					</div>
					{previewError && (
						<p style={styles.error} role="alert">
							{previewError.explanation}
						</p>
					)}
					{preview?.subject && <p style={styles.previewSubject}>{preview.subject}</p>}
					{preview?.html ? (
						// sandbox="" — no scripts, no same-origin. This is operator-authored
						// HTML and it must never execute in the dashboard's origin, which is
						// where the admin token lives.
						<iframe
							title={t('templates.editor.previewTitle')}
							style={styles.previewFrame}
							sandbox=""
							srcDoc={preview.html}
						/>
					) : preview ? (
						<pre style={styles.previewText}>{preview.text}</pre>
					) : (
						<p style={styles.meta}>{t('templates.editor.nothingRendered')}</p>
					)}
				</div>
			</div>

			{/* Who receives what: any locale, answered by the same decision a send makes. */}
			<div style={styles.revisions}>
				<h2 style={styles.subtitle}>{t('templates.editor.whoReceives')}</h2>
				<form
					style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
					onSubmit={(event) => {
						event.preventDefault();
						if (probe.trim()) void resolve(type, probe.trim());
					}}
				>
					<input
						aria-label={t('templates.editor.whoReceives')}
						style={{ ...styles.input, width: 200 }}
						value={probe}
						placeholder={t('templates.editor.whoPlaceholder')}
						spellCheck={false}
						onChange={(event) => setProbe(event.target.value)}
					/>
					<button type="submit" style={{ ...styles.rollbackButton, height: 36 }}>
						{t('templates.editor.check')}
					</button>
					{resolution && probe.trim() ? (
						<span style={{ ...styles.meta, marginBottom: 0 }} role="status">
							{t('templates.editor.receives', {
								requested: resolution.requested,
								sent: resolution.sent,
							})}{' '}
							{resolution.source === 'saved'
								? t('templates.editor.sourceSaved')
								: t('templates.editor.sourceBuiltIn')}{' '}
							{resolution.chain.length > 0
								? `(${[...resolution.chain, resolution.defaultLocale].join(' → ')})`
								: ''}
						</span>
					) : null}
				</form>
			</div>

			{revisions.length > 0 && (
				<div style={styles.revisions}>
					<h2 style={styles.subtitle}>{t('templates.editor.history')}</h2>
					<ul style={styles.list}>
						{revisions.map((rev) => (
							<li key={rev.version} style={styles.row}>
								<span>
									v{rev.version} — {rev.actor ?? t('templates.editor.unknownActor')} —{' '}
									{formatAdminDate(rev.createdAt, uiLocale)}
								</span>
								<button
									type="button"
									onClick={() => rollback(rev.version)}
									style={styles.rollbackButton}
								>
									{t('templates.editor.rollBack')}
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

const tab: CSSProperties = {
	height: 32,
	padding: '0 10px',
	background: 'none',
	border: 'none',
	borderBottom: '2px solid transparent',
	color: 'var(--fonderie-text-muted,#5c5c5c)',
	fontSize: 13,
	fontFamily:
		'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	cursor: 'pointer',
};

const styles: Record<string, CSSProperties> = {
	container: { padding: '8px 40px 64px', maxWidth: 1400, boxSizing: 'border-box' },
	// One tab per locale of this email, underlined like a document's tabs.
	tabBar: {
		display: 'flex',
		alignItems: 'flex-end',
		gap: 12,
		borderBottom: '1px solid var(--fonderie-border,#e0e0e0)',
		margin: '4px 0 12px',
		paddingBottom: 6,
	},
	tabs: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: -7 },
	tab,
	tabSelected: {
		...tab,
		color: 'var(--fonderie-text,#171717)',
		fontWeight: 600,
		borderBottomColor: 'var(--fonderie-text,#171717)',
		cursor: 'default',
	},
	tabInactive: { opacity: 0.55, textDecoration: 'line-through' },
	// Fonderie's built-in copy, not saved by the app — the list's dashed chip.
	tabBuiltIn: { fontStyle: 'italic' },
	// Two columns, always: the editor on the left, the rendered result on the
	// right. Stacking the preview under a long form hid it below the fold.
	split: {
		display: 'grid',
		gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
		gap: 24,
		alignItems: 'start',
	},
	column: { minWidth: 0, display: 'flex', flexDirection: 'column' },
	// Pinned while the form scrolls, so the preview stays in view as you edit.
	previewColumn: {
		minWidth: 0,
		display: 'flex',
		flexDirection: 'column',
		position: 'sticky',
		top: 16,
	},
	saveRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 },
	previewHeader: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 12,
	},
	previewSubject: { fontSize: 14, fontWeight: 600, margin: '8px 0' },
	previewFrame: {
		boxShadow: 'var(--fonderie-shadow-card,0 2px 3px 0 rgba(0,0,0,.05))',
		width: '100%',
		height: 520,
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 8,
		background: 'var(--fonderie-surface,#fff)',
	},
	previewText: {
		whiteSpace: 'pre-wrap',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 8,
		padding: 12,
		fontSize: 13,
		fontFamily:
			'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	},
	title: {
		fontSize: 22,
		fontWeight: 600,
		margin: '8px 0 4px',
		letterSpacing: 'var(--fonderie-tracking-display,-0.05em)',
		lineHeight: 1.25,
	},
	meta: { fontSize: 13, color: 'var(--fonderie-text-muted,#5c5c5c)', marginBottom: 20 },
	status: { padding: 24, textAlign: 'center', color: 'var(--fonderie-text-muted,#5c5c5c)' },
	error: {
		color: 'var(--fonderie-danger,#e00)',
		background: 'color-mix(in srgb, var(--fonderie-danger,#e00) 8%, transparent)',
		borderRadius: 6,
		padding: '8px 12px',
		margin: '8px 0',
		fontSize: 13.5,
	},
	form: {
		display: 'flex',
		flexDirection: 'column',
		gap: 4,
		background: 'var(--fonderie-surface,#fff)',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 'var(--fonderie-radius-lg,8px)',
		padding: '6px 20px 20px',
		boxShadow: 'var(--fonderie-shadow-card,0 2px 3px 0 rgba(0,0,0,.05))',
	},
	label: { fontSize: 13, fontWeight: 500, marginTop: 14, marginBottom: 2 },
	input: {
		height: 36,
		boxSizing: 'border-box',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 6,
		padding: '0 10px',
		fontSize: 13.5,
		fontFamily: 'inherit',
		background: 'var(--fonderie-surface,#fff)',
		color: 'var(--fonderie-text,#171717)',
	},
	textarea: {
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 6,
		padding: 10,
		fontSize: 13,
		lineHeight: 1.55,
		background: 'var(--fonderie-surface,#fff)',
		color: 'var(--fonderie-text,#171717)',
		fontFamily:
			'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	},
	checkboxLabel: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14 },
	button: {
		display: 'inline-flex',
		alignItems: 'center',
		height: 36,
		boxSizing: 'border-box',
		backgroundColor: 'var(--fonderie-text,#171717)',
		color: 'var(--fonderie-surface,#fff)',
		padding: '0 16px',
		borderRadius: 6,
		border: '1px solid var(--fonderie-text,#171717)',
		fontSize: 13.5,
		fontWeight: 600,
		fontFamily: 'inherit',
		cursor: 'pointer',
		alignSelf: 'flex-start',
	},
	buttonDisabled: {
		display: 'inline-flex',
		alignItems: 'center',
		height: 36,
		boxSizing: 'border-box',
		backgroundColor: 'var(--fonderie-text,#171717)',
		color: 'var(--fonderie-surface,#fff)',
		padding: '0 16px',
		borderRadius: 6,
		border: '1px solid var(--fonderie-text,#171717)',
		fontSize: 13.5,
		fontWeight: 600,
		fontFamily: 'inherit',
		alignSelf: 'flex-start',
		opacity: 0.45,
		cursor: 'not-allowed',
	},
	revisions: { marginTop: 32 },
	subtitle: {
		fontSize: 15,
		fontWeight: 600,
		margin: '0 0 10px',
		letterSpacing: 'var(--fonderie-tracking-display,-0.05em)',
	},
	list: {
		listStyle: 'none',
		padding: 0,
		margin: 0,
		background: 'var(--fonderie-surface,#fff)',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 'var(--fonderie-radius-lg,8px)',
		overflow: 'hidden',
	},
	row: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: 12,
		padding: '9px 16px',
		borderBottom: '1px solid var(--fonderie-border-light,#f5f5f5)',
		fontSize: 13,
	},
	rollbackButton: {
		display: 'inline-flex',
		alignItems: 'center',
		height: 28,
		boxSizing: 'border-box',
		background: 'var(--fonderie-surface,#fff)',
		color: 'var(--fonderie-text,#171717)',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 6,
		padding: '0 10px',
		fontSize: 12.5,
		fontWeight: 500,
		fontFamily: 'inherit',
		cursor: 'pointer',
	},
};
