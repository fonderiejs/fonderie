import {
	type ConfigAdminClient,
	type ConfigValueType,
	castConfigValue,
	configKeyProblem,
	configValueLabel,
	configValueType,
	formatConfigValue,
	inferConfigValue,
} from '@fonderie/client';
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
	/** Empty string ⇒ create mode: the operator names the new key. */
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
	const isNew = configKey === '';
	const [newKey, setNewKey] = useState('');
	const key = isNew ? newKey.trim() : configKey;
	const [valueType, setValueType] = useState<ConfigValueType>('string');
	// Free-form mode: creating, or deliberately changing an entry's type. The
	// type is inferred from what is typed; ambiguous input ("true", "42") can
	// be kept as text with one click. Editing an existing entry otherwise locks
	// the type to what is stored, so a flag cannot silently turn into text.
	const [changingType, setChangingType] = useState(false);
	const [asText, setAsText] = useState(false);
	const freeForm = isNew || changingType;
	const [inputError, setInputError] = useState<string | null>(null);

	const configEntry = useConfigEntry(client, isSecret || isNew ? '' : configKey, environment);
	const secretEntry = useSecret(client, isSecret && !isNew ? configKey : '', environment);
	// Saves go through the list hooks (which re-fetch their lists after each
	// write); mounting them adds a config-list and a secrets-list fetch to this
	// single-entry editor — acceptable for an admin dashboard.
	const configEntries = useConfigEntries(client, environment);
	const secrets = useSecrets(client, environment);
	const configRevisions = useConfigRevisions(client, isSecret || isNew ? '' : configKey, environment);
	const secretRevisions = useSecretRevisions(client, isSecret && !isNew ? configKey : '', environment);
	const { revealSecret, isLoading: isRevealing } = useRevealSecret(client);

	const entry = isSecret ? secretEntry : configEntry;
	const revisions = isSecret ? secretRevisions : configRevisions;

	const [value, setValue] = useState('');
	const inferred = inferConfigValue(value);
	const [description, setDescription] = useState('');
	const [revealedValue, setRevealedValue] = useState<string | null>(null);
	// The list hooks' isLoading/error track their list fetches (and are shared
	// across mutations), so the save action keeps its own state.
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<FonderieApiError | null>(null);

	useEffect(() => {
		if (isSecret) return;
		if (!configEntry.entry) return;
		const type = configValueType(configEntry.entry.value);
		setValueType(type);
		setValue(formatConfigValue(configEntry.entry.value, type));
		setDescription(configEntry.entry.description ?? '');
	}, [isSecret, configEntry.entry]);

	useEffect(() => {
		if (!isSecret) return;
		if (!secretEntry.secret) return;
		setDescription(secretEntry.secret.description ?? '');
	}, [isSecret, secretEntry.secret]);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setSaveError(null);
		setInputError(null);
		if (isNew) {
			const problem = configKeyProblem(key);
			if (problem) return setInputError(problem);
			// Creating must never overwrite: a save to an existing key would
			// silently replace its value.
			const taken = isSecret
				? secrets.secrets.some((s) => s.key === key)
				: configEntries.entries.some((e) => e.key === key);
			if (taken) return setInputError(`"${key}" already exists — open it from the list to edit.`);
		}
		let typed: unknown = value;
		if (!isSecret) {
			if (freeForm) {
				typed = asText ? value : inferred.value;
			} else {
				const cast = castConfigValue(valueType, value);
				if (!cast.ok) return setInputError(cast.error);
				typed = cast.value;
			}
		}
		setIsSaving(true);
		try {
			if (isSecret) {
				const opts: Parameters<typeof secrets.saveSecret>[1] = { value };
				if (description) opts.description = description;
				await secrets.saveSecret(key, opts);
			} else {
				const opts: Parameters<typeof configEntries.saveEntry>[1] = { value: typed };
				if (description) opts.description = description;
				// Only an explicit "Change type" may change an existing key's shape;
				// the server refuses it otherwise (409 CONFIG_TYPE_CHANGE).
				if (changingType) opts.allowTypeChange = true;
				await configEntries.saveEntry(key, opts);
			}
			// The list hooks refresh their own lists; this screen renders the
			// single entry, so re-read it too.
			if (!isNew) await entry.refresh();
			onSaved?.();
		} catch (err) {
			if (err instanceof FonderieApiError) setSaveError(err);
			else setInputError((err as Error).message);
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

	if (!isNew && entry.isLoading) return <p style={styles.status}>Loading…</p>;
	if (!isNew && entry.error)
		return (
			<p style={styles.error} role="alert">
				{entry.error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>{isNew ? (isSecret ? 'New secret' : 'New config entry') : configKey}</h1>
			<p style={styles.meta}>
				Environment: {environment ?? 'all'}
				{!isNew && <> · v{isSecret ? secretEntry.secret?.version : configEntry.entry?.version}</>}
			</p>

			{isSecret && !isNew && (
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
				{isNew && (
					<>
						<label style={styles.label} htmlFor="config-key">
							Key
						</label>
						<input
							id="config-key"
							style={styles.input}
							value={newKey}
							placeholder={isSecret ? 'STRIPE_SECRET_KEY' : 'ENABLE_JOB_LISTING'}
							onChange={(event) => setNewKey(event.target.value)}
							autoComplete="off"
							spellCheck={false}
							required
						/>
					</>
				)}

				<label style={styles.label} htmlFor="config-value">
					{isSecret ? (isNew ? 'Value' : 'New value') : 'Value'}
				</label>
				{!isSecret && freeForm ? (
					<>
						{/* One field for every shape: text, a number, true/false, or JSON
						    for an object or a list of objects. */}
						<textarea
							id="config-value"
							style={styles.textarea}
							value={value}
							onChange={(event) => {
								setValue(event.target.value);
								setAsText(false);
							}}
							rows={/^\s*[[{]/.test(value) || value.includes('\n') ? 8 : 2}
							placeholder={'true · 42 · Scheduled maintenance tonight · {"ids": ["m1", "m2"]}'}
							spellCheck={false}
						/>
						<div style={styles.detected}>
							<span>
								Detected: <strong>{asText ? 'Text' : inferred.label}</strong>
							</span>
							{inferred.ambiguous && (
								<label style={styles.inline}>
									<input type="checkbox" checked={asText} onChange={(event) => setAsText(event.target.checked)} />
									Save as text instead
								</label>
							)}
						</div>
					</>
				) : !isSecret && valueType === 'boolean' ? (
					<label style={styles.toggle}>
						<input
							id="config-value"
							type="checkbox"
							checked={value === 'true'}
							onChange={(event) => setValue(event.target.checked ? 'true' : 'false')}
						/>
						{value === 'true' ? 'On (true)' : 'Off (false)'}
					</label>
				) : !isSecret && valueType === 'number' ? (
					<input
						id="config-value"
						style={styles.input}
						inputMode="decimal"
						value={value}
						onChange={(event) => setValue(event.target.value)}
						required
					/>
				) : !isSecret && valueType === 'string' ? (
					<input id="config-value" style={styles.input} value={value} onChange={(event) => setValue(event.target.value)} />
				) : (
					<textarea
						id="config-value"
						style={styles.textarea}
						value={value}
						onChange={(event) => setValue(event.target.value)}
						rows={isSecret ? 2 : 8}
						spellCheck={false}
						required
					/>
				)}
				{!isSecret && !freeForm && configEntry.entry && (
					<div style={styles.detected}>
						<span>
							Type: <strong>{configValueLabel(configEntry.entry.value)}</strong>
						</span>
						<button
							type="button"
							style={styles.linkButton}
							onClick={() => {
								setChangingType(true);
								setAsText(false);
							}}
						>
							Change type…
						</button>
					</div>
				)}
				{changingType && (
					<p style={styles.warning}>
						Changing the type changes what every screen reading this key receives. Check the code that reads it first.
					</p>
				)}
				{inputError && (
					<p style={styles.error} role="alert">
						{inputError}
					</p>
				)}

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

			{!isNew && revisions.revisions.length > 0 && (
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
	detected: { display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--fonderie-text-muted,#5c5c5c)', marginTop: 6 },
	inline: { display: 'flex', alignItems: 'center', gap: 6 },
	linkButton: { background: 'none', border: 'none', padding: 0, fontSize: 13, color: 'var(--fonderie-link,#0b6)', cursor: 'pointer', textDecoration: 'underline' },
	warning: { fontSize: 13, color: 'var(--fonderie-warning,#a15c00)', marginTop: 6 },
	toggle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '6px 0' },
	container: { padding: 24, maxWidth: 640 },
	title: { fontSize: 24, fontWeight: 700 },
	meta: { fontSize: 13, color: 'var(--fonderie-text-muted,#5c5c5c)', marginBottom: 16 },
	status: { padding: 24, textAlign: 'center', color: 'var(--fonderie-text-muted,#5c5c5c)' },
	error: { color: 'var(--fonderie-danger,#e00)', marginBottom: 12, fontSize: 14 },
	revealBox: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
	revealedValue: { fontFamily: 'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)', fontSize: 13, color: 'var(--fonderie-text,#171717)' },
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
	smallButton: {
		background: 'none',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
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
		borderBottom: '1px solid var(--fonderie-border-light,#f5f5f5)',
		fontSize: 13,
	},
};
