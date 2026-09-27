import {
	type AdminLocale,
	type BillingAdminClient,
	type SubscriberType,
	createAdminT,
} from '@fonderie/client';
import { useAdminSubscribers } from '@fonderie/react-admin';
import { useState } from 'react';
import { intervalLabel, periodEnd, statusLabel, statusTone } from '../billing';
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
	locale?: AdminLocale | undefined;
}

type FilterId = 'all' | 'active' | 'trialing' | 'pastDue' | 'canceled';
const FILTERS: Array<{ id: FilterId; match: (status: string) => boolean }> = [
	{ id: 'all', match: () => true },
	{ id: 'active', match: (s) => s === 'active' },
	{ id: 'trialing', match: (s) => s === 'trialing' },
	{ id: 'pastDue', match: (s) => s === 'past_due' || s === 'unpaid' },
	{ id: 'canceled', match: (s) => s === 'canceled' },
];

// Who pays, and who is behind. A money list: plans and statuses across users
// and workspaces. A user's own billing (plan, credits, grants) is on their
// page under Users; free users have no subscription and appear only there.
export function SubscriberScreen({
	client,
	pageSize = 50,
	onOpenUser,
	locale,
}: ISubscriberScreenProps) {
	const t = createAdminT(locale);
	const list = useAdminSubscribers(client, { limit: pageSize });
	const [filter, setFilter] = useState<FilterId>('all');
	const [open, setOpen] = useState<{ type: SubscriberType; id: string } | null>(null);
	const [type, setType] = useState<SubscriberType>('workspace');
	const [idInput, setIdInput] = useState('');

	if (open) {
		return (
			<div style={styles.container}>
				<PageHeader
					title={`${open.type}/${open.id}`}
					lead={t('billing.subscriptions.detailLead')}
					actions={
						<button type="button" style={styles.buttonGhost} onClick={() => setOpen(null)}>
							<Icon name="back" size={14} />
							{t('billing.subscriptions.back')}
						</button>
					}
				/>
				<SubscriberBilling client={client} subscriber={open} locale={locale} />
			</div>
		);
	}

	const match = FILTERS.find((f) => f.id === filter)?.match ?? (() => true);
	const rows = list.subscriptions.filter((s) => match(s.status));
	const openRow = (t: SubscriberType, id: string) =>
		t === 'user' && onOpenUser ? onOpenUser(id) : setOpen({ type: t, id });

	return (
		<div style={styles.container}>
			<PageHeader
				title={t('billing.subscriptions.title')}
				lead={t('billing.subscriptions.lead')}
				actions={
					<RefreshButton
						onClick={() => void list.refresh()}
						busy={list.isLoading}
						label={t('common.refresh')}
					/>
				}
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
					aria-label={t('billing.subscriptions.filterLabel')}
				>
					{FILTERS.map((f) => {
						const n = list.subscriptions.filter((s) => f.match(s.status)).length;
						const on = filter === f.id;
						return (
							<button
								key={f.id}
								type="button"
								aria-pressed={on}
								onClick={() => setFilter(f.id)}
								style={{ ...(on ? styles.buttonPrimary : styles.button), height: 28 }}
							>
								{t(`billing.subscriptions.filter.${f.id}`)}
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
						aria-label={t('billing.subscriptions.typeLabel')}
					>
						<option value="workspace">{t('billing.subscriptions.typeWorkspace')}</option>
						<option value="user">{t('billing.subscriptions.typeUser')}</option>
					</select>
					<input
						value={idInput}
						onChange={(e) => setIdInput(e.target.value)}
						placeholder={t('billing.subscriptions.idPlaceholder')}
						style={{ ...styles.input, width: 220 }}
						aria-label={t('billing.subscriptions.idLabel')}
					/>
					<button type="submit" style={styles.button} disabled={!idInput.trim()}>
						<Icon name="search" size={14} />
						{t('common.open')}
					</button>
				</form>
			</div>
			{list.error ? (
				<p style={styles.error} role="alert">
					{list.error.explanation}
				</p>
			) : null}
			{rows.length === 0 && !list.isLoading ? (
				<Empty icon="subscriber" title={t(`billing.subscriptions.empty.${filter}`)}>
					{t('billing.subscriptions.emptyHint')}
				</Empty>
			) : (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>{t('billing.subscriptions.col.subscriber')}</th>
							<th style={styles.th}>{t('billing.subscriptions.col.plan')}</th>
							<th style={styles.th}>{t('billing.subscriptions.col.status')}</th>
							<th style={styles.th}>{t('billing.subscriptions.col.renewsEnds')}</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((s) => {
							const end = periodEnd(s, locale);
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
										<strong>{s.plan}</strong>{' '}
										<span style={styles.muted}>· {intervalLabel(t, s.interval)}</span>
									</td>
									<td style={styles.td}>
										<Pill tone={statusTone(s.status)}>{statusLabel(t, s.status)}</Pill>
										{s.cancelAtPeriodEnd && s.status !== 'canceled' ? (
											<>
												{' '}
												<Pill tone="warn" dot={false}>
													{t('billing.subscriptions.cancels')}
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
			{list.isLoading ? <p style={styles.status}>{t('common.loading')}</p> : null}
			{list.hasMore && !list.isLoading ? (
				<button
					type="button"
					style={{ ...styles.button, marginTop: 8 }}
					onClick={() => void list.loadMore()}
				>
					{t('common.loadMore')}
				</button>
			) : null}
		</div>
	);
}
