import type { CourierAdminClient, ITemplateEntry } from '@fonderie/client';
import { useTemplates } from '@fonderie/react-courier-admin';
import type { CSSProperties } from 'react';

export interface ITemplateListScreenProps {
	client: CourierAdminClient;
	onSelectTemplate?: (template: ITemplateEntry) => void;
}

export function TemplateListScreen({ client, onSelectTemplate }: ITemplateListScreenProps) {
	const { templates, isLoading, error } = useTemplates(client);

	if (isLoading) return <p style={styles.status}>Loading templates…</p>;
	if (error)
		return (
			<p style={styles.error} role="alert">
				{error.explanation}
			</p>
		);

	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Templates</h1>
			<ul style={styles.list}>
				{templates.map((template) => (
					<li key={`${template.type}:${template.locale ?? 'base'}`} style={styles.row}>
						<button
							type="button"
							onClick={() => onSelectTemplate?.(template)}
							style={styles.rowButton}
						>
							<span style={styles.type}>{template.type}</span>
							<span style={styles.locale}>{template.locale ?? 'base'}</span>
							<span style={template.active ? styles.active : styles.inactive}>
								{template.active ? 'Active' : 'Inactive'}
							</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}

const styles: Record<string, CSSProperties> = {
	container: { padding: 24, maxWidth: 640 },
	title: { fontSize: 24, fontWeight: 700, marginBottom: 16 },
	status: { padding: 24, textAlign: 'center', color: 'var(--fonderie-text-muted,#5c5c5c)' },
	error: { color: 'var(--fonderie-danger,#e00)', marginBottom: 12, fontSize: 14 },
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: { borderBottom: '1px solid var(--fonderie-border-light,#f5f5f5)' },
	rowButton: {
		width: '100%',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: '12px 0',
		background: 'none',
		border: 'none',
		cursor: 'pointer',
		textAlign: 'left',
	},
	type: { fontSize: 14, fontWeight: 600, flex: 1 },
	locale: { fontSize: 13, color: 'var(--fonderie-text-muted,#5c5c5c)', marginRight: 16 },
	active: { fontSize: 12, color: 'var(--fonderie-accent-strong,#009767)' },
	inactive: { fontSize: 12, color: 'var(--fonderie-text-muted,#5c5c5c)' },
};
