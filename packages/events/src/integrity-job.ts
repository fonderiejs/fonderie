import type { IStoreAdapter } from '@fonderie/store';

import { verifyEventChain, type IIntegrityReport } from './integrity';

// Scheduled tamper-detection for the audit/event log (SOC 2 CC7.2). Runs
// `verifyEventChain` on an interval; if any HMAC-carrying row fails, it fires
// `onTamper` — wire that to your alerting. Runs once immediately, then every
// `intervalMs`. Non-blocking (the timer is unref'd). Call `.stop()` to cancel.

export interface IIntegrityCheckOptions {
	// Default 24h.
	intervalMs?: number;
	// Called after every run (ok or not) — e.g. to record a heartbeat.
	onResult?: (report: IIntegrityReport) => void;
	// Called only when the log failed verification. Defaults to a loud
	// console.error naming the tampered rows — override to page/alert.
	onTamper?: (report: IIntegrityReport) => void;
}

export interface IIntegrityCheckHandle {
	stop: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startIntegrityCheck(
	store: IStoreAdapter,
	key: string,
	options: IIntegrityCheckOptions = {},
): IIntegrityCheckHandle {
	const intervalMs = options.intervalMs ?? DAY_MS;
	const onTamper = options.onTamper ?? defaultTamperHandler;
	let stopped = false;

	const run = async (): Promise<void> => {
		if (stopped) return;
		try {
			const report = await verifyEventChain(store, key);
			options.onResult?.(report);
			if (!report.ok) onTamper(report);
		} catch (err) {
			console.error('[events] integrity check failed to run:', err);
		}
	};

	const timer = setInterval(run, intervalMs);
	if (typeof (timer as { unref?: () => void }).unref === 'function') {
		(timer as { unref: () => void }).unref();
	}
	void run(); // fire once immediately

	return {
		stop: () => {
			stopped = true;
			clearInterval(timer);
		},
	};
}

function defaultTamperHandler(report: IIntegrityReport): void {
	console.error(
		`[events] AUDIT LOG INTEGRITY FAILURE — ${report.tampered.length} tampered row(s) ` +
			`out of ${report.checked} checked: ${report.tampered.join(', ')}`,
	);
}
