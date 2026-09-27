import {
	type AdminLocale,
	type ConfigAdminClient,
	type ConfigValueType,
	castConfigValue,
	configKeyProblem,
	configValueType,
	createAdminT,
	formatAdminDate,
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
	/** Called after a successful delete; the entry no longer exists. */
	onDeleted?: () => void;
	/** Environments already in use, offered when creating an entry. */
	environments?: string[];
	/** The console's language. Default English. */
	locale?: AdminLocale | undefined;
}

export function ConfigEditorScreen({
	client,
	kind,
	configKey,
	environment,
	onSaved,
	onDeleted,
	environments = [],
	locale,
}: IConfigEditorScreenProps) {
	const t = createAdminT(locale);
	// The shape of a value, in the console's language (the client's own labels
	// are English-only).
	const shapeLabel = (v: unknown): string =>
		typeof v === 'string'
			? t('config.shape.text')
			: typeof v === 'number'
				? t('config.shape.number')
				: typeof v === 'boolean'
					? t('config.shape.onOff')
					: Array.isArray(v)
						? t('config.shape.list')
						: v === null
							? t('config.shape.empty')
							: t('config.shape.object');
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
	// Creating: which environment the new entry belongs to. 'all' is the shared
	// value every environment reads unless it has its own.
	const [targetEnv, setTargetEnv] = useState(environment ?? 'all');
	const [isDeleting, setIsDeleting] = useState(false);

	const configEntry = useConfigEntry(client, isSecret || isNew ? '' : configKey, environment);
	const secretEntry = useSecret(client, isSecret && !isNew ? configKey : '', environment);
	// Saves go through the list hooks (which re-fetch their lists after each
	// write); mounting them adds a config-list and a secrets-list fetch to this
	// single-entry editor — acceptable for an admin dashboard.
	const configEntries = useConfigEntries(client, environment);
	const secrets = useSecrets(client, environment);
	const configRevisions = useConfigRevisions(
		client,
		isSecret || isNew ? '' : configKey,
		environment,
	);
	const secretRevisions = useSecretRevisions(
		client,
		isSecret && !isNew ? configKey : '',
		environment,
	);
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
			if (problem) return setInputError(key ? t('config.errors.keyPattern') : t('config.errors.keyRequired'));
			// Creating must never overwrite: a save to an existing key would
			// silently replace its value.
			const env = targetEnv.trim() || 'all';
			const inEnv = (e: { key: string; environment?: string | null }) =>
				e.key === key && (e.environment ?? 'all') === env;
			const taken = isSecret ? secrets.secrets.some(inEnv) : configEntries.entries.some(inEnv);
			if (taken)
				return setInputError(t('config.errors.exists', { key, env }));
		}
		let typed: unknown = value;
		if (!isSecret) {
			if (freeForm) {
				typed = asText ? value : inferred.value;
			} else {
				const cast = castConfigValue(valueType, value);
				if (!cast.ok)
					return setInputError(
						valueType === 'number'
							? t('config.errors.number')
							: valueType === 'boolean'
								? t('config.errors.boolean')
								: valueType === 'json'
									? t('config.errors.json', { detail: cast.error.replace(/^Not valid JSON:\s*/, '') })
									: cast.error,
					);
				typed = cast.value;
			}
		}
		setIsSaving(true);
		try {
			// Editing sends the version this screen loaded: if someone changed the
			// entry since, the server answers 409 VERSION_CONFLICT instead of
			// silently overwriting their change.
			const loadedVersion = isSecret ? secretEntry.secret?.version : configEntry.entry?.version;
			const env = isNew ? targetEnv.trim() || 'all' : (environment ?? 'all');
			const envArg = env === 'all' ? undefined : env;
			if (isSecret) {
				const opts: Parameters<typeof secrets.saveSecret>[1] = { value };
				if (description) opts.description = description;
				if (!isNew && loadedVersion !== undefined) opts.ifVersion = loadedVersion;
				if (isNew) await client.setSecret(key, opts, envArg);
				else await secrets.saveSecret(key, opts);
			} else {
				const opts: Parameters<typeof configEntries.saveEntry>[1] = { value: typed };
				if (description) opts.description = description;
				// Only an explicit "Change type" may change an existing key's shape;
				// the server refuses it otherwise (409 CONFIG_TYPE_CHANGE).
				if (changingType) opts.allowTypeChange = true;
				if (!isNew && loadedVersion !== undefined) opts.ifVersion = loadedVersion;
				if (isNew) await client.setConfig(key, opts, envArg);
				else await configEntries.saveEntry(key, opts);
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

	const handleDelete = async () => {
		const message =
			environment && environment !== 'all'
				? t('config.editor.confirmDeleteIn', { key: configKey, env: environment })
				: t('config.editor.confirmDelete', { key: configKey });
		if (!window.confirm(message)) return;
		setIsDeleting(true);
		setSaveError(null);
		try {
			if (isSecret) await secrets.removeSecret(configKey);
			else await configEntries.removeEntry(configKey);
			onDeleted?.();
		} catch (err) {
			if (err instanceof FonderieApiError) setSaveError(err);
			else setInputError((err as Error).message);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleReveal = async () => {
		try {
			setRevealedValue(await revealSecret(configKey, environment));
		} catch {
			// Surfaced via useRevealSecret's error state.
		}
	};

	if (!isNew && entry.isLoading) return <p style={styles.status}>{t('common.loading')}</p>;
	if (!isNew && entry.error)
		return (
			<p style={styles.error} role="alert">
				{entry.error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>
				{isNew ? (isSecret ? t('config.editor.newSecret') : t('config.editor.newEntry')) : configKey}
			</h1>
			<p style={styles.meta}>
				{t('config.editor.environmentLabel')}{' '}
				<strong>{isNew ? targetEnv || 'all' : (environment ?? 'all')}</strong>
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
						{t('config.reveal')}
					</button>
				</div>
			)}

			<form style={styles.form} onSubmit={handleSubmit}>
				{isNew && (
					<>
						<label style={styles.label} htmlFor="config-key">
							{t('config.editor.key')}
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
				{isNew && (
					<>
						<label style={styles.label} htmlFor="config-env">
							{t('config.environment')}
						</label>
						<input
							id="config-env"
							style={styles.input}
							value={targetEnv}
							list="config-env-options"
							autoComplete="off"
							spellCheck={false}
							onChange={(event) => setTargetEnv(event.target.value)}
						/>
						<datalist id="config-env-options">
							{[...new Set(['all', ...environments])].map((e) => (
								<option key={e} value={e} />
							))}
						</datalist>
						<p style={styles.hint}>{t('config.editor.environmentHint')}</p>
					</>
				)}

				<label style={styles.label} htmlFor="config-value">
					{isSecret && !isNew ? t('config.editor.newValue') : t('config.editor.value')}
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
							placeholder={t('config.editor.valuePlaceholder')}
							spellCheck={false}
						/>
						<div style={styles.detected}>
							<span>
								{t('config.editor.detected')}{' '}
								<strong>{asText ? t('config.shape.text') : shapeLabel(inferred.value)}</strong>
							</span>
							{inferred.ambiguous && (
								<label style={styles.inline}>
									<input
										type="checkbox"
										checked={asText}
										onChange={(event) => setAsText(event.target.checked)}
									/>
									{t('config.editor.saveAsText')}
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
						{value === 'true' ? t('config.editor.on') : t('config.editor.off')}
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
					<input
						id="config-value"
						style={styles.input}
						value={value}
						onChange={(event) => setValue(event.target.value)}
					/>
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
							{t('config.editor.type')} <strong>{shapeLabel(configEntry.entry.value)}</strong>
						</span>
						<button
							type="button"
							style={styles.linkButton}
							onClick={() => {
								setChangingType(true);
								setAsText(false);
							}}
						>
							{t('config.editor.changeType')}
						</button>
					</div>
				)}
				{changingType && (
					<p style={styles.warning}>{t('config.editor.changeTypeWarning')}</p>
				)}
				{inputError && (
					<p style={styles.error} role="alert">
						{inputError}
					</p>
				)}

				<label style={styles.label} htmlFor="config-description">
					{t('config.editor.description')}
				</label>
				<input
					id="config-description"
					style={styles.input}
					value={description}
					onChange={(event) => setDescription(event.target.value)}
				/>

				{saveError && saveError.reason === 'VERSION_CONFLICT' ? (
					<p style={styles.error} role="alert">
						{t('config.editor.conflict')}{' '}
						<button
							type="button"
							style={styles.smallButton}
							onClick={() => {
								setSaveError(null);
								void entry.refresh();
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

				<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
					<button type="submit" disabled={isSaving} style={{ ...styles.button, marginTop: 0 }}>
						{isSaving ? t('common.saving') : t('common.save')}
					</button>
					{!isNew && (
						<button
							type="button"
							disabled={isDeleting}
							onClick={() => void handleDelete()}
							style={{
								...styles.smallButton,
								height: 36,
								marginLeft: 'auto',
								color: 'var(--fonderie-danger,#e00)',
								borderColor: 'color-mix(in srgb, var(--fonderie-danger,#e00) 40%, transparent)',
							}}
						>
							{isDeleting ? t('common.deleting') : t('common.delete')}
						</button>
					)}
				</div>
			</form>

			{!isNew && revisions.revisions.length > 0 && (
				<div style={styles.revisions}>
					<h2 style={styles.subtitle}>{t('config.editor.history')}</h2>
					<ul style={styles.list}>
						{revisions.revisions.map((rev) => (
							<li key={rev.version} style={styles.row}>
								<span>
									v{rev.version} — {rev.actor ?? t('config.editor.unknownActor')} —{' '}
									{formatAdminDate(rev.createdAt, locale)}
								</span>
								<button
									type="button"
									onClick={() => revisions.rollback(rev.version)}
									style={styles.smallButton}
								>
									{t('config.editor.rollBack')}
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
	detected: {
		display: 'flex',
		alignItems: 'center',
		gap: 16,
		fontSize: 13,
		color: 'var(--fonderie-text-muted,#5c5c5c)',
		marginTop: 6,
	},
	inline: { display: 'flex', alignItems: 'center', gap: 6 },
	linkButton: {
		background: 'none',
		border: 'none',
		padding: 0,
		fontSize: 13,
		color: 'var(--fonderie-link,#0b6)',
		cursor: 'pointer',
		textDecoration: 'underline',
	},
	warning: { fontSize: 13, color: 'var(--fonderie-warning,#a15c00)', marginTop: 6 },
	toggle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, padding: '6px 0' },
	container: { padding: '8px 40px 64px', maxWidth: 760, boxSizing: 'border-box' },
	title: {
		fontSize: 22,
		fontWeight: 600,
		margin: '8px 0 4px',
		letterSpacing: 'var(--fonderie-tracking-display,-0.05em)',
		lineHeight: 1.25,
	},
	hint: { fontSize: 12.5, color: 'var(--fonderie-text-muted,#5c5c5c)', margin: '4px 0 0' },
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
	revealBox: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
	revealedValue: {
		fontFamily:
			'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
		fontSize: 13,
		color: 'var(--fonderie-text,#171717)',
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
	smallButton: {
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
};
