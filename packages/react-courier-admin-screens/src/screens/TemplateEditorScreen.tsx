import type { CourierAdminClient, FonderieApiError, ISetTemplateInput } from '@fonderie/client';
import {
	useTemplate,
	useTemplatePreview,
	useTemplateRevisions,
	useTemplates,
} from '@fonderie/react-courier-admin';
import type { CSSProperties, FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
	/** Shows "Add locale": create a translation of this template. */
	onAddLocale?: (type: string) => void;
}

export function TemplateEditorScreen({
	client,
	type,
	locale,
	onSaved,
	system = false,
	onDeleted,
	onAddLocale,
}: ITemplateEditorScreenProps) {
	const { template, isLoading, error, refresh } = useTemplate(client, type, locale);
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
		if (!template) return;
		setSubject(template.subject ?? '');
		setHtml(template.html ?? '');
		setText(template.text);
		setActive(template.active);
	}, [template]);

	const run = useCallback(async () => {
		let data: Record<string, unknown> = {};
		try {
			const parsed: unknown = JSON.parse(sampleJson || '{}');
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				setSampleError('Sample data must be a JSON object.');
				return;
			}
			data = parsed as Record<string, unknown>;
			setSampleError(null);
		} catch {
			setSampleError('Sample data is not valid JSON.');
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
	}, [renderPreview, type, text, subject, html, locale, sampleJson]);

	// The preview is always live: it renders once the template loads, then again
	// PREVIEW_DEBOUNCE_MS after the last edit to the content or the sample data.
	// Debounced, not per keystroke, so typing a paragraph costs one request.
	// `run` is a new function on every keystroke (it closes over the fields), so
	// the effect keys on the fields themselves and calls the latest `run`.
	const runRef = useRef(run);
	runRef.current = run;
	const loadedType = template ? `${type}:${locale ?? ''}` : null;
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
	const dirty =
		!!template &&
		(subject !== (template.subject ?? '') ||
			html !== (template.html ?? '') ||
			text !== template.text ||
			active !== template.active);

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
			// template, so re-read it too.
			await refresh();
			onSaved?.();
		} catch (err) {
			// useTemplates normalizes every failure to FonderieApiError before throwing.
			setSaveError(err as FonderieApiError);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		const which = locale ? `the ${locale} version of "${type}"` : `"${type}"`;
		const fallback = locale ? ' People in that locale will receive the default version.' : '';
		if (!window.confirm(`Delete ${which}?${fallback}`)) return;
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

	if (isLoading) return <p style={styles.status}>Loading template…</p>;
	if (error)
		return (
			<p style={styles.error} role="alert">
				{error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
				<h1 style={styles.title}>{type}</h1>
				{onAddLocale && !locale ? (
					<button
						type="button"
						style={{ ...styles.rollbackButton, marginLeft: 'auto' }}
						onClick={() => onAddLocale(type)}
					>
						+ Add locale
					</button>
				) : null}
			</div>
			<p style={styles.meta}>
				<strong>{locale ?? 'default locale'}</strong> · v{template?.version ?? 1}
				{system ? ' · built-in email: edit or roll back, it cannot be deleted' : ''}
			</p>

			<div style={styles.split}>
				<div style={styles.column}>
					<form style={styles.form} onSubmit={handleSubmit}>
						<label style={styles.label} htmlFor="template-subject">
							Subject
						</label>
						<input
							id="template-subject"
							style={styles.input}
							value={subject}
							onChange={(event) => setSubject(event.target.value)}
						/>

						<label style={styles.label} htmlFor="template-html">
							HTML body
						</label>
						<textarea
							id="template-html"
							style={styles.textarea}
							value={html}
							onChange={(event) => setHtml(event.target.value)}
							rows={8}
						/>

						<label style={styles.label} htmlFor="template-text">
							Plain-text body
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
							Active
						</label>

						{saveError?.reason === 'VERSION_CONFLICT' ? (
							<p style={styles.error} role="alert">
								Someone changed this template since you opened it. Reload to see their change, then
								edit again.{' '}
								<button
									type="button"
									style={styles.rollbackButton}
									onClick={() => {
										setSaveError(null);
										void refresh();
									}}
								>
									Reload
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
								{isSaving ? 'Saving…' : 'Save'}
							</button>
							{!dirty && !isSaving && <span style={styles.meta}>No changes to save</span>}
							{!system ? (
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
									{isDeleting ? 'Deleting…' : 'Delete'}
								</button>
							) : null}
						</div>
					</form>

					<label style={styles.label} htmlFor="template-sample">
						Sample data
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
						<span style={styles.label}>Preview</span>
						<span style={styles.meta}>{isPreviewing ? 'Rendering…' : 'Live'}</span>
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
							title="Template preview"
							style={styles.previewFrame}
							sandbox=""
							srcDoc={preview.html}
						/>
					) : preview ? (
						<pre style={styles.previewText}>{preview.text}</pre>
					) : (
						<p style={styles.meta}>Nothing rendered yet.</p>
					)}
				</div>
			</div>

			{revisions.length > 0 && (
				<div style={styles.revisions}>
					<h2 style={styles.subtitle}>History</h2>
					<ul style={styles.list}>
						{revisions.map((rev) => (
							<li key={rev.version} style={styles.row}>
								<span>
									v{rev.version} — {rev.actor ?? 'unknown'} —{' '}
									{new Date(rev.createdAt).toLocaleString()}
								</span>
								<button
									type="button"
									onClick={() => rollback(rev.version)}
									style={styles.rollbackButton}
								>
									Roll back
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: '8px 40px 64px', maxWidth: 1400, boxSizing: 'border-box' },
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
