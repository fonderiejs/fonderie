// Courier declares a `from` address; SPF, DKIM and DMARC live in public DNS,
// owned by whoever runs the domain. Nothing connects them — and a mismatch is
// not a send failure. The provider accepts the message and the RECEIVER drops
// it or files it as spam: no bounce, no error, no log line. It is the quietest
// failure in the system and usually surfaces as "I never got the email".
//
// Every case here uses an injected resolver, so the suite never touches DNS and
// cannot go red because a real record changed or CI has no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
	checkSenderDns,
	describeSenderDnsProblems,
	senderDomain,
	type ResolveTxt,
} from '../sender-dns';

/** Fake zone: hostname → TXT records, each already split the way DNS splits. */
const zone = (records: Record<string, string[]>): ResolveTxt => {
	return async (host) => {
		const found = records[host];
		if (!found) throw Object.assign(new Error('queryTxt ENOTFOUND'), { code: 'ENOTFOUND' });
		return found.map((v) => [v]);
	};
};

const GOOD = {
	'email.leadeasygen.com': ['v=spf1 include:_spf.example.net ~all'],
	'_dmarc.email.leadeasygen.com': ['v=DMARC1; p=quarantine; rua=mailto:d@leadeasygen.com'],
};

test('a correctly configured sending domain reports ok', async () => {
	const r = await checkSenderDns('hello@email.leadeasygen.com', { resolveTxt: zone(GOOD) });
	assert.equal(r.ok, true);
	assert.equal(r.domain, 'email.leadeasygen.com');
	assert.deepEqual(describeSenderDnsProblems(r), []);
	assert.equal(r.records.find((x) => x.kind === 'spf')!.present, true);
});

test('a display-name from address still yields the domain', async () => {
	assert.equal(senderDomain('LeadEasyGen <hello@email.leadeasygen.com>'), 'email.leadeasygen.com');
	assert.equal(senderDomain('hello@email.leadeasygen.com'), 'email.leadeasygen.com');
	assert.equal(senderDomain('hello@Email.LeadEasyGen.com.'), 'email.leadeasygen.com');
	assert.equal(senderDomain('not-an-address'), null);
	assert.equal(senderDomain('someone@localhost'), null, 'no dot means no domain to check');
});

// The first live run of this check produced a FALSE POSITIVE against a
// textbook-correct Resend setup, and these four cases exist so it cannot again.
//
// SPF authenticates the ENVELOPE SENDER (Return-Path), not the From header.
// Hosted senders put the Return-Path on their own bounce subdomain — Resend
// uses send.<domain>, carrying the MX and SPF — so the From domain legitimately
// has no SPF and DMARC passes on aligned DKIM instead. "SPF missing = broken"
// is wrong, and a check that is wrong when it speaks is one people mute.
test('absent SPF with an aligned DKIM key is ADVICE, not a failure', async () => {
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		dkimSelectors: ['resend'],
		resolveTxt: zone({
			'_dmarc.leadeasygen.com': ['v=DMARC1; p=reject'],
			'resend._domainkey.email.leadeasygen.com': ['v=DKIM1; k=rsa; p=MIIBIjANBg'],
		}),
	});
	assert.equal(r.ok, true, 'the real-world Resend shape must not report broken');
	const spf = r.records.find((x) => x.kind === 'spf')!;
	assert.equal(spf.problem, undefined);
	assert.match(spf.advice!, /Return-Path/);
});

test('absent SPF AND absent DKIM IS a failure — nothing can align', async () => {
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		dkimSelectors: ['resend'],
		resolveTxt: zone({ '_dmarc.leadeasygen.com': ['v=DMARC1; p=reject'] }),
	});
	assert.equal(r.ok, false);
	assert.match(r.records.find((x) => x.kind === 'spf')!.problem!, /DMARC cannot pass/);
});

test('absent SPF with DKIM UNKNOWN says so instead of guessing', async () => {
	// No selector supplied, so DKIM was never looked up. Absence of a check is
	// not evidence of a problem — and not evidence of health either.
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		resolveTxt: zone({ '_dmarc.leadeasygen.com': ['v=DMARC1; p=reject'] }),
	});
	assert.equal(r.ok, true);
	assert.match(r.records.find((x) => x.kind === 'spf')!.advice!, /pass `dkimSelectors`/);
});

test('returnPathDomain checks SPF where it actually applies', async () => {
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		returnPathDomain: 'send.email.leadeasygen.com',
		dkimSelectors: ['resend'],
		resolveTxt: zone({
			'send.email.leadeasygen.com': ['v=spf1 ip4:52.3.252.119 ~all'],
			'_dmarc.leadeasygen.com': ['v=DMARC1; p=reject'],
			'resend._domainkey.email.leadeasygen.com': ['v=DKIM1; k=rsa; p=MIIBIjANBg'],
		}),
	});
	assert.equal(r.ok, true);
	const spf = r.records.find((x) => x.kind === 'spf')!;
	assert.equal(spf.present, true);
	assert.equal(spf.foundAt, 'send.email.leadeasygen.com');
	assert.deepEqual(describeSenderDnsProblems(r), [], 'fully configured: nothing to say');
});

