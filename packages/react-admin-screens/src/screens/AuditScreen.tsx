import type { AuditAdminClient } from '@fonderie/client';
import { useAdminAudit } from '@fonderie/react-admin';
import { useState } from 'react';
import { styles } from '../styles';
import { Empty, Icon, PageHeader } from '../ui';

export interface IAuditScreenProps {
	client: AuditAdminClient;
	pageSize?: number;
}

// What happened — every workspace unless one is named. The chain's integrity
// verdict is on the Doctor page (events.integrity).
export function AuditScreen({ client, pageSize = 50 }: IAuditScreenProps) {
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
			<PageHeader
				title="Audit"
				lead="What happened, across every workspace unless you name one. The chain's integrity verdict is on the Doctor page."
			/>
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
				{field('workspaceId', 'workspace id (all if empty)')}
				{field('type', 'event type')}
				{field('actorId', 'actor id')}
				<input
					type="date"
					value={draft.from}
					onChange={(e) => setDraft({ ...draft, from: e.target.value })}
					style={styles.input}
					aria-label="From date"
					title="From (inclusive)"
				/>
				<input
					type="date"
					value={draft.to}
					onChange={(e) => setDraft({ ...draft, to: e.target.value })}
					style={styles.input}
					aria-label="To date"
					title="To (inclusive)"
				/>
				<button type="submit" style={styles.buttonPrimary} disabled={isLoading}>
					<Icon name="search" size={14} />
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
				<Empty icon="audit" title="Nothing recorded for this filter" />
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
