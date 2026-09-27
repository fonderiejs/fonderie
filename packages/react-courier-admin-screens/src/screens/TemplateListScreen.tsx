import {
	type AdminLocale,
	type CourierAdminClient,
	type ITemplateEntry,
	createAdminT,
	groupTemplatesByType,
} from '@fonderie/client';
import { useTemplates } from '@fonderie/react-courier-admin';
import type { CSSProperties } from 'react';

export interface ITemplateListScreenProps {
	client: CourierAdminClient;
	/**
	 * Receives the whole row — type AND locale, and whether it is built-in. The
	 * list shows one row per email: clicking it opens the default locale, a
	 * locale chip opens that locale.
	 */
	onSelectTemplate?: (template: ITemplateEntry) => void;
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
	const { templates, isLoading, error } = useTemplates(client);
	const groups = groupTemplatesByType(templates);

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
									...new Set(templates.map((row) => row.locale).filter((l): l is string => !!l)),
								],
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
				<ul style={styles.list}>
					{groups.map((group) => (
						<li key={group.type} style={styles.row}>
							<button
								type="button"
								onClick={() => onSelectTemplate?.(group.primary)}
								style={styles.rowButton}
							>
								<span style={styles.type}>{group.type}</span>
								{group.system ? (
									<span style={styles.builtIn}>{t('templates.builtInBadge')}</span>
								) : null}
								<span style={group.primary.active ? styles.active : styles.inactive}>
									<span style={styles.dot} />
									{group.primary.active ? t('common.status.active') : t('common.status.inactive')}
								</span>
							</button>
							{/* Siblings of the row button, not inside it: a button cannot hold buttons. */}
							<span style={styles.chips}>
								{group.entries.map((entry) => {
									const name = entry.locale ?? t('templates.defaultChip');
									return (
										<button
											key={entry.locale ?? ''}
											type="button"
											onClick={() => onSelectTemplate?.(entry)}
											style={entry.active ? styles.chip : styles.chipInactive}
											aria-label={t('templates.list.openLocale', { type: group.type, locale: name })}
											title={entry.active ? undefined : t('common.status.inactive')}
										>
											{name}
										</button>
									);
								})}
							</span>
						</li>
					))}
				</ul>
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

// One per locale the email exists in. Monospace: they are language tags.
const chip: CSSProperties = {
	height: 24,
	boxSizing: 'border-box',
	padding: '0 8px',
	borderRadius: 6,
	border: '1px solid var(--fonderie-border,#e0e0e0)',
	background: 'var(--fonderie-surface,#fff)',
	color: 'var(--fonderie-text,#171717)',
	fontSize: 12,
	fontFamily:
		'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	cursor: 'pointer',
};

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
	row: {
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		paddingRight: 16,
		borderBottom: '1px solid var(--fonderie-border-light,#f5f5f5)',
	},
	rowButton: {
		flex: 1,
		minWidth: 0,
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: 16,
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
		flex: 1,
		fontFamily:
			'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	},
	chips: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 },
	chip,
	chipInactive: { ...chip, opacity: 0.5, textDecoration: 'line-through' },
	dot: { width: 6, height: 6, borderRadius: 999, background: 'currentColor' },
	builtIn: {
		fontSize: 11,
		fontWeight: 500,
		padding: '1px 7px',
		borderRadius: 999,
		border: '1px solid var(--fonderie-border,#e0e0e0)',
		color: 'var(--fonderie-text-muted,#5c5c5c)',
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
