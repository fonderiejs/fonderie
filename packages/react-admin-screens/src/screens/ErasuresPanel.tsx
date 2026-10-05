import {
	type AdminLocale,
	type AuthAdminClient,
	type IAdminErasureDTO,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { useAdminErasures } from '@fonderie/react-admin';
import { styles } from '../styles';
import { Empty, Pill } from '../ui';

export interface IErasuresPanelProps {
	client: AuthAdminClient;
	// Given ⇒ only the receipt for the account that used this address.
	email?: string | undefined;
	pageSize?: number;
	locale?: AdminLocale | undefined;
}

// The evidence that an account was erased: when, by whom, and what each brick
// did. A receipt names no one — the operator finds one by the address the
// person used, which the server hashes with the same key.
export function ErasuresPanel({ client, email, pageSize = 50, locale }: IErasuresPanelProps) {
	const t = createAdminT(locale);
	const list = useAdminErasures(client, { limit: pageSize, ...(email ? { email } : {}) });

	const download = async (format: 'json' | 'csv') => {
		const all = await list.exportAll();
		if (!all) return;
		if (all.truncated) window.alert(t('users.erasures.truncated', { n: all.erasures.length }));
		const body = format === 'json' ? JSON.stringify(all, null, 2) : toCsv(all.erasures);
		const url = URL.createObjectURL(
			new Blob([body], { type: format === 'json' ? 'application/json' : 'text/csv' }),
		);
		const a = document.createElement('a');
		a.href = url;
		a.download = `erasure-receipts-${all.generatedAt.slice(0, 10)}.${format}`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<>
			<p style={styles.muted}>{t('users.erasures.lead')}</p>
			<div style={{ ...styles.toolbar, marginTop: 8 }}>
				<button type="button" style={styles.button} onClick={() => void download('csv')}>
					{t('users.erasures.exportCsv')}
				</button>
				<button type="button" style={styles.button} onClick={() => void download('json')}>
					{t('users.erasures.exportJson')}
				</button>
			</div>
			{list.error ? (
				<p style={styles.error} role="alert">
					{list.error.explanation}
				</p>
			) : null}
			{list.erasures.length === 0 && !list.isLoading ? (
				email ? (
					<p style={styles.muted}>{t('users.erasures.noneForAddress')}</p>
				) : (
					<Empty icon="users" title={t('users.erasures.emptyTitle')}>
						{t('users.erasures.emptyBody')}
					</Empty>
				)
			) : (
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.th}>{t('users.erasures.colErased')}</th>
							<th style={styles.th}>{t('users.erasures.colRequested')}</th>
							<th style={styles.th}>{t('users.erasures.colBy')}</th>
							<th style={styles.th}>{t('users.erasures.colBricks')}</th>
							<th style={styles.th}>{t('users.erasures.colUser')}</th>
						</tr>
					</thead>
					<tbody>
						{list.erasures.map((e) => (
							<tr key={e.id}>
								<td style={styles.td}>{formatAdminDate(e.erasedAt, locale)}</td>
								<td style={styles.td}>
									{e.requestedAt ? formatAdminDate(e.requestedAt, locale, 'date') : '—'}
								</td>
								<td style={styles.td}>
									<Pill tone={e.initiatedBy === 'operator' ? 'warn' : 'neutral'}>
										{e.initiatedBy === 'operator'
											? t('users.erasures.byOperator')
											: t('users.erasures.bySchedule')}
									</Pill>
								</td>
								<td style={styles.td}>
									{e.outcomes.map((o) => (
										<span key={o.brick} title={o.kept ?? ''} style={{ marginRight: 8 }}>
											{o.brick} <span style={styles.muted}>{o.erased}</span>
										</span>
									))}
								</td>
								<td style={{ ...styles.td, ...styles.mono }}>{e.userId}</td>
							</tr>
						))}
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
		</>
	);
}

const cell = (v: string | number | null) => {
	const s = v === null ? '' : String(v);
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function toCsv(rows: IAdminErasureDTO[]): string {
	const head = 'id,user_id,email_hash,phone_hash,requested_at,reminded_at,erased_at,initiated_by,outcomes';
	return [
		head,
		...rows.map((r) =>
			[
				r.id,
				r.userId,
				r.emailHash,
				r.phoneHash,
				r.requestedAt,
				r.remindedAt,
				r.erasedAt,
				r.initiatedBy,
				JSON.stringify(r.outcomes),
			]
				.map(cell)
				.join(','),
		),
	].join('\n');
}
