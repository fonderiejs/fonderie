import type { CourierAdminClient, FonderieApiError, ISetTemplateInput } from '@fonderie/client';
import { useTemplate, useTemplateRevisions, useTemplates } from '@fonderie/react-courier-admin';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useState } from 'react';

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

	useEffect(() => {
		if (!template) return;
		setSubject(template.subject ?? '');
		setHtml(template.html ?? '');
		setText(template.text);
		setActive(template.active);
	}, [template]);

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
	container: { padding: 24, maxWidth: 640 },
	title: { fontSize: 24, fontWeight: 700 },
	meta: { fontSize: 13, color: '#666', marginBottom: 16 },
	status: { padding: 24, textAlign: 'center', color: '#666' },
	error: { color: '#e11d48', marginBottom: 12, fontSize: 14 },
	form: { display: 'flex', flexDirection: 'column', gap: 4 },
	label: { fontSize: 13, fontWeight: 600, marginTop: 12 },
	input: { border: '1px solid #ddd', borderRadius: 8, padding: 10, fontSize: 14 },
	textarea: {
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: 10,
		fontSize: 14,
		fontFamily: 'monospace',
	},
	checkboxLabel: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14 },
	button: {
		marginTop: 16,
		backgroundColor: '#000',
		color: '#fff',
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
		borderBottom: '1px solid #eee',
		fontSize: 13,
	},
	rollbackButton: {
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: '4px 10px',
		fontSize: 12,
		cursor: 'pointer',
	},
};
