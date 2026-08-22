import type { ConfigAdminClient } from '@fonderie/client';
import {
	FonderieApiError,
	useConfigEntries,
	useConfigEntry,
	useConfigRevisions,
	useRevealSecret,
	useSecret,
	useSecretRevisions,
	useSecrets,
} from '@fonderie/react-config-admin';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useState } from 'react';

export interface IConfigEditorScreenProps {
	client: ConfigAdminClient;
	kind: 'config' | 'secret';
	configKey: string;
	environment?: string;
	onSaved?: () => void;
}

export function ConfigEditorScreen({
	client,
	kind,
	configKey,
	environment,
	onSaved,
}: IConfigEditorScreenProps) {
	const isSecret = kind === 'secret';

	const configEntry = useConfigEntry(client, isSecret ? '' : configKey, environment);
	const secretEntry = useSecret(client, isSecret ? configKey : '', environment);
	// Saves go through the list hooks (which re-fetch their lists after each
	// write); mounting them adds a config-list and a secrets-list fetch to this
	// single-entry editor — acceptable for an admin dashboard.
	const configEntries = useConfigEntries(client, environment);
	const secrets = useSecrets(client, environment);
	const configRevisions = useConfigRevisions(client, isSecret ? '' : configKey, environment);
	const secretRevisions = useSecretRevisions(client, isSecret ? configKey : '', environment);
	const { revealSecret, isLoading: isRevealing } = useRevealSecret(client);

	const entry = isSecret ? secretEntry : configEntry;
	const revisions = isSecret ? secretRevisions : configRevisions;

	const [value, setValue] = useState('');
	const [description, setDescription] = useState('');
	const [revealedValue, setRevealedValue] = useState<string | null>(null);
	// The list hooks' isLoading/error track their list fetches (and are shared
	// across mutations), so the save action keeps its own state.
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<FonderieApiError | null>(null);

	useEffect(() => {
		if (isSecret) return;
		if (!configEntry.entry) return;
		setValue(JSON.stringify(configEntry.entry.value, null, 2));
		setDescription(configEntry.entry.description ?? '');
	}, [isSecret, configEntry.entry]);

	useEffect(() => {
		if (!isSecret) return;
		if (!secretEntry.secret) return;
		setDescription(secretEntry.secret.description ?? '');
	}, [isSecret, secretEntry.secret]);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setIsSaving(true);
		setSaveError(null);
		try {
			if (isSecret) {
				const opts: Parameters<typeof secrets.saveSecret>[1] = { value };
				if (description) opts.description = description;
				await secrets.saveSecret(configKey, opts);
			} else {
				const opts: Parameters<typeof configEntries.saveEntry>[1] = { value: JSON.parse(value) };
				if (description) opts.description = description;
				await configEntries.saveEntry(configKey, opts);
			}
			// The list hooks refresh their own lists; this screen renders the
			// single entry, so re-read it too.
			await entry.refresh();
			onSaved?.();
		} catch (err) {
			// API failures surface inline; JSON.parse errors stay silent as before.
			if (err instanceof FonderieApiError) setSaveError(err);
		} finally {
			setIsSaving(false);
		}
	};

	const handleReveal = async () => {
		try {
			setRevealedValue(await revealSecret(configKey, environment));
		} catch {
			// Surfaced via useRevealSecret's error state.
		}
	};

	if (entry.isLoading) return <p style={styles.status}>Loading…</p>;
	if (entry.error)
		return (
			<p style={styles.error} role="alert">
				{entry.error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>{configKey}</h1>
			<p style={styles.meta}>
				{environment ?? 'all'} · v
				{isSecret ? secretEntry.secret?.version : configEntry.entry?.version}
			</p>

			{isSecret && (
				<div style={styles.revealBox}>
					<span style={styles.revealedValue}>{revealedValue ?? '••••••••'}</span>
					<button
						type="button"
						disabled={isRevealing}
						onClick={handleReveal}
						style={styles.smallButton}
					>
						Reveal
					</button>
				</div>
			)}

			<form style={styles.form} onSubmit={handleSubmit}>
				<label style={styles.label} htmlFor="config-value">
					{isSecret ? 'New value' : 'Value (JSON)'}
				</label>
				<textarea
					id="config-value"
					style={styles.textarea}
					value={value}
					onChange={(event) => setValue(event.target.value)}
					rows={isSecret ? 2 : 8}
					required
				/>

				<label style={styles.label} htmlFor="config-description">
					Description
				</label>
				<input
					id="config-description"
					style={styles.input}
					value={description}
					onChange={(event) => setDescription(event.target.value)}
				/>

				{saveError && (
					<p style={styles.error} role="alert">
						{saveError.explanation}
					</p>
				)}

				<button type="submit" disabled={isSaving} style={styles.button}>
					{isSaving ? 'Saving…' : 'Save'}
				</button>
			</form>

			{revisions.revisions.length > 0 && (
				<div style={styles.revisions}>
					<h2 style={styles.subtitle}>History</h2>
					<ul style={styles.list}>
						{revisions.revisions.map((rev) => (
							<li key={rev.version} style={styles.row}>
								<span>
									v{rev.version} — {rev.actor ?? 'unknown'} —{' '}
									{new Date(rev.createdAt).toLocaleString()}
								</span>
								<button
									type="button"
									onClick={() => revisions.rollback(rev.version)}
									style={styles.smallButton}
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
	revealBox: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
	revealedValue: { fontFamily: 'monospace', fontSize: 13, color: '#333' },
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
	smallButton: {
		background: 'none',
		border: '1px solid #ddd',
		borderRadius: 8,
		padding: '4px 10px',
		fontSize: 12,
		cursor: 'pointer',
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
};
