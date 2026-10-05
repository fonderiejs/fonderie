import { createHmac } from 'node:crypto';

import { COURIER_FORMAT_KEY } from '@fonderie/core';
import type { ICourierMessage } from '@fonderie/core';
import { NOTIFICATION_EVENT } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';

import { EVENT_KEYS, MESSAGE_KEYS, deletionGracePeriodDays } from '../config';
import type { IAccountEraser, IAuthConfig, IErasureSubject } from '../config';

// The account-deletion scheduler (docs/ACCOUNT-DELETION-DESIGN.md, Phase 3).
// Run it from a cron (daily is plenty) — every pass is idempotent:
//
//   1. REMIND, once, `reminderDaysBefore` (7) days before the deletion date —
//      only if the person has not tried to sign in since asking (a sign-in
//      attempt is how they keep it; whoever tried already knows), on the
//      channel they chose. Claimed atomically: two schedulers never send twice.
//   2. PURGE each account whose date has come, one at a time under a row lock
//      (SKIP LOCKED — parallel schedulers share the work): every brick's eraser
//      runs in-process FIRST; if any fails, the account stays archived and the
//      next pass retries — nothing is half-erased. Then the row is deleted
//      (auth's own tables cascade), an erasure receipt is written (no personal
//      data: keyed hashes only) and `fonderie.user.purged` is announced
//      (billing deletes the payment provider's customer).

type ScheduleConfig = Pick<IAuthConfig, 'jwtSecret' | 'accountDeletion'>;

type Bus = { emit(type: string, payload: unknown): Promise<void> };

