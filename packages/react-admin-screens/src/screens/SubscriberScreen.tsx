import type { BillingAdminClient, SubscriberType } from '@fonderie/client';
import { useAdminSubscribers } from '@fonderie/react-admin';
import { useState } from 'react';
import { periodEnd, statusTone } from '../billing';
import { styles } from '../styles';
import { Empty, Icon, PageHeader, Pill, RefreshButton } from '../ui';
import { SubscriberBilling } from './SubscriberBilling';

export interface ISubscriberScreenProps {
	client: BillingAdminClient;
	pageSize?: number;
	/**
	 * A user subscriber opens on the Users page, where their plan and credits
	 * live beside their account. Omit to open everything here.
	 */
	onOpenUser?: (userId: string) => void;
}

const FILTERS: Array<{ label: string; match: (status: string) => boolean }> = [
	{ label: 'All', match: () => true },
	{ label: 'Active', match: (s) => s === 'active' },
	{ label: 'Trialing', match: (s) => s === 'trialing' },
	{ label: 'Past due', match: (s) => s === 'past_due' || s === 'unpaid' },
	{ label: 'Canceled', match: (s) => s === 'canceled' },
];

// Who pays, and who is behind. A money list: plans and statuses across users
// and workspaces. A user's own billing (plan, credits, grants) is on their
// page under Users; free users have no subscription and appear only there.
export function SubscriberScreen({ client, pageSize = 50, onOpenUser }: ISubscriberScreenProps) {
	const list = useAdminSubscribers(client, { limit: pageSize });
	const [filter, setFilter] = useState('All');
	const [open, setOpen] = useState<{ type: SubscriberType; id: string } | null>(null);
	const [type, setType] = useState<SubscriberType>('workspace');
	const [idInput, setIdInput] = useState('');

	if (open) {
		return (
			<div style={styles.container}>
				<PageHeader
					title={`${open.type}/${open.id}`}
					lead="Plan, credits and what moved."
					actions={
						<button type="button" style={styles.buttonGhost} onClick={() => setOpen(null)}>
							<Icon name="back" size={14} />
							All subscriptions
						</button>
					}
				/>
				<SubscriberBilling client={client} subscriber={open} />
			</div>
		);
	}

	const match = FILTERS.find((f) => f.label === filter)?.match ?? (() => true);
	const rows = list.subscriptions.filter((s) => match(s.status));
	const openRow = (t: SubscriberType, id: string) =>
		t === 'user' && onOpenUser ? onOpenUser(id) : setOpen({ type: t, id });

	return (
		<div style={styles.container}>
			<PageHeader
				title="Subscriptions"
				lead="Who pays, and who is behind. A user's plan and credits are also on their page under Users — free users appear only there."
				actions={<RefreshButton onClick={() => void list.refresh()} busy={list.isLoading} />}
			/>
			<div style={{ ...styles.toolbar, justifyContent: 'space-between' }}>
				<fieldset
					style={{
						display: 'flex',
						gap: 6,
						flexWrap: 'wrap',
						border: 'none',
						margin: 0,
						padding: 0,
						minWidth: 0,
					}}
					aria-label="Filter by status"
				>
					{FILTERS.map((f) => {
						const n = list.subscriptions.filter((s) => f.match(s.status)).length;
						const on = filter === f.label;
						return (
							<button
								key={f.label}
								type="button"
								aria-pressed={on}
								onClick={() => setFilter(f.label)}
								style={{ ...(on ? styles.buttonPrimary : styles.button), height: 28 }}
							>
								{f.label}
								<span style={{ opacity: 0.7 }}>{n}</span>
							</button>
						);
					})}
				</fieldset>
				<form
					style={{ display: 'flex', gap: 6 }}
					onSubmit={(e) => {
						e.preventDefault();
						if (idInput.trim()) openRow(type, idInput.trim());
					}}
				>
					<select
						value={type}
						onChange={(e) => setType(e.target.value as SubscriberType)}
						style={styles.input}
						aria-label="Type"
					>
						<option value="workspace">workspace</option>
						<option value="user">user</option>
					</select>
					<input
						value={idInput}
						onChange={(e) => setIdInput(e.target.value)}
						placeholder="subscriber id"
						style={{ ...styles.input, width: 220 }}
						aria-label="Subscriber id"
					/>
					<button type="submit" style={styles.button} disabled={!idInput.trim()}>
						<Icon name="search" size={14} />
						Open
					</button>
				</form>
			</div>
			{list.error ? (
				<p style={styles.error} role="alert">
					{list.error.explanation}
				</p>
			) : null}
			{rows.length === 0 && !list.isLoading ? (
				<Empty
					icon="subscriber"
					title={
						filter === 'All' ? 'No subscriptions yet' : `No ${filter.toLowerCase()} subscriptions`
					}
				>
					Subscriptions appear here once someone checks out.
				</Empty>
			) : (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>Subscriber</th>
							<th style={styles.th}>Plan</th>
							<th style={styles.th}>Status</th>
							<th style={styles.th}>Renews / ends</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((s) => {
							const end = periodEnd(s);
							return (
								<tr key={s.id}>
									<td style={styles.td}>
										<button
											type="button"
											style={{ ...styles.link, ...styles.mono }}
											onClick={() => openRow(s.subscriberType, s.subscriberId)}
										>
											{s.subscriberType}/{s.subscriberId}
										</button>
									</td>
									<td style={styles.td}>
										<strong>{s.plan}</strong> <span style={styles.muted}>· {s.interval}</span>
									</td>
									<td style={styles.td}>
										<Pill tone={statusTone(s.status)}>{s.status}</Pill>
										{s.cancelAtPeriodEnd && s.status !== 'canceled' ? (
											<>
												{' '}
												<Pill tone="warn" dot={false}>
													cancels
												</Pill>
											</>
										) : null}
									</td>
									<td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
										{end ? (
											<>
												<span style={styles.muted}>{end.label}</span> {end.date}
											</>
										) : (
											<span style={styles.muted}>—</span>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
			{list.isLoading ? <p style={styles.status}>Loading…</p> : null}
			{list.hasMore && !list.isLoading ? (
				<button
					type="button"
					style={{ ...styles.button, marginTop: 8 }}
					onClick={() => void list.loadMore()}
				>
					Load more
				</button>
			) : null}
		</div>
	);
}
