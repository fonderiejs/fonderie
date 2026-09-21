import type { IAdminCheck } from '@fonderie/core';
import { resolveTxt as nodeResolveTxt } from 'node:dns/promises';

/** A TXT lookup, injectable so the check can be tested without a network. */
export type ResolveTxt = (hostname: string) => Promise<string[][]>;

export interface ISenderDnsRecord {
	kind: 'spf' | 'dmarc' | 'dkim';
	present: boolean;
	/**
	 * Where it was actually found. Equals the sending domain for SPF and DKIM;
	 * for DMARC it may be a parent, which is legitimate (see below).
	 */
	foundAt?: string;
	value?: string;
	/**
	 * A hard failure: this domain cannot authenticate at all. Flips `ok`.
	 */
	problem?: string;
	/**
	 * Worth saying, but not broken — a deliberate monitoring stage, or a valid
	 * setup with a caveat. Reported alongside problems and deliberately does NOT
	 * flip `ok`, so a considered choice does not leave a deployment permanently
	 * red (which is how a check gets muted).
	 */
	advice?: string;
	/** True when nothing was looked up — a DKIM check with no selector supplied. */
	skipped?: boolean;
}

export interface ISenderDnsReport {
	/** The domain taken from the configured `from` address. */
	domain?: string;
	/** Set when `from` could not be parsed into a domain. */
	error?: string;
	records: ISenderDnsRecord[];
	ok: boolean;
}

/** `"Name <a@b.com>"` and `"a@b.com"` both yield `b.com`. */
export function senderDomain(from: string): string | null {
	const angle = from.match(/<([^>]+)>/);
	const address = (angle?.[1] ?? from).trim();
	const at = address.lastIndexOf('@');
	if (at < 1 || at === address.length - 1) return null;
	const domain = address.slice(at + 1).trim().toLowerCase().replace(/\.$/, '');
	return domain.includes('.') ? domain : null;
}

/** Absent and empty are the same answer here; only a real fault is an error. */
async function txt(host: string, resolve: ResolveTxt): Promise<string[]> {
	try {
		// A single TXT record can be split into multiple strings; the record's
		// value is their concatenation, not the first chunk.
		return (await resolve(host)).map((chunks) => chunks.join(''));
	} catch {
		// NXDOMAIN / ENODATA / SERVFAIL all mean "nothing usable here". Treating a
		// lookup failure as a finding would make this check fire on every
		// air-gapped CI run, and a check that cries wolf is one people mute.
		return [];
	}
}

/**
 * Check that the domain we send mail AS is actually set up to authorise us.
 *
 * The asymmetry: courier declares a `from` address, while SPF, DKIM and DMARC
 * live in public DNS, owned by whoever runs the domain. Nothing connects them,
 * and a mismatch does not fail a send — the provider accepts the message and
 * the RECEIVER drops it or files it as spam. No bounce, no error, no log. It is
 * the quietest failure in the system, and the one most likely to be discovered
 * by a customer saying "I never got the email".
 *
 * Deliberately DNS-only: no provider API and no credentials, so it works for
 * any SMTP backend rather than only the ones with a domains endpoint.
 *
 * Never throws — a diagnostic must not take down what it diagnoses.
 */