export interface IDeletionScheduleResult {
	reminded: number;
	purged: number;
	/** Accounts due but kept archived because an eraser failed (retried next run). */
	failed: Array<{ userId: string; eraser: string; error: string }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** HMAC of an identifier with the app's secret — proves "this address was erased" without storing it. */
export function erasureHash(secret: string, value: string | null): string | null {
	if (!value) return null;
	return createHmac('sha256', secret).update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Auth's own eraser — what auth holds about a person OUTSIDE the cascading
 * user row: sign-in attempts recorded against the address before it was
 * matched to the account (user_id NULL), and phone codes keyed by the number.
 */
export function authEraser(store: IStoreAdapter): IAccountEraser {
	return {
		name: 'auth',
		erase: async ({ email, phone }: IErasureSubject) => {
			const [row] = await store.query<{ n: number }>(
				`WITH attempts AS (
				   DELETE FROM fonderie_login_events WHERE user_id IS NULL AND $1::text IS NOT NULL AND email_attempted = $1 RETURNING 1
				 ), codes AS (
				   DELETE FROM fonderie_phone_verifications WHERE $2::text IS NOT NULL AND phone = $2 RETURNING 1
				 )
				 SELECT ((SELECT COUNT(*) FROM attempts) + (SELECT COUNT(*) FROM codes))::int AS n`,
				[email, phone],
			);
			return { erased: row?.n ?? 0 };
		},
	};
}

export async function runAccountDeletionSchedule(
	store: IStoreAdapter,
	config: ScheduleConfig,
	bus?: Bus,
	options: { batchSize?: number } = {},
): Promise<IDeletionScheduleResult> {
	const graceDays = deletionGracePeriodDays(config);
	const remindBefore = (() => {
		const n = config.accountDeletion?.reminderDaysBefore;
		return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 7;
	})();
	const result: IDeletionScheduleResult = { reminded: 0, purged: 0, failed: [] };

	// ── 1. Reminders — claimed in ONE statement, so each is sent once ──────
	const due = await store.query<{
		id: string; email: string | null; phone: string | null; locale: string | null;
		deletedAt: Date; channel: string | null;
	}>(
		`UPDATE fonderie_users u SET deletion_reminded_at = now()
		 WHERE u.deleted_at IS NOT NULL
		   AND u.deletion_reminded_at IS NULL
		   AND u.deleted_at + make_interval(days => $1) - make_interval(days => $2) <= now()
		   AND u.deleted_at + make_interval(days => $1) > now()
		   AND NOT EXISTS (
		     SELECT 1 FROM fonderie_login_events le
		     WHERE le.user_id = u.id AND le.created_at > u.deleted_at
		   )
		 RETURNING u.id, u.email, u.phone, u.locale, u.deleted_at AS "deletedAt", u.deletion_channel AS channel`,
		[graceDays, remindBefore],
	);
	for (const u of due) {
		const viaSms = u.channel === 'sms' || (!u.email && !!u.phone);
		const address = viaSms ? u.phone : u.email;
		if (!address || !bus) continue;
		const deleteOn = new Date(new Date(u.deletedAt).getTime() + graceDays * DAY_MS);
		await bus.emit(NOTIFICATION_EVENT, {
			type: MESSAGE_KEYS.accountDeletionReminder,
			...(u.locale ? { locale: u.locale } : {}),
			data: {
				deleteOn: deleteOn.toISOString().slice(0, 10),
				[COURIER_FORMAT_KEY]: { deleteOn: { date: deleteOn.toISOString(), style: 'long' } },
			},
			recipient: viaSms ? { email: null, phone: address, deviceToken: null } : { email: address, phone: null, deviceToken: null },
		} satisfies ICourierMessage);
		result.reminded++;
	}

	// ── 2. Purge — one account at a time, erasers first ─────────────────────
	const erasers: IAccountEraser[] = [authEraser(store), ...(config.accountDeletion?.erasers ?? [])];
	const limit = options.batchSize ?? 100;
	const skipped = new Set<string>();
	for (let i = 0; i < limit; i++) {
		const outcome = await store.transaction(async (tx) => {
			const [u] = await tx.query<{
				id: string; email: string | null; phone: string | null; deletedAt: Date; remindedAt: Date | null;
			}>(
				`SELECT id, email, phone, deleted_at AS "deletedAt", deletion_reminded_at AS "remindedAt"
				 FROM fonderie_users
				 WHERE deleted_at IS NOT NULL
				   AND deleted_at + make_interval(days => $1) <= now()
				   AND NOT (id = ANY($2::uuid[]))
				 ORDER BY deleted_at
				 LIMIT 1
				 FOR UPDATE SKIP LOCKED`,
				[graceDays, [...skipped]],
			);
			if (!u) return 'done' as const;
			const subject: IErasureSubject = { userId: u.id, email: u.email, phone: u.phone };
			const outcomes: Array<{ brick: string; erased: number; kept?: string }> = [];
			for (const eraser of erasers) {
				try {
					const r = await eraser.erase(subject);
					outcomes.push({ brick: eraser.name, erased: r.erased, ...(r.kept ? { kept: r.kept } : {}) });
				} catch (err) {
					result.failed.push({ userId: u.id, eraser: eraser.name, error: err instanceof Error ? err.message : String(err) });
					skipped.add(u.id);
					return 'failed' as const;
				}
			}
			await tx.query(`DELETE FROM fonderie_users WHERE id = $1`, [u.id]);
			await tx.query(
				`INSERT INTO fonderie_account_erasures (user_id, email_hash, phone_hash, requested_at, reminded_at, outcomes)
				 VALUES ($1, $2, $3, $4, $5, $6::jsonb)
				 ON CONFLICT (user_id) DO NOTHING`,
				[u.id, erasureHash(config.jwtSecret, u.email), erasureHash(config.jwtSecret, u.phone), u.deletedAt, u.remindedAt, JSON.stringify(outcomes)],
			);
			return u.id;
		});
		if (outcome === 'done') break;
		if (outcome === 'failed') continue;
		result.purged++;
		await bus?.emit(EVENT_KEYS.userPurged, { userId: outcome });
	}
	return result;
}

/** Run the schedule now, then every `intervalMs` (default 24 h). Timer unref'd; `.stop()` cancels. */
export function startAccountDeletionSchedule(
	store: IStoreAdapter,
	config: ScheduleConfig,
	options: { bus?: Bus; intervalMs?: number; onRun?: (r: IDeletionScheduleResult) => void } = {},
): { stop: () => void } {
	let stopped = false;
	const run = async () => {
		if (stopped) return;
		try {
			options.onRun?.(await runAccountDeletionSchedule(store, config, options.bus));
		} catch (err) {
			console.error('[auth] account deletion schedule failed:', err);
		}
	};
	const timer = setInterval(run, options.intervalMs ?? DAY_MS);
	if (typeof (timer as { unref?: () => void }).unref === 'function') (timer as { unref: () => void }).unref();
	void run();
	return { stop: () => { stopped = true; clearInterval(timer); } };
}
