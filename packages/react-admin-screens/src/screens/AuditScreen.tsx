import {
	type AdminLocale,
	type AuditAdminClient,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { useAdminAudit } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';
import { Empty, Icon, PageHeader } from '../ui';

export interface IAuditScreenProps {
	client: AuditAdminClient;
	pageSize?: number;
	locale?: AdminLocale | undefined;
}

// What happened — every workspace unless one is named. The chain's integrity
// verdict is on the Doctor page (events.integrity).
export function AuditScreen({ client, pageSize = 50, locale }: IAuditScreenProps) {
	const t = createAdminT(locale);
	const [draft, setDraft] = useState({ workspaceId: '', type: '', actorId: '', from: '', to: '' });
	const [filter, setFilter] = useState<{
		workspaceId?: string;
		type?: string;
		actorId?: string;
		from?: Date;
		to?: Date;
	}>({});
	const { events, hasMore, isLoading, error, refresh, loadMore } = useAdminAudit(client, {
		...filter,
		limit: pageSize,
	});
	const field = (key: keyof typeof draft, placeholder: string) => (
		<input
			value={draft[key]}
			onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
			placeholder={placeholder}
			style={styles.input}
			aria-label={placeholder}
		/>
	);
	return (
		<div style={styles.container}>
			<PageHeader title={t('audit.title')} lead={t('audit.lead')} />
			<form
				style={styles.toolbar}
				onSubmit={(e) => {
					e.preventDefault();
					setFilter({
						...(draft.workspaceId.trim() ? { workspaceId: draft.workspaceId.trim() } : {}),
						...(draft.type.trim() ? { type: draft.type.trim() } : {}),
						...(draft.actorId.trim() ? { actorId: draft.actorId.trim() } : {}),
						// Dates are whole days in the operator's time zone: "to" includes that day.
						...(draft.from ? { from: new Date(`${draft.from}T00:00:00`) } : {}),
						...(draft.to ? { to: new Date(`${draft.to}T23:59:59.999`) } : {}),
					});
				}}
			>
				{field('workspaceId', t('audit.workspacePlaceholder'))}
				{field('type', t('audit.typePlaceholder'))}
				{field('actorId', t('audit.actorPlaceholder'))}
				<input
					type="date"
					value={draft.from}
					onChange={(e) => setDraft({ ...draft, from: e.target.value })}
					style={styles.input}
					aria-label={t('audit.fromLabel')}
					title={t('audit.fromTitle')}
				/>
				<input
					type="date"
					value={draft.to}
					onChange={(e) => setDraft({ ...draft, to: e.target.value })}
					style={styles.input}
					aria-label={t('audit.toLabel')}
					title={t('audit.toTitle')}
				/>
				<button type="submit" style={styles.buttonPrimary} disabled={isLoading}>
					<Icon name="search" size={14} />
					{t('common.filter')}
				</button>
				<button
					type="button"
					style={styles.button}
					onClick={() => void refresh()}
					disabled={isLoading}
				>
					{t('common.refresh')}
				</button>
			</form>
			{error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : null}
			{events.length === 0 && !isLoading ? (
				<Empty icon="audit" title={t('audit.empty')} />
			) : (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>{t('audit.col.when')}</th>
							<th style={styles.th}>{t('audit.col.type')}</th>
							<th style={styles.th}>{t('audit.col.workspace')}</th>
							<th style={styles.th}>{t('audit.col.actor')}</th>
							<th style={styles.th}>{t('audit.col.request')}</th>
						</tr>
					</thead>
					<tbody>
						{events.map((e) => (
							<tr key={e.id}>
								<td style={{ ...styles.td, ...styles.muted }}>
									{formatAdminDate(e.createdAt, locale)}
								</td>
								<td style={{ ...styles.td, ...styles.mono }}>{e.type}</td>
								<td style={{ ...styles.td, ...styles.mono }}>
									{String(e.payload['workspaceId'] ?? '—')}
								</td>
								<td style={{ ...styles.td, ...styles.mono }}>{e.actorId ?? '—'}</td>
								<td style={{ ...styles.td, ...styles.muted }}>{e.requestId ?? ''}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			{isLoading ? <p style={styles.status}>{t('common.loading')}</p> : null}
			{hasMore && !isLoading ? (
				<button
					type="button"
					style={{ ...styles.button, marginTop: 8 }}
					onClick={() => void loadMore()}
				>
					{t('common.loadMore')}
				</button>
			) : null}
		</div>
	);
}
