import {
	type AdminLocale,
	type CourierAdminClient,
	type ITemplateLanguage,
	createAdminT,
	templateLanguages,
} from '@fonderie/client';
import { useTemplateCatalog } from '@fonderie/react-courier-admin';
import type { CSSProperties } from 'react';

/** Which version of which email to open. `locale` null is the default version. */
export interface ITemplateSelection {
	type: string;
	locale: string | null;
	/** A built-in email: its default version can be edited, never deleted. */
	system: boolean;
}

export interface ITemplateListScreenProps {
	client: CourierAdminClient;
	/**
	 * One row per email — built-in ones included, even when nobody saved a copy.
	 * The row opens the default version; a language chip opens that language.
	 */
	onSelectTemplate?: (template: ITemplateSelection) => void;
	/** Shows a "New template" button. Receives the locales in use, to suggest. */
	onCreateTemplate?: (context: { locales: string[] }) => void;
	/** The console's language. Default English. */
	locale?: AdminLocale | undefined;
}

export function TemplateListScreen({
	client,
	onSelectTemplate,
	onCreateTemplate,
	locale,
}: ITemplateListScreenProps) {
	const t = createAdminT(locale);
	const { catalog, isLoading, error } = useTemplateCatalog(client);
	const emails = catalog?.emails ?? [];
	const defaultLocale = catalog?.defaultLocale ?? 'en-US';

	const chipStyle = (l: ITemplateLanguage): CSSProperties => ({
		...chip,
		...(l.saved ? {} : chipBuiltIn),
		...(l.active ? {} : chipOff),
	});

	return (
		<div style={styles.container}>
			<div
				style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
			>
				<h1 style={styles.title}>{t('templates.list.title')}</h1>
				{onCreateTemplate ? (
					<button
						type="button"
						onClick={() =>
							onCreateTemplate({
								locales: [
									...new Set(
										emails.flatMap((e) =>
											templateLanguages(e, defaultLocale)
												.filter((l) => l.locale !== null)
												.map((l) => l.label),
										),
									),
								].sort(),
							})
						}
						style={styles.newButton}
					>
						{t('templates.list.newTemplate')}
					</button>
				) : null}
			</div>
			<p style={styles.hint}>{t('templates.list.hint')}</p>
			{isLoading ? (
				<p style={styles.status}>{t('templates.list.loading')}</p>
			) : error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : (
				<>
					<ul style={styles.list}>
						{emails.map((email) => {
							const languages = templateLanguages(email, defaultLocale);
							const primary = languages.find((l) => l.locale === null) ?? languages[0];
							const open = (l: ITemplateLanguage | undefined) =>
								onSelectTemplate?.({
									type: email.type,
									locale: l?.locale ?? null,
									system: email.system,
								});
							return (
								// Columns, not a flex row: the language chips line up down the
								// list whatever the email name or badge.
								<li key={email.type} style={styles.row}>
									<button type="button" onClick={() => open(primary)} style={styles.rowButton}>
										<span style={styles.type}>{email.type}</span>
										{email.system ? (
											<span style={styles.builtIn}>{t('templates.builtInBadge')}</span>
										) : (
											<span />
										)}
									</button>
									{/* Siblings of the row button: a button cannot hold buttons. */}
									{/* Each chip names its email and language for screen readers. */}
									<span style={styles.chips}>
										{languages.map((l) => (
											<button
												key={l.label}
												type="button"
												onClick={() => open(l)}
												style={chipStyle(l)}
												aria-label={t('templates.list.openLocale', {
													type: email.type,
													locale: l.label,
												})}
												title={l.active ? undefined : t('common.status.inactive')}
											>
												{l.label}
											</button>
										))}
									</span>
									<span style={primary?.active === false ? styles.inactive : styles.active}>
										<span style={styles.dot} />
										{primary?.active === false
											? t('common.status.inactive')
											: t('common.status.active')}
									</span>
								</li>
							);
						})}
					</ul>
					<p style={styles.legend}>{t('templates.list.legend')}</p>
				</>
			)}
		</div>
	);
}

