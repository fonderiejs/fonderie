import {
	type AdminLocale,
	type CourierAdminClient,
	FonderieApiError,
	type ISetTemplateInput,
	createAdminT,
} from '@fonderie/client';
import { useTemplatePreview } from '@fonderie/react-courier-admin';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

export interface ITemplateCreateScreenProps {
	client: CourierAdminClient;
	/**
	 * Given ⇒ add a LOCALE of this existing template: the type is fixed and the
	 * form starts from its default-locale copy. Omitted ⇒ a brand-new template
	 * type (one the app sends that has no stored copy yet).
	 */
	type?: string;
	/** Locales already in use, offered as suggestions. */
	locales?: string[];
	/** Called with what was created, so the caller can open it in the editor. */
	onCreated?: (created: { type: string; locale: string | null }) => void;
	/** The console's language. Default English. */
	locale?: AdminLocale | undefined;
}

const TYPE_RE = /^[a-z0-9][a-z0-9_-]{0,80}$/;
const LOCALE_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
// Variables the layout injects — never sample values, as in the editor.
const IMPLICIT = new Set(['subject', 'preheader', 'brandName']);
const PREVIEW_DEBOUNCE_MS = 500;

// Creating is its own screen: the editor loads an existing row, and a new
// template or locale has none yet. Once saved, the editor takes over.
export function TemplateCreateScreen({
	client,
	type,
	locales = [],
	onCreated,
	locale,
}: ITemplateCreateScreenProps) {
	const tr = createAdminT(locale);
	const addingLocale = type !== undefined;
	const [newType, setNewType] = useState('');
	const [targetLocale, setTargetLocale] = useState('');
	const [subject, setSubject] = useState('');
	const [html, setHtml] = useState('');
	const [text, setText] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	// The default copy this locale started from, to flag fields not yet translated.
	const [source, setSource] = useState<{ subject: string; html: string; text: string } | null>(
		null,
	);
	const { preview, isPreviewing, error: previewError, renderPreview } = useTemplatePreview(client);
	// Each variable renders as its own name, so the preview shows where it lands.
	// Learned from the server's answer, not re-parsed here.
	const variables = useRef<string[]>([]);

	// A new locale starts from the default copy, so translating is editing.
	useEffect(() => {
		if (!type) return;
		client
			.getTemplate(type, null)
			.then(({ result }) => {
				setSubject(result.subject ?? '');
				setHtml(result.html ?? '');
				setText(result.text);
				setSource({ subject: result.subject ?? '', html: result.html ?? '', text: result.text });
			})
			.catch(() => undefined);
	}, [client, type]);

	// Live preview, as in the editor: translating is where it matters most — a
	// half-translated email looks finished in a textarea and wrong in the render.
	const previewType = addingLocale ? (type as string) : newType.trim();
	const previewLocale = LOCALE_RE.test(targetLocale.trim()) ? targetLocale.trim() : null;
	useEffect(() => {
		if (!TYPE_RE.test(previewType) || !text.trim()) return;
		const timer = setTimeout(async () => {
			const input = { text, ...(subject ? { subject } : {}), ...(html ? { html } : {}) };
			const render = () =>
				renderPreview(
					previewType,
					{ ...input, data: Object.fromEntries(variables.current.map((v) => [v, v])) },
					previewLocale,
				);
			try {
				const result = await render();
				const used = result.variables.filter((v) => !IMPLICIT.has(v));
				// A variable not seen before rendered empty: render once more with it.
				if (used.some((v) => !variables.current.includes(v))) {
					variables.current = used;
					await render();
				}
			} catch {
				// Shown through previewError.
			}
		}, PREVIEW_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [renderPreview, previewType, previewLocale, subject, html, text]);

	const untranslated = source
		? [
				subject && subject === source.subject ? tr('templates.subject') : null,
				html && html === source.html ? tr('templates.htmlBody') : null,
				text === source.text ? tr('templates.textBody') : null,
			].filter((f): f is string => f !== null)
		: [];

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		const t = addingLocale ? (type as string) : newType.trim();
		const l = targetLocale.trim() || null;
		if (!TYPE_RE.test(t)) return setError(tr('templates.create.errorType'));
		if (addingLocale && !l) return setError(tr('templates.create.errorLocaleRequired'));
		if (l && !LOCALE_RE.test(l)) return setError(tr('templates.create.errorLocale'));
		if (!text.trim()) return setError(tr('templates.create.errorText'));
		setBusy(true);
		try {
			// Refuse to overwrite: creating an existing row would replace it.
			const exists = await client.getTemplate(t, l).then(
				() => true,
				(err: unknown) => !(err instanceof FonderieApiError && err.status === 404),
			);
			if (exists) {
				setError(
					l
						? tr('templates.create.existsLocale', { type: t, locale: l })
						: tr('templates.create.exists', { type: t }),
				);
				return;
			}
			const input: ISetTemplateInput = { text, active: true };
			if (subject) input.subject = subject;
			if (html) input.html = html;
			await client.setTemplate(t, input, l);
			onCreated?.({ type: t, locale: l });
		} catch (err) {
			setError(err instanceof FonderieApiError ? err.explanation : String(err));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>
				{addingLocale
					? tr('templates.create.titleLocale', { type: type as string })
					: tr('templates.create.titleNew')}
			</h1>
			<p style={styles.meta}>
				{addingLocale ? tr('templates.create.hintLocale') : tr('templates.create.hintNew')}
			</p>
			<div style={styles.split}>
				<form style={styles.form} onSubmit={(e) => void submit(e)}>
					{!addingLocale ? (
						<>
							<label style={styles.label} htmlFor="new-template-type">
								{tr('templates.create.type')}
							</label>
							<input
								id="new-template-type"
								style={styles.input}
								value={newType}
								placeholder="weekly-digest"
								autoComplete="off"
								spellCheck={false}
								onChange={(e) => setNewType(e.target.value)}
							/>
						</>
					) : null}
					<label style={styles.label} htmlFor="new-template-locale">
						{addingLocale ? tr('templates.create.locale') : tr('templates.create.localeOptional')}
					</label>
					<input
						id="new-template-locale"
						style={styles.input}
						value={targetLocale}
						placeholder="fr"
						list="new-template-locales"
						autoComplete="off"
						spellCheck={false}
						onChange={(e) => setTargetLocale(e.target.value)}
					/>
					<datalist id="new-template-locales">
						{[...new Set(locales)].map((l) => (
							<option key={l} value={l} />
						))}
					</datalist>
					<label style={styles.label} htmlFor="new-template-subject">
						{tr('templates.subject')}
					</label>
					<input
						id="new-template-subject"
						style={styles.input}
						value={subject}
						onChange={(e) => setSubject(e.target.value)}
					/>
					<label style={styles.label} htmlFor="new-template-html">
						{tr('templates.htmlBody')}
					</label>
					<textarea
						id="new-template-html"
						style={{ ...styles.textarea, minHeight: 160 }}
						value={html}
						onChange={(e) => setHtml(e.target.value)}
					/>
					<label style={styles.label} htmlFor="new-template-text">
						{tr('templates.textBody')}
					</label>
					<textarea
						id="new-template-text"
						style={{ ...styles.textarea, minHeight: 100 }}
						value={text}
						onChange={(e) => setText(e.target.value)}
					/>
					{untranslated.length > 0 ? (
						<p style={styles.notice}>
							{tr('templates.create.untranslated', { fields: untranslated.join(', ') })}
						</p>
					) : null}
					{error ? (
						<p style={styles.error} role="alert">
							{error}
						</p>
					) : null}
					<button type="submit" disabled={busy} style={styles.button}>
						{busy
							? tr('templates.create.creating')
							: addingLocale
								? tr('templates.create.submitLocale')
								: tr('templates.create.submitNew')}
					</button>
				</form>

				<div style={styles.previewColumn}>
					<div style={styles.previewHeader}>
						<span style={styles.label}>{tr('templates.editor.preview')}</span>
						<span style={styles.meta}>
							{isPreviewing ? tr('templates.editor.rendering') : tr('templates.editor.live')}
						</span>
					</div>
					{previewError ? (
						<p style={styles.error} role="alert">
							{previewError.explanation}
						</p>
					) : null}
					{preview?.subject ? <p style={styles.previewSubject}>{preview.subject}</p> : null}
					{preview?.html ? (
						// sandbox="" — no scripts, no same-origin: operator-authored HTML must
						// never execute in the console's origin.
						<iframe
							title={tr('templates.editor.previewTitle')}
							style={styles.previewFrame}
							sandbox=""
							srcDoc={preview.html}
						/>
					) : preview ? (
						<pre style={styles.previewText}>{preview.text}</pre>
					) : (
						<p style={styles.meta}>{tr('templates.editor.nothingRendered')}</p>
					)}
				</div>
			</div>
		</div>
	);
}

const MONO =
	'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)';
const styles: Record<string, CSSProperties> = {
	container: { padding: '8px 40px 64px', maxWidth: 1400, boxSizing: 'border-box' },
	// The editor's layout: the form on the left, the render pinned on the right.
	split: {
		display: 'grid',
		gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
		gap: 24,
		alignItems: 'start',
	},
	previewColumn: {
		minWidth: 0,
		display: 'flex',
		flexDirection: 'column',
		position: 'sticky',
		top: 16,
	},
	previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
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
		fontFamily: MONO,
	},
	// The console's warning token (the shell's amber), readable in both themes.
	notice: {
		fontSize: 13,
		color: 'var(--fonderie-text,#171717)',
		background: 'color-mix(in srgb, var(--fonderie-warning,#f5a623) 16%, transparent)',
		borderRadius: 6,
		padding: '8px 12px',
		margin: '12px 0 0',
	},
	title: {
		fontSize: 22,
		fontWeight: 600,
		margin: '8px 0 4px',
		letterSpacing: 'var(--fonderie-tracking-display,-0.05em)',
		lineHeight: 1.25,
	},
	meta: {
		fontSize: 13,
		color: 'var(--fonderie-text-muted,#5c5c5c)',
		marginBottom: 20,
		lineHeight: 1.5,
	},
	form: {
		display: 'flex',
		flexDirection: 'column',
		gap: 4,
		background: 'var(--fonderie-surface,#fff)',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 'var(--fonderie-radius-lg,8px)',
		padding: '6px 20px 20px',
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
		fontFamily: MONO,
	},
	error: {
		color: 'var(--fonderie-danger,#e00)',
		background: 'color-mix(in srgb, var(--fonderie-danger,#e00) 8%, transparent)',
		borderRadius: 6,
		padding: '8px 12px',
		margin: '8px 0',
		fontSize: 13.5,
	},
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
		marginTop: 16,
	},
};