test('TWO SPF records are worse than one — RFC 7208 makes it a permerror', async () => {
	// Both look right in isolation, which is exactly why this gets shipped.
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		resolveTxt: zone({
			...GOOD,
			'email.leadeasygen.com': ['v=spf1 include:a ~all', 'v=spf1 include:b ~all'],
		}),
	});
	assert.equal(r.ok, false);
	assert.match(describeSenderDnsProblems(r)[0]!, /permerror.*NO SPF/);
});

test('DMARC inherited from the parent is CORRECT, not a finding', async () => {
	// RFC 7489: with no record on the subdomain a receiver falls back to the
	// organisational domain. Flagging this would be a false alarm on exactly the
	// dedicated-subdomain setup we recommend — and a check that is wrong when it
	// speaks gets muted.
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		resolveTxt: zone({
			'email.leadeasygen.com': ['v=spf1 include:_spf.example.net ~all'],
			'_dmarc.leadeasygen.com': ['v=DMARC1; p=reject'],
		}),
	});
	assert.equal(r.ok, true);
	const dmarc = r.records.find((x) => x.kind === 'dmarc')!;
	assert.equal(dmarc.present, true);
	assert.equal(dmarc.foundAt, 'leadeasygen.com', 'reports WHERE it was found');
});

test('DMARC missing everywhere up the chain is reported', async () => {
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		resolveTxt: zone({ 'email.leadeasygen.com': ['v=spf1 -all'] }),
	});
	assert.equal(r.ok, false);
	assert.match(describeSenderDnsProblems(r).join(' '), /no _dmarc record/);
});

test('p=none is flagged as monitoring-only, not silently accepted', async () => {
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		resolveTxt: zone({
			'email.leadeasygen.com': ['v=spf1 -all'],
			'_dmarc.email.leadeasygen.com': ['v=DMARC1; p=none; rua=mailto:d@x.com'],
		}),
	});
	const dmarc = r.records.find((x) => x.kind === 'dmarc')!;
	assert.equal(dmarc.present, true);
	assert.equal(dmarc.problem, undefined, 'a deliberate monitoring stage is not a failure');
	assert.match(dmarc.advice!, /p=none/);
	assert.equal(r.ok, true, 'ok tracks hard failures only');
	assert.match(describeSenderDnsProblems(r).join(' '), /advice/);
});

test('DKIM is SKIPPED without a selector — it cannot be discovered from DNS', async () => {
	// A selector is chosen by whoever signs the mail and only appears in the
	// header of a message already sent. Absence of a check is not a finding.
	const r = await checkSenderDns('hello@email.leadeasygen.com', { resolveTxt: zone(GOOD) });
	const dkim = r.records.find((x) => x.kind === 'dkim')!;
	assert.equal(dkim.skipped, true);
	assert.equal(dkim.problem, undefined);
	assert.equal(r.ok, true, 'a skipped check must not fail the report');
});

test('a supplied selector with no key published is reported', async () => {
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		dkimSelectors: ['resend', 'missing'],
		resolveTxt: zone({
			...GOOD,
			'resend._domainkey.email.leadeasygen.com': ['v=DKIM1; k=rsa; p=MIIBIjANBg'],
		}),
	});
	assert.equal(r.ok, false);
	const dkim = r.records.filter((x) => x.kind === 'dkim');
	assert.equal(dkim.length, 2, 'one record per selector');
	assert.equal(dkim[0]!.present, true);
	assert.match(dkim[1]!.problem!, /selector 'missing'/);
});

test('a TXT record split into chunks is joined, not truncated', async () => {
	// DNS splits long strings at 255 bytes; reading only the first chunk would
	// silently mangle a long DKIM key or SPF record.
	const split: ResolveTxt = async (host) =>
		host === 'email.leadeasygen.com'
			? [['v=spf1 include:_spf.exam', 'ple.net ~all']]
			: host === '_dmarc.email.leadeasygen.com'
				? [['v=DMARC1; p=reject']]
				: (() => {
						throw new Error('ENOTFOUND');
					})();
	const r = await checkSenderDns('hello@email.leadeasygen.com', { resolveTxt: split });
	assert.equal(r.ok, true);
	assert.equal(
		r.records.find((x) => x.kind === 'spf')!.value,
		'v=spf1 include:_spf.example.net ~all',
	);
});

test('a resolver that throws everywhere yields findings, never an exception', async () => {
	const r = await checkSenderDns('hello@email.leadeasygen.com', {
		dkimSelectors: ['resend'],
		resolveTxt: async () => {
			throw new Error('SERVFAIL');
		},
	});
	assert.equal(r.ok, false);
	assert.ok(describeSenderDnsProblems(r).length >= 2, 'reports SPF and DMARC as absent');
});

test('an unparseable from address is an error, not a crash', async () => {
	const r = await checkSenderDns('nonsense', { resolveTxt: zone({}) });
	assert.equal(r.ok, false);
	assert.match(describeSenderDnsProblems(r)[0]!, /cannot read a domain/);
});

test('senderDnsCheck: the doctor check over an email channel, resolver injected', async () => {
	const { senderDnsCheck } = await import('../sender-dns');
	const check = senderDnsCheck({ from: 'Hi <hello@email.leadeasygen.com>' }, zone(GOOD));
	assert.equal(check.name, 'courier.sender-dns');
	const good = await check.run();
	assert.equal(good.ok, true);
	const bad = await senderDnsCheck({ from: 'hello@email.leadeasygen.com' }, zone({})).run();
	assert.equal(bad.ok, false);
	assert.ok(bad.findings.length > 0);
});