// Matches @fonderie/react-admin-screens' shell look with local values: this
// package sits below the admin screens and cannot import their blocks.
const pill: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 6,
	borderRadius: 999,
	padding: '2px 9px 2px 8px',
	fontSize: 12,
	fontWeight: 600,
	lineHeight: 1.5,
	minWidth: 64,
};

const MONO =
	'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)';

// One per language the email exists in. Monospace: they are language tags.
// Solid = a version the app saved; dashed = Fonderie's built-in copy, untouched.
const chip: CSSProperties = {
	height: 24,
	boxSizing: 'border-box',
	padding: '0 8px',
	borderRadius: 6,
	border: '1px solid var(--fonderie-border,#e0e0e0)',
	background: 'var(--fonderie-surface,#fff)',
	color: 'var(--fonderie-text,#171717)',
	fontSize: 12,
	fontFamily: MONO,
	cursor: 'pointer',
};
const chipBuiltIn: CSSProperties = {
	borderStyle: 'dashed',
	background: 'transparent',
	color: 'var(--fonderie-text-muted,#5c5c5c)',
};
const chipOff: CSSProperties = { opacity: 0.5, textDecoration: 'line-through' };

const styles: Record<string, CSSProperties> = {
	container: { padding: '32px 40px 64px', maxWidth: 1160, boxSizing: 'border-box' },
	title: {
		fontSize: 22,
		fontWeight: 600,
		margin: 0,
		letterSpacing: 'var(--fonderie-tracking-display,-0.05em)',
		lineHeight: 1.25,
	},
	hint: { fontSize: 13.5, color: 'var(--fonderie-text-muted,#5c5c5c)', margin: '4px 0 24px' },
	legend: { fontSize: 12.5, color: 'var(--fonderie-text-muted,#5c5c5c)', margin: '10px 2px 0' },
	status: { padding: '24px 0', color: 'var(--fonderie-text-muted,#5c5c5c)', fontSize: 13.5 },
	error: { color: 'var(--fonderie-danger,#e00)', marginBottom: 12, fontSize: 14 },
	list: {
		listStyle: 'none',
		padding: 0,
		margin: 0,
		background: 'var(--fonderie-surface,#fff)',
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		borderRadius: 'var(--fonderie-radius-lg,8px)',
		overflow: 'hidden',
		boxShadow: 'var(--fonderie-shadow-card,0 2px 3px 0 rgba(0,0,0,.05))',
	},
	// name + badge | languages | status — fixed tracks so every column aligns.
	row: {
		display: 'grid',
		gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, 280px) 88px',
		alignItems: 'center',
		gap: 16,
		paddingRight: 16,
		borderBottom: '1px solid var(--fonderie-border-light,#f5f5f5)',
	},
	rowButton: {
		minWidth: 0,
		display: 'flex',
		alignItems: 'center',
		gap: 12,
		padding: '13px 16px',
		background: 'none',
		border: 'none',
		cursor: 'pointer',
		textAlign: 'left',
		color: 'var(--fonderie-text,#171717)',
		fontFamily: 'inherit',
	},
	type: {
		fontSize: 13,
		fontWeight: 600,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
		fontFamily: MONO,
	},
	chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
	dot: { width: 6, height: 6, borderRadius: 999, background: 'currentColor' },
	builtIn: {
		fontSize: 11,
		fontWeight: 500,
		padding: '1px 7px',
		borderRadius: 999,
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		color: 'var(--fonderie-text-muted,#5c5c5c)',
		flexShrink: 0,
	},
	newButton: {
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
		backgroundColor: 'var(--fonderie-text,#171717)',
		color: 'var(--fonderie-surface,#fff)',
		border: '1px solid var(--fonderie-text,#171717)',
	},
	active: {
		...pill,
		color: 'var(--fonderie-accent-strong,#009767)',
		background: 'color-mix(in srgb, var(--fonderie-accent-strong,#009767) 13%, transparent)',
	},
	inactive: {
		...pill,
		color: 'var(--fonderie-text-muted,#5c5c5c)',
		background: 'color-mix(in srgb, var(--fonderie-text-muted,#5c5c5c) 10%, transparent)',
	},
};
