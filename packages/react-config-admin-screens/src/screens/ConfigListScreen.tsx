import { type ConfigAdminClient, configValueType, formatConfigValue } from '@fonderie/client';
import { useConfigEntries, useRevealSecret, useSecrets } from '@fonderie/react-config-admin';
import type { CSSProperties } from 'react';
import { useState } from 'react';

export interface IConfigListScreenProps {
	client: ConfigAdminClient;
	environment?: string;
	onSelectConfig?: (key: string) => void;
	onSelectSecret?: (key: string) => void;
	/** Shows a "New entry" button; open an editor with an empty key. */
	onCreateConfig?: () => void;
	/** Shows a "New secret" button. */
	onCreateSecret?: () => void;
}

const TYPE_BADGE = { string: 'text', number: 'number', boolean: 'on/off', json: 'json' } as const;

// One line of the value for the list: long text and JSON are cut, not wrapped.
function preview(value: unknown): string {
	const s = formatConfigValue(value).replace(/\s+/g, ' ');
	return s.length > 48 ? `${s.slice(0, 47)}…` : s;
}

export function ConfigListScreen({
	client,
	environment,
	onSelectConfig,
	onSelectSecret,
	onCreateConfig,
	onCreateSecret,
}: IConfigListScreenProps) {
	const {
		entries,
		isLoading: isLoadingConfig,
		error: configError,
	} = useConfigEntries(client, environment);
	const {
		secrets,
		isLoading: isLoadingSecrets,
		error: secretsError,
	} = useSecrets(client, environment);
	const { revealSecret, isLoading: isRevealing } = useRevealSecret(client);
	const [revealed, setRevealed] = useState<Record<string, string>>({});

	const handleReveal = async (key: string) => {
		try {
			const value = await revealSecret(key, environment);
			setRevealed((prev) => ({ ...prev, [key]: value }));
		} catch {
			// Surfaced via useRevealSecret's own error state per-call; kept local here.
		}
	};

	return (
		<div style={styles.container}>
			<div style={{ ...styles.heading, marginTop: 0 }}>
				<h1 style={styles.title}>Config</h1>
				{onCreateConfig && (
					<button type="button" onClick={onCreateConfig} style={styles.newButton}>
						New entry
					</button>
				)}
			</div>
			<p style={styles.hint}>
				Feature flags and runtime settings — text, numbers, on/off or JSON. Read by the app without
				a deploy.
			</p>
			{isLoadingConfig ? (
				<p style={styles.status}>Loading…</p>
			) : configError ? (
				<p style={styles.error} role="alert">
					{configError.explanation}
				</p>
			) : entries.length === 0 ? (
				<p style={styles.empty}>
					No config entries yet.
					{onCreateConfig
						? ' Create one to toggle a feature or tune a setting without redeploying.'
						: ''}
				</p>
			) : (
				<ul style={styles.list}>
					{entries.map((entry) => (
						<li key={`${entry.key}:${entry.environment}`} style={styles.row}>
							<button
								type="button"
								onClick={() => onSelectConfig?.(entry.key)}
								style={styles.rowButton}
							>
								<span style={styles.key}>{entry.key}</span>
								<span style={styles.valuePreview}>{preview(entry.value)}</span>
								<span style={styles.badge}>{TYPE_BADGE[configValueType(entry.value)]}</span>
								<span style={styles.env}>{entry.environment}</span>
							</button>
						</li>
					))}
				</ul>
			)}

			<div style={styles.heading}>
				<h2 style={styles.title}>Secrets</h2>
				{onCreateSecret && (
					<button type="button" onClick={onCreateSecret} style={styles.newButton}>
						New secret
					</button>
				)}
			</div>
			<p style={styles.hint}>Encrypted at rest; values are hidden until revealed.</p>
			{isLoadingSecrets ? (
				<p style={styles.status}>Loading…</p>
			) : secretsError ? (
				<p style={styles.error} role="alert">
					{secretsError.explanation}
				</p>
			) : secrets.length === 0 ? (
				<p style={styles.empty}>No secrets yet.</p>
			) : (
				<ul style={styles.list}>
					{secrets.map((secret) => (
						<li key={`${secret.key}:${secret.environment}`} style={styles.row}>
							<button
								type="button"
								onClick={() => onSelectSecret?.(secret.key)}
								style={styles.rowButton}
							>
								<span style={styles.key}>{secret.key}</span>
								<span style={styles.env}>{secret.environment}</span>
							</button>
							<span style={styles.revealed}>{revealed[secret.key] ?? '••••••••'}</span>
							<button
								type="button"
								disabled={isRevealing}
								onClick={() => handleReveal(secret.key)}
								style={styles.revealButton}
							>
								Reveal
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

// Matches @fonderie/react-admin-screens' shell look (cards, pills, 32px
// page padding) with local values: this package sits BELOW the admin screens
// in the dependency graph, so it cannot import their building blocks.
const card: CSSProperties = {
	listStyle: 'none',
	padding: 0,
	margin: 0,
	background: 'var(--fonderie-surface,#fff)',
	border: '1px solid var(--fonderie-border,#e0e0e0)',
	borderRadius: 'var(--fonderie-radius-lg,8px)',
	overflow: 'hidden',
	boxShadow: 'var(--fonderie-shadow-card,0 2px 3px 0 rgba(0,0,0,.05))',
};
const control: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	height: 32,
	boxSizing: 'border-box',
	borderRadius: 6,
	padding: '0 12px',
	fontSize: 13,
	fontWeight: 500,
	fontFamily: 'inherit',
	cursor: 'pointer',
	whiteSpace: 'nowrap',
};

const styles: Record<string, CSSProperties> = {
	container: { padding: '32px 40px 64px', maxWidth: 1160, boxSizing: 'border-box' },
	heading: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 16,
		marginTop: 36,
	},
	title: {
		fontSize: 22,
		fontWeight: 600,
		margin: 0,
		letterSpacing: 'var(--fonderie-tracking-display,-0.05em)',
		lineHeight: 1.25,
	},
	hint: { fontSize: 13.5, color: 'var(--fonderie-text-muted,#5c5c5c)', margin: '4px 0 16px' },
	empty: {
		fontSize: 13.5,
		color: 'var(--fonderie-text-muted,#5c5c5c)',
		padding: '28px 24px',
		textAlign: 'center',
		border: '1px dashed var(--fonderie-border,#e0e0e0)',
		borderRadius: 'var(--fonderie-radius-lg,8px)',
		background: 'var(--fonderie-surface,#fff)',
		margin: 0,
	},
	newButton: {
		...control,
		backgroundColor: 'var(--fonderie-text,#171717)',
		color: 'var(--fonderie-surface,#fff)',
		border: '1px solid var(--fonderie-text,#171717)',
	},
	valuePreview: {
		flex: 1,
		margin: '0 12px',
		fontSize: 12.5,
		color: 'var(--fonderie-text-muted,#5c5c5c)',
		fontFamily:
			'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
	badge: {
		fontSize: 11.5,
		fontWeight: 500,
		padding: '1px 8px',
		borderRadius: 999,
		background: 'var(--fonderie-surface-alt,#fafafa)',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		color: 'var(--fonderie-text-muted,#5c5c5c)',
		marginRight: 12,
		whiteSpace: 'nowrap',
	},
	status: { padding: '24px 0', color: 'var(--fonderie-text-muted,#5c5c5c)', fontSize: 13.5 },
	error: {
		color: 'var(--fonderie-danger,#e00)',
		background: 'color-mix(in srgb, var(--fonderie-danger,#e00) 8%, transparent)',
		borderRadius: 'var(--fonderie-radius-lg,8px)',
		padding: '10px 14px',
		marginBottom: 12,
		fontSize: 13.5,
	},
	list: card,
	row: {
		display: 'flex',
		alignItems: 'center',
		gap: 12,
		borderBottom: '1px solid var(--fonderie-border-light,#f5f5f5)',
		padding: '0 16px 0 0',
	},
	rowButton: {
		flex: 1,
		minWidth: 0,
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		background: 'none',
		border: 'none',
		cursor: 'pointer',
		textAlign: 'left',
		padding: '13px 0 13px 16px',
		color: 'var(--fonderie-text,#171717)',
		fontFamily: 'inherit',
	},
	key: {
		fontSize: 13,
		fontWeight: 600,
		fontFamily:
			'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	},
	env: {
		fontSize: 12.5,
		color: 'var(--fonderie-text-muted,#5c5c5c)',
		minWidth: 32,
		textAlign: 'right',
	},
	revealed: {
		fontSize: 12.5,
		fontFamily:
			'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
		color: 'var(--fonderie-text,#171717)',
		minWidth: 100,
	},
	revealButton: {
		...control,
		height: 28,
		padding: '0 10px',
		fontSize: 12.5,
		background: 'var(--fonderie-surface,#fff)',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		color: 'var(--fonderie-text,#171717)',
	},
};
