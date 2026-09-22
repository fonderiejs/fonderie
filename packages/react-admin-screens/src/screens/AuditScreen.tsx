import type { AuditAdminClient } from '@fonderie/client';
import { useAdminAudit } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';

export interface IAuditScreenProps {
	client: AuditAdminClient;
	pageSize?: number;
}

// What happened — every workspace unless one is named. The chain's integrity
// verdict is on the Doctor page (events.integrity).
export function AuditScreen({ client, pageSize = 50 }: IAuditScreenProps) {
	const [draft, setDraft] = useState({ workspaceId: '', type: '', actorId: '' });
	const [filter, setFilter] = useState<{ workspaceId?: string; type?: string; actorId?: string }>(
		{},
	);
	const { events, hasMore, isLoading, error, refresh, loadMore } = useAdminAudit(client, {
		...filter,
		limit: pageSize,
	});
	const field = (key: keyof typeof draft, placeholder: string) => (
		<input
			value={draft[key]}
			onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
			placeholder={placeholder}
			style={{ ...styles.button, cursor: 'text' }}
			aria-label={placeholder}
		/>
	);
	return (
		<div style={styles.container}>
			<h1 style={styles.title}>Audit</h1>
			<form
				style={styles.toolbar}
				onSubmit={(e) => {
					e.preventDefault();
					setFilter({
						...(draft.workspaceId.trim() ? { workspaceId: draft.workspaceId.trim() } : {}),
						...(draft.type.trim() ? { type: draft.type.trim() } : {}),
						...(draft.actorId.trim() ? { actorId: draft.actorId.trim() } : {}),
					});
				}}
			>
				{field('workspaceId', 'workspace id (all if empty)')}
				{field('type', 'event type')}
				{field('actorId', 'actor id')}
				<button type="submit" style={styles.button} disabled={isLoading}>
					Filter
				</button>
				<button
					type="button"
					style={styles.button}
					onClick={() => void refresh()}
					disabled={isLoading}
				>
					Refresh
				</button>
			</form>
			{error ? (
				<p style={styles.error} role="alert">
					{error.explanation}
				</p>
			) : null}
			{events.length === 0 && !isLoading ? (
				<p style={styles.muted}>Nothing recorded for this filter.</p>
			) : (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>When</th>
							<th style={styles.th}>Type</th>
							<th style={styles.th}>Workspace</th>
							<th style={styles.th}>Actor</th>
							<th style={styles.th}>Request</th>
						</tr>
					</thead>
					<tbody>
						{events.map((e) => (
							<tr key={e.id}>
								<td style={{ ...styles.td, ...styles.muted }}>
									{new Date(e.createdAt).toLocaleString()}
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
			{isLoading ? <p style={styles.status}>Loading…</p> : null}
			{hasMore && !isLoading ? (
				<button
					type="button"
					style={{ ...styles.button, marginTop: 8 }}
					onClick={() => void loadMore()}
				>
					Load more
				</button>
			) : null}
		</div>
	);
}
