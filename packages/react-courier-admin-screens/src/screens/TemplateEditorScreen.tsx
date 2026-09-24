import type { CourierAdminClient, FonderieApiError, ISetTemplateInput } from '@fonderie/client';
import {
	useTemplate,
	useTemplatePreview,
	useTemplateRevisions,
	useTemplates,
} from '@fonderie/react-courier-admin';
import type { CSSProperties, FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

// Implicit variables the layout injects — an operator never supplies these, so
// offering them as fields would just be noise.
const IMPLICIT = new Set(['subject', 'preheader', 'brandName']);

export interface ITemplateEditorScreenProps {
	client: CourierAdminClient;
	type: string;
	locale?: string | null;
	onSaved?: () => void;
}

export function TemplateEditorScreen({
	client,
	type,
	locale,
	onSaved,
}: ITemplateEditorScreenProps) {
	const { template, isLoading, error, refresh } = useTemplate(client, type, locale);
	// Saves go through the list hook (which re-fetches the template list after
	// each write); mounting it adds a template-list fetch to this single-template
	// editor — acceptable for an admin dashboard. Its isLoading/error track that
	// list fetch, so the save action keeps local state.
	const { saveTemplate } = useTemplates(client);
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

	// One render once the template has loaded, so the pane is never empty on
	// arrival. Re-rendering after that is explicit — an edit per keystroke would
	// be a request per keystroke.
	const loadedType = template ? `${type}:${locale ?? ''}` : null;
	// `run` closes over subject/html/text/sampleJson, so it is a new function on
	// every keystroke; depending on it here would fire a request per character
	// typed. Firing on the loaded template is the intent — re-rendering after
	// that is the Render button's job.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		if (loadedType) void run();
	}, [loadedType]);

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

	if (isLoading) return <p style={styles.status}>Loading template…</p>;
	if (error)
		return (
			<p style={styles.error} role="alert">
				{error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>{type}</h1>
			<p style={styles.meta}>
				{locale ?? 'base'} · v{template?.version ?? 1}
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

				{saveError && (
					<p style={styles.error} role="alert">
						{saveError.explanation}
					</p>
				)}

				<button type="submit" disabled={isSaving} style={styles.button}>
					{isSaving ? 'Saving…' : 'Save'}
				</button>
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

			<div style={styles.column}>
				<div style={styles.previewHeader}>
					<span style={styles.label}>Preview</span>
					<button type="button" onClick={() => void run()} disabled={isPreviewing} style={styles.rollbackButton}>
						{isPreviewing ? 'Rendering…' : 'Render'}
					</button>
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
	container: { padding: 24, maxWidth: 1180 },
	split: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
	column: { flex: '1 1 460px', minWidth: 320, display: 'flex', flexDirection: 'column' },
	previewHeader: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 12,
	},
	previewSubject: { fontSize: 14, fontWeight: 600, margin: '8px 0' },
	previewFrame: {
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
		fontFamily: 'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	},
	title: { fontSize: 24, fontWeight: 700 },
	meta: { fontSize: 13, color: 'var(--fonderie-text-muted,#5c5c5c)', marginBottom: 16 },
	status: { padding: 24, textAlign: 'center', color: 'var(--fonderie-text-muted,#5c5c5c)' },
	error: { color: 'var(--fonderie-danger,#e00)', marginBottom: 12, fontSize: 14 },
	form: { display: 'flex', flexDirection: 'column', gap: 4 },
	label: { fontSize: 13, fontWeight: 600, marginTop: 12 },
	input: { border: '1px solid var(--fonderie-border,#e0e0e0)', borderRadius: 8, padding: 10, fontSize: 14 },
	textarea: {
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
		fontFamily: 'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	},
	checkboxLabel: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14 },
	button: {
		marginTop: 16,
		backgroundColor: 'var(--fonderie-text,#171717)',
		color: 'var(--fonderie-surface,#fff)',
		padding: '10px 20px',
		borderRadius: 8,
		border: 'none',
		fontSize: 14,
		fontWeight: 600,
		cursor: 'pointer',
		alignSelf: 'flex-start',
	},
	revisions: { marginTop: 32 },
	subtitle: { fontSize: 16, fontWeight: 600, marginBottom: 8 },
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '8px 0',
		borderBottom: '1px solid var(--fonderie-border-light,#f5f5f5)',
		fontSize: 13,
	},
	rollbackButton: {
		background: 'none',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 8,
		padding: '4px 10px',
		fontSize: 12,
		cursor: 'pointer',
	},
};