export async function checkSenderDns(
	from: string,
	opts: { dkimSelectors?: string[]; returnPathDomain?: string; resolveTxt?: ResolveTxt } = {},
): Promise<ISenderDnsReport> {
	const resolve = opts.resolveTxt ?? nodeResolveTxt;
	const domain = senderDomain(from);
	if (!domain) {
		return { error: `cannot read a domain from the from address: ${from}`, records: [], ok: false };
	}

	const records: ISenderDnsRecord[] = [];

	// ---- SPF -------------------------------------------------------------
	// SPF authenticates the ENVELOPE SENDER (the Return-Path), not the From
	// header, and it is not inherited from a parent domain.
	//
	// That distinction decides whether an absent record is a fault. Most hosted
	// senders put the Return-Path on their own bounce subdomain — Resend uses
	// send.<domain>, with the MX and SPF there — so the From domain legitimately
	// has NO SPF and DMARC passes on aligned DKIM instead. Reporting that as
	// broken is a false alarm on a textbook-correct setup, which was this
	// check's first live finding and is why the rule below is not "SPF missing =
	// bad". Pass `returnPathDomain` to check where SPF actually applies.
	const spfDomain = opts.returnPathDomain?.toLowerCase().replace(/\.$/, '') ?? domain;
	const spfAll = (await txt(spfDomain, resolve)).filter((v) =>
		v.toLowerCase().startsWith('v=spf1'),
	);
	if (spfAll.length === 0) {
		// Resolved after DKIM below, because whether this is a problem depends on
		// whether anything else can align.
		records.push({ kind: 'spf', present: false });
	} else if (spfAll.length > 1) {
		// RFC 7208: more than one SPF record is a permerror, and a permerror is
		// treated as no SPF at all. Two "correct" records are worse than one.
		records.push({
			kind: 'spf',
			present: true,
			foundAt: domain,
			value: spfAll.join(' | '),
			problem: `${spfAll.length} v=spf1 records on ${spfDomain} — RFC 7208 makes that a permerror, which receivers treat as having NO SPF`,
		});
	} else {
		records.push({ kind: 'spf', present: true, foundAt: spfDomain, value: spfAll[0]! });
	}

	// ---- DMARC -----------------------------------------------------------
	// DMARC *is* inherited: with no record at _dmarc.<domain>, a receiver falls
	// back to the organisational domain (RFC 7489 §6.6.3). So a sending
	// subdomain covered by its apex is correctly configured, and reporting it as
	// missing would be a false alarm on the exact setup we recommend.
	//
	// Determining the true organisational domain needs the Public Suffix List,
	// which is a dependency and a refresh problem this package should not take
	// on. Walking up to the last two labels is deliberately PERMISSIVE: it can
	// accept a record slightly higher than a receiver would consult, which risks
	// staying quiet when we could have warned — the safe direction for a check
	// whose credibility depends on never being wrong when it does speak.
	let dmarc: ISenderDnsRecord = {
		kind: 'dmarc',
		present: false,
		problem: `no _dmarc record for ${domain} or any parent — without DMARC, SPF and DKIM results carry no policy and receivers apply their own judgement`,
	};
	const labels = domain.split('.');
	for (let i = 0; i + 2 <= labels.length; i++) {
		const at = labels.slice(i).join('.');
		const found = (await txt(`_dmarc.${at}`, resolve)).find((v) =>
			v.toLowerCase().startsWith('v=dmarc1'),
		);
		if (found) {
			dmarc = { kind: 'dmarc', present: true, foundAt: at, value: found };
			// p=none publishes a policy but asks receivers to do nothing with it.
			// That is a valid monitoring stage, not a finished setup — worth
			// saying once, not worth failing over.
			if (/[;\s]p=none\b/i.test(found)) {
				dmarc.advice = `DMARC at ${at} is p=none — monitoring only, so a forged sender is still delivered. Deliberate while collecting rua reports; move to quarantine or reject once they look clean.`;
			}
			break;
		}
	}
	records.push(dmarc);

	// ---- DKIM ------------------------------------------------------------
	// A selector cannot be discovered from DNS — it is chosen by whoever signs
	// the mail and only appears in the header of a message already sent. With
	// none supplied there is nothing to look up, which is reported as skipped
	// rather than missing: absence of a check is not evidence of a problem.
	const selectors = opts.dkimSelectors ?? [];
	if (selectors.length === 0) {
		// No `problem` key at all — the repo runs exactOptionalPropertyTypes, and
		// omitting it is also the honest encoding: there is nothing wrong here.
		records.push({ kind: 'dkim', present: false, skipped: true });
	} else {
		for (const selector of selectors) {
			const host = `${selector}._domainkey.${domain}`;
			const found = (await txt(host, resolve)).find((v) => /(^|;)\s*(v=DKIM1|k=|p=)/i.test(v));
			records.push(
				found
					? { kind: 'dkim', present: true, foundAt: host, value: found.slice(0, 80) }
					: {
							kind: 'dkim',
							present: false,
							problem: `no DKIM key at ${host} — mail signed with selector '${selector}' cannot be verified`,
						},
			);
		}
	}

	// ---- resolve the absent-SPF case, now that DKIM is known ---------------
	// DMARC passes when EITHER an aligned SPF or an aligned DKIM passes, so an
	// absent SPF on the From domain is only fatal when nothing else can align.
	const spf = records.find((r) => r.kind === 'spf')!;
	if (!spf.present && !spf.problem) {
		const dkimOk = records.some((r) => r.kind === 'dkim' && r.present);
		const dkimChecked = records.some((r) => r.kind === 'dkim' && !r.skipped);
		if (dkimOk) {
			// The normal hosted-sender shape: bounce subdomain carries SPF, the From
			// domain carries DKIM. Nothing is wrong.
			spf.advice =
				`no v=spf1 on ${spfDomain}, which is expected when the provider owns the Return-Path ` +
				'(SPF is checked against the envelope sender, not From). DMARC passes on the aligned ' +
				'DKIM key found below. Pass `returnPathDomain` to verify SPF where it actually applies.';
		} else if (dkimChecked) {
			// Checked for DKIM and found none: nothing can align, DMARC fails.
			spf.problem =
				`no v=spf1 on ${spfDomain} AND no DKIM key — neither can align, so DMARC cannot pass ` +
				'and receivers will treat this mail as unauthenticated';
		} else {
			// No selector supplied, so DKIM is unknown. Absence of a check is not
			// evidence of a problem — say what is missing instead of guessing.
			spf.advice =
				`no v=spf1 on ${spfDomain}. That is fine if the provider owns the Return-Path and DKIM ` +
				'is published — pass `dkimSelectors` so this can tell the difference instead of guessing.';
		}
	}

	// `ok` tracks only hard failures; advice is reported without flipping it.
	return { domain, records, ok: records.every((r) => !r.problem) };
}

/** One line per problem, for a log. Empty when the domain is set up correctly. */
export function describeSenderDnsProblems(report: ISenderDnsReport): string[] {
	if (report.error) return [`sender DNS check failed: ${report.error}`];
	// Problems first: if a reader stops after one line, it should be the one that
	// means mail is failing, not the one that means it could be tightened.
	return [
		...report.records.filter((r) => r.problem).map((r) => `${r.kind.toUpperCase()}: ${r.problem}`),
		...report.records.filter((r) => r.advice).map((r) => `${r.kind.toUpperCase()} (advice): ${r.advice}`),
	];
}

// The doctor check over a configured email channel. `resolveTxt` is for tests.
export function senderDnsCheck(
	email: { from: string; senderDns?: { dkimSelectors?: string[]; returnPathDomain?: string } },
	resolveTxt?: ResolveTxt,
): IAdminCheck {
	return {
		name: 'courier.sender-dns',
		run: async () => {
			const report = await checkSenderDns(email.from, { ...(email.senderDns ?? {}), ...(resolveTxt ? { resolveTxt } : {}) });
			return { ok: report.ok, findings: describeSenderDnsProblems(report) };
		},
	};
}
