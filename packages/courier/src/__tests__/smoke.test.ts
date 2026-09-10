import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import type { ICourierConfig } from '../config';
import type { ICourierChannel, ICourierMessage, ITemplateResolver } from '../types';
import type { IStoreAdapter } from '@fonderie/store';

import { Channel } from '../config';
import { Dispatcher } from '../dispatcher';
import { FSTemplateResolver, DBTemplateResolver, DefaultTemplates } from '../templates/resolver';

// ── Stub channel ─────────────────────────────────────────────────

function makeChannel(name: string): ICourierChannel & { sent: ICourierMessage[] } {
	const sent: ICourierMessage[] = [];
	return {
		name,
		sent,
		async send(message) {
			sent.push(message);
		},
	};
}

// ── Stub resolver ─────────────────────────────────────────────────

function makeResolver(): ITemplateResolver {
	return {
		async resolve(type, data, locale) {
			return {
				subject: `Subject: ${type}${locale ? ` (${locale})` : ''}`,
				text: `Text: ${JSON.stringify(data)}`,
			};
		},
	};
}

// ── Stub store ───────────────────────────────────────────────────

function makeStore(interceptLog?: (sql: string) => void): IStoreAdapter {
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			interceptLog?.(sql);
			if (sql.includes('INSERT INTO fonderie_message_log')) return [{ id: 'log-1' }] as T[];
			if (sql.includes('UPDATE fonderie_message_log')) return [] as T[];
			return [] as T[];
		},
		transaction: async (fn) => fn(stub),
	};
	return stub;
}

// ── Channel constants ─────────────────────────────────────────────

test('Channel: exports correct string values', () => {
	assert.equal(Channel.EMAIL, 'email');
	assert.equal(Channel.SMS, 'sms');
	assert.equal(Channel.PUSH, 'push');
});

// ── Dispatcher ───────────────────────────────────────────────────

test('dispatcher: sends to configured channel', async () => {
	const config: ICourierConfig = { channels: { 'password-reset': [Channel.EMAIL] } };
	const email = makeChannel('email');
	const dispatcher = new Dispatcher(config, makeResolver());
	dispatcher.registerChannel(email);

	await dispatcher.dispatch({
		type: 'password-reset',
		recipient: { email: 'a@b.com', phone: null, deviceToken: null },
		data: { token: 'abc123' },
	});

	assert.equal(email.sent.length, 1);
	assert.equal(email.sent[0]?.recipient.email, 'a@b.com');
});

test('dispatcher: sends to multiple channels', async () => {
	const config: ICourierConfig = {
		channels: { 'workspace-invitation': [Channel.EMAIL, Channel.SMS] },
	};
	const email = makeChannel('email');
	const sms = makeChannel('sms');

	const dispatcher = new Dispatcher(config, makeResolver());
	dispatcher.registerChannel(email);
	dispatcher.registerChannel(sms);

	await dispatcher.dispatch({
		type: 'workspace-invitation',
		recipient: { email: 'a@b.com', phone: '+15551234567', deviceToken: null },
		data: { pin: '123456' },
	});

	assert.equal(email.sent.length, 1);
	assert.equal(sms.sent.length, 1);
});

test('dispatcher: skips unconfigured message type', async () => {
	const config: ICourierConfig = { channels: {} };
	const email = makeChannel('email');
	const dispatcher = new Dispatcher(config, makeResolver());
	dispatcher.registerChannel(email);

	await dispatcher.dispatch({
		type: 'unknown-type',
		recipient: { email: 'a@b.com', phone: null, deviceToken: null },
		data: {},
	});

	assert.equal(email.sent.length, 0);
});

test('dispatcher: skips missing channel without throwing', async () => {
	const config: ICourierConfig = { channels: { 'test-event': [Channel.SMS] } };
	const dispatcher = new Dispatcher(config, makeResolver());
	// no channels registered
	await assert.doesNotReject(() =>
		dispatcher.dispatch({
			type: 'test-event',
			recipient: { email: null, phone: '+15551234567', deviceToken: null },
			data: {},
		}),
	);
});

test('dispatcher: passes locale to resolver', async () => {
	let capturedLocale: string | undefined;

	const localeResolver: ITemplateResolver = {
		async resolve(_type, _data, locale) {
			capturedLocale = locale;
			return { text: 'ok' };
		},
	};

	const config: ICourierConfig = { channels: { welcome: [Channel.EMAIL] } };
	const dispatcher = new Dispatcher(config, localeResolver);
	dispatcher.registerChannel(makeChannel('email'));

	await dispatcher.dispatch({
		type: 'welcome',
		locale: 'fr-FR',
		recipient: { email: 'a@b.com', phone: null, deviceToken: null },
		data: {},
	});

	assert.equal(capturedLocale, 'fr-FR');
});

test('dispatcher: logs messages when store provided', async () => {
	const logged: string[] = [];
	const store = makeStore((sql) => {
		if (sql.includes('INSERT INTO fonderie_message_log')) logged.push('insert');
		if (sql.includes("status = 'sent'")) logged.push('sent');
	});

	const config: ICourierConfig = { channels: { 'test-log': [Channel.EMAIL] } };
	const dispatcher = new Dispatcher(config, makeResolver(), store);
	dispatcher.registerChannel(makeChannel('email'));

	await dispatcher.dispatch({
		type: 'test-log',
		recipient: { email: 'a@b.com', phone: null, deviceToken: null },
		data: {},
	});

	// Give fire-and-forget log updates a tick to settle
	await new Promise((r) => setTimeout(r, 10));
	assert.ok(logged.includes('insert'), 'should insert log entry');
});

// ── FSTemplateResolver ───────────────────────────────────────────

test('FSTemplateResolver: falls back to JSON when template file missing', async () => {
	const resolver = new FSTemplateResolver('/tmp/nonexistent-templates');
	const result = await resolver.resolve('some-type', { key: 'value' });
	assert.ok(result.text.includes('some-type'));
});

test('FSTemplateResolver: passes locale to file lookup (no error on missing)', async () => {
	const resolver = new FSTemplateResolver('/tmp/nonexistent-templates');
	const result = await resolver.resolve('some-type', { key: 'value' }, 'fr-FR');
	assert.ok(result.text.includes('some-type'));
});

// ── Default-template fallback chain (app override → module default → JSON) ──

const DEF = new DefaultTemplates([
	{
		'billing.credits-low': {
			subject: 'Low balance: {{plan}}',
			text: '{{balance}} credits left on {{plan}}.',
			html: '<h1>{{balance}} credits left</h1><p>on {{plan}}</p>',
		},
	},
]);

test('fallback: FS resolver renders the module default when the app ships no file', async () => {
	const resolver = new FSTemplateResolver('/tmp/nonexistent-templates', DEF);
	const r = await resolver.resolve('billing.credits-low', { plan: 'Pro', balance: '3' });
	assert.equal(r.subject, 'Low balance: Pro');
	assert.equal(r.text, '3 credits left on Pro.');
	assert.ok(r.html?.includes('<!DOCTYPE html>'), 'default html is wrapped in the layout shell');
	assert.ok(r.html?.includes('3 credits left'), 'default html interpolated');
	assert.ok(!r.html?.includes('{{'), 'no unresolved vars');
});

test('fallback: FS resolver falls to JSON only when neither app file nor default exists', async () => {
	const resolver = new FSTemplateResolver('/tmp/nonexistent-templates', DEF);
	const r = await resolver.resolve('some.unknown-key', { x: 1 });
	assert.ok(r.text.includes('some.unknown-key'), 'last-resort JSON dump for a key nobody provides');
});

test('fallback: an app FS file wins over the module default', async () => {
	const { mkdtemp, writeFile } = await import('node:fs/promises');
	const { tmpdir } = await import('node:os');
	const { join } = await import('node:path');
	const dir = await mkdtemp(join(tmpdir(), 'courier-tmpl-'));
	await writeFile(join(dir, 'billing.credits-low.txt'), 'APP OVERRIDE: {{balance}}');

	const resolver = new FSTemplateResolver(dir, DEF);
	const r = await resolver.resolve('billing.credits-low', { plan: 'Pro', balance: '3' });
	assert.equal(r.text, 'APP OVERRIDE: 3', 'per-key app file wins over the default');
});

test('fallback: DB resolver renders the module default when no row matches', async () => {
	const store: IStoreAdapter = {
		query: async <T = unknown>(): Promise<T[]> => [] as T[], // no rows for anything
		transaction: async (fn) => fn(store),
	};
	const resolver = new DBTemplateResolver(store, DEF);
	const r = await resolver.resolve('billing.credits-low', { plan: 'Pro', balance: '3' });
	assert.equal(r.subject, 'Low balance: Pro');
	assert.equal(r.text, '3 credits left on Pro.');
	assert.ok(r.html?.includes('3 credits left'), 'default html rendered');
});

test('fallback: a DB row wins over the module default', async () => {
	const store: IStoreAdapter = {
		query: async <T = unknown>(_sql: string, params?: unknown[]): Promise<T[]> =>
			(params?.[0] === 'billing.credits-low'
				? [{ subject: 'ROW', html: null, text: 'row text {{balance}}' }]
				: []) as T[],
		transaction: async (fn) => fn(store),
	};
	const resolver = new DBTemplateResolver(store, DEF);
	const r = await resolver.resolve('billing.credits-low', { balance: '3' });
	assert.equal(r.text, 'row text 3', 'DB row wins over the default');
	assert.equal(r.subject, 'ROW');
});

test('fallback: an empty app file is the app path, not the default (presence, not truthiness)', async () => {
	const { mkdtemp, writeFile } = await import('node:fs/promises');
	const { tmpdir } = await import('node:os');
	const { join } = await import('node:path');
	const dir = await mkdtemp(join(tmpdir(), 'courier-empty-'));
	await writeFile(join(dir, 'billing.credits-low.txt'), ''); // app shipped a (degenerate) empty file
	const resolver = new FSTemplateResolver(dir, DEF);
	const r = await resolver.resolve('billing.credits-low', { plan: 'Pro', balance: '3' });
	assert.ok(!r.text.includes('credits left on Pro'), 'the module default must NOT override a shipped (even empty) app file');
	assert.ok(r.text.includes('billing.credits-low'), 'empty app file falls to JSON, mirroring the DB row-presence check');
});

test('fallback: empty defaults + no template behaves exactly as before (JSON dump)', async () => {
	const resolver = new FSTemplateResolver('/tmp/nonexistent-templates', new DefaultTemplates());
	const r = await resolver.resolve('some-type', { key: 'value' });
	assert.ok(r.text.includes('some-type'), 'behavior-neutral when no defaults are wired');
});

// ── Layout composition ───────────────────────────────────────────

test('wrapLayout: injects a body fragment into the shell', async () => {
	const { wrapLayout } = await import('../templates/layout');
	const html = wrapLayout('<h1>Hello</h1>');
	assert.ok(html.includes('<!DOCTYPE html>'), 'wraps in a full document');
	assert.ok(html.includes('<h1>Hello</h1>'), 'contains the body');
	assert.ok(html.includes('Fonderie'), 'carries the branded shell');
	assert.ok(!html.includes('{{content}}'), 'slot is consumed');
});

test('wrapLayout: passes a full document through untouched (no double-wrap)', async () => {
	const { wrapLayout } = await import('../templates/layout');
	const full = '<!DOCTYPE html><html><body>done</body></html>';
	assert.equal(wrapLayout(full), full);
});

test('DBTemplateResolver: composes a body fragment into the layout + interpolates', async () => {
	const { DBTemplateResolver } = await import('../templates/resolver');
	const store: IStoreAdapter = {
		query: async <T = unknown>(_sql: string, params?: unknown[]): Promise<T[]> => {
			// The layout lookup (type = '_layout') returns nothing → default shell.
			if (params?.[0] === 'email-verification') {
				return [
					{
						subject: 'Hi {{firstName}}',
						html: '<h1>Verify</h1><p><span class="pin-code">{{pin}}</span></p>',
						text: 'code {{pin}}',
					},
				] as T[];
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const resolver = new DBTemplateResolver(store);
	const r = await resolver.resolve('email-verification', { firstName: 'Ada', pin: '123456' });
	assert.equal(r.subject, 'Hi Ada');
	assert.ok(r.html?.includes('<!DOCTYPE html>'), 'wrapped in the shell');
	assert.ok(r.html?.includes('123456'), 'pin interpolated into the html');
	assert.ok(!r.html?.includes('{{pin}}'), 'no unresolved variables remain');
	assert.equal(r.text, 'code 123456');
});

test('DBTemplateResolver: serves exact locale, never a sibling region', async () => {
	const { DBTemplateResolver } = await import('../templates/resolver');
	// Rows: en-CA, en-US, and a NULL default — all for 'password-reset'.
	const rows: Record<string, { subject: string; html: null; text: string }> = {
		'en-CA': { subject: 'CA', html: null, text: 'reset (CA)' },
		'en-US': { subject: 'US', html: null, text: 'reset (US)' },
		DEFAULT: { subject: 'DEF', html: null, text: 'reset (default)' },
	};
	const store: IStoreAdapter = {
		// Emulate: WHERE (locale = $2 OR locale IS NULL) ORDER BY exact DESC LIMIT 1
		query: async <T = unknown>(_sql: string, params?: unknown[]): Promise<T[]> => {
			const [type, locale] = (params ?? []) as [string, string | null];
			if (type !== 'password-reset') return [] as T[];
			const exact = locale ? rows[locale] : undefined;
			return [exact ?? rows.DEFAULT] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const resolver = new DBTemplateResolver(store);

	assert.equal((await resolver.resolve('password-reset', {}, 'en-CA')).text, 'reset (CA)');
	assert.equal((await resolver.resolve('password-reset', {}, 'en-US')).text, 'reset (US)');
	// A region we didn't seed must fall to the neutral default — not a sibling.
	assert.equal((await resolver.resolve('password-reset', {}, 'de-DE')).text, 'reset (default)');
});

// ── ICourierMessage type ─────────────────────────────────────────

test('ICourierMessage: shape is correct', () => {
	const message: ICourierMessage = {
		type: 'password-reset',
		locale: 'en-US',
		recipient: { email: 'a@b.com', phone: null, deviceToken: null },
		data: { token: 'abc' },
	};
	assert.equal(message.type, 'password-reset');
	assert.equal(message.locale, 'en-US');
	assert.equal(message.recipient.email, 'a@b.com');
	assert.equal(message.recipient.phone, null);
});

// ── CourierModule shape ──────────────────────────────────────────

test('CourierModule: satisfies IFonderieModule interface', async () => {
	const { CourierModule } = await import('../module');
	const mod = new CourierModule({
		channels: {},
		templates: { source: 'fs', directory: '/tmp' },
	});
	assert.equal(mod.name, '@fonderie/courier');
	assert.ok(typeof mod.install === 'function');
	assert.ok(typeof mod.dispatcher === 'object');
});

// ── Bus subscription ─────────────────────────────────────────────

test('CourierModule: subscribes to notification.send and dispatches on emit', async () => {
	const { CourierModule } = await import('../module');

	let capturedHandler: ((msg: any, meta: any) => Promise<void>) | undefined;
	const fakeBus = {
		on: (_type: string, handler: any) => {
			capturedHandler = handler;
		},
	} as any;

	const email = makeChannel('email');
	const mod = new CourierModule(
		{
			channels: { 'password-reset': [Channel.EMAIL] },
			templates: { source: 'fs', directory: '/tmp' },
		},
		undefined,
		fakeBus,
	);
	mod.dispatcher.registerChannel(email);

	assert.ok(typeof capturedHandler === 'function', 'handler must be registered on bus');

	await capturedHandler!(
		{
			type: 'password-reset',
			recipient: { email: 'a@b.com', phone: null, deviceToken: null },
			data: {},
		},
		{ id: 'evt-1', type: 'notification.send', emittedAt: new Date().toISOString(), attempts: 0 },
	);

	assert.equal(email.sent.length, 1);
	assert.equal(email.sent[0]?.recipient.email, 'a@b.com');
});

test('CourierModule: no bus — no error thrown', async () => {
	const { CourierModule } = await import('../module');
	assert.doesNotThrow(
		() =>
			new CourierModule({
				channels: {},
				templates: { source: 'fs', directory: '/tmp' },
			}),
	);
});

// ── Delivery webhooks ─────────────────────────────────────────────

function makeDeliveryStore() {
	const updates: string[] = [];
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('UPDATE fonderie_message_log')) {
				updates.push((params?.[0] as string) ?? '');
			}
			return [] as T[];
		},
		transaction: async (fn) => fn(stub),
	};
	return { stub, updates };
}

// SendGrid signs its event webhook with ECDSA (P-256 over timestamp+body, base64
// DER signature) — the tests sign with a real generated keypair, exactly like
// SendGrid does, and the handler verifies against the base64 SPKI public key.
import { generateKeyPairSync, sign as cryptoSign, createHmac as cryptoCreateHmac } from 'node:crypto';

function makeSendGridSigner() {
	const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
	const publicKeyB64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
	return {
		publicKeyB64,
		signedRequest(payload: unknown): Request {
			const body = JSON.stringify(payload);
			const ts = String(Math.floor(Date.now() / 1000));
			const signature = cryptoSign('sha256', Buffer.from(ts + body), privateKey).toString('base64');
			return new Request('http://localhost/courier/delivery/sendgrid', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-twilio-email-event-webhook-signature': signature,
					'x-twilio-email-event-webhook-timestamp': ts,
				},
				body,
			});
		},
	};
}

test('handleSendGridDelivery: verifies ECDSA signature and processes open event', async () => {
	const { handleSendGridDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();
	const sg = makeSendGridSigner();

	const res = await handleSendGridDelivery(
		sg.signedRequest([{ event: 'open', sg_message_id: 'abc123.filterXxx' }]),
		stub,
		sg.publicKeyB64,
	);
	assert.equal(res.status, 200);
	assert.ok(updates.includes('abc123'));
});

test('handleSendGridDelivery: processes bounce event', async () => {
	const { handleSendGridDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();
	const sg = makeSendGridSigner();

	const res = await handleSendGridDelivery(
		sg.signedRequest([{ event: 'bounce', sg_message_id: 'msg456', reason: 'Invalid address' }]),
		stub,
		sg.publicKeyB64,
	);
	assert.equal(res.status, 200);
	assert.ok(updates.includes('msg456'));
});

test('handleSendGridDelivery: skips events with no sg_message_id', async () => {
	const { handleSendGridDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();
	const sg = makeSendGridSigner();

	const res = await handleSendGridDelivery(sg.signedRequest([{ event: 'open' }]), stub, sg.publicKeyB64);
	assert.equal(res.status, 200);
	assert.equal(updates.length, 0);
});

// Fail closed (H8): no verification key → 401, nothing processed. Unverified
// endpoints would accept forged delivered/opened/bounced events from anyone.

test('handleSendGridDelivery: 401 without a verification key (fail closed)', async () => {
	const { handleSendGridDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();
	const req = new Request('http://localhost/courier/delivery/sendgrid', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify([{ event: 'open', sg_message_id: 'forged' }]),
	});
	const res = await handleSendGridDelivery(req, stub, undefined);
	assert.equal(res.status, 401);
	assert.equal(updates.length, 0);
});

test('handleSendGridDelivery: 401 on a forged/mis-signed payload', async () => {
	const { handleSendGridDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();
	const sg = makeSendGridSigner();
	const other = makeSendGridSigner(); // attacker's own keypair

	const res = await handleSendGridDelivery(
		other.signedRequest([{ event: 'bounce', sg_message_id: 'victim-msg' }]),
		stub,
		sg.publicKeyB64, // configured key ≠ signer
	);
	assert.equal(res.status, 401);
	assert.equal(updates.length, 0);
});

test('handleMailgunDelivery: verifies HMAC signature and processes delivered event', async () => {
	const { handleMailgunDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();

	const signingKey = 'mg-signing-key';
	const timestamp = String(Math.floor(Date.now() / 1000));
	const token = 'tok-123';
	const signature = cryptoCreateHmac('sha256', signingKey).update(timestamp + token).digest('hex');

	const payload = {
		signature: { timestamp, token, signature },
		'event-data': {
			event: 'delivered',
			message: { headers: { 'message-id': 'mg-msg-id-789' } },
		},
	};
	const req = new Request('http://localhost/courier/delivery/mailgun', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
	});

	const res = await handleMailgunDelivery(req, stub, signingKey);
	assert.equal(res.status, 200);
	assert.ok(updates.includes('mg-msg-id-789'));
});

test('handleMailgunDelivery: 401 without a signing key (fail closed)', async () => {
	const { handleMailgunDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();
	const req = new Request('http://localhost/courier/delivery/mailgun', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ 'event-data': { event: 'delivered', message: { headers: { 'message-id': 'forged' } } } }),
	});
	const res = await handleMailgunDelivery(req, stub, undefined);
	assert.equal(res.status, 401);
	assert.equal(updates.length, 0);
});

test('handleMailtrapDelivery: processes open event', async () => {
	const { handleMailtrapDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();

	const payload = [{ event: 'open', message_id: 'trap-abc' }];
	const req = new Request('http://localhost/courier/delivery/mailtrap', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
	});

	const res = await handleMailtrapDelivery(req, stub);
	assert.equal(res.status, 200);
	assert.ok(updates.includes('trap-abc'));
});

// ── production-readiness: validateCourierConfig ──────────────────

test('validateCourierConfig: warns on a routed channel with no provider', async () => {
	const { validateCourierConfig } = await import('../config-guard');
	const warn = mock.method(console, 'warn', () => {});
	try {
		validateCourierConfig(
			{ channels: { 'email-verification': [Channel.EMAIL], 'new-message': [Channel.PUSH] } },
			[], // nothing registered
		);
		// one warning per gap-channel (email, push)
		assert.equal(warn.mock.callCount(), 2);
		const msgs = warn.mock.calls.map((c) => c.arguments[0] as string).join('\n');
		assert.match(msgs, /'email' provider is registered.*email-verification/s);
		assert.match(msgs, /'push' provider is registered.*new-message/s);
	} finally {
		warn.mock.restore();
	}
});

test('validateCourierConfig: silent when every routed channel is registered', async () => {
	const { validateCourierConfig } = await import('../config-guard');
	const warn = mock.method(console, 'warn', () => {});
	try {
		validateCourierConfig(
			{ channels: { 'email-verification': [Channel.EMAIL] } },
			['email'], // registered (config-driven OR via registerChannel)
		);
		assert.equal(warn.mock.callCount(), 0);
	} finally {
		warn.mock.restore();
	}
});

test('validateCourierConfig: no channels configured — no warning', async () => {
	const { validateCourierConfig } = await import('../config-guard');
	const warn = mock.method(console, 'warn', () => {});
	try {
		validateCourierConfig({ channels: {} }, []);
		assert.equal(warn.mock.callCount(), 0);
	} finally {
		warn.mock.restore();
	}
});

test('CourierModule.checkReadiness: reports gap channels as warning problems', async () => {
	const { CourierModule } = await import('../module');
	const mod = new CourierModule({
		channels: { 'email-verification': [Channel.EMAIL] },
		templates: { source: 'fs', directory: '/tmp' },
	});
	const problems = mod.checkReadiness();
	assert.equal(problems.length, 1);
	assert.equal(problems[0]?.severity, 'warning');
	assert.equal(problems[0]?.module, '@fonderie/courier');
	assert.match(problems[0]?.message ?? '', /email-verification/);
});

// ── versioned template management ────────────────────────────────

// ── Template admin routes ─────────────────────────────────────────

function routeMap(routes: Array<[string, string, unknown]>) {
	const m = new Map<string, (ctx: unknown, next?: unknown) => Promise<Response>>();
	for (const [method, path, handler] of routes)
		m.set(`${method} ${path}`, handler as (ctx: unknown) => Promise<Response>);
	return m;
}

function adminCtx(url: string, opts: { auth?: string; params?: Record<string, string>; body?: unknown } = {}) {
	const headers = new Headers();
	if (opts.auth) headers.set('authorization', `Bearer ${opts.auth}`);
	return {
		request: new Request(url, { headers }),
		meta: { params: opts.params ?? {}, body: opts.body },
	} as unknown;
}

test('template admin: missing/wrong token → 401', async () => {
	const { buildTemplateAdminRoutes } = await import('../templates/admin-routes');
	const { store } = captureStore(() => []);
	const routes = routeMap(buildTemplateAdminRoutes(store, 'secret-token'));
	const handler = routes.get('GET /admin/templates')!;
	const bad = await handler(adminCtx('http://localhost/admin/templates', { auth: 'nope' }));
	assert.equal(bad.status, 401);
	const none = await handler(adminCtx('http://localhost/admin/templates'));
	assert.equal(none.status, 401);
});

test('template admin: PUT writes a versioned template (200)', async () => {
	const { buildTemplateAdminRoutes } = await import('../templates/admin-routes');
	const { store, seen } = captureStore((sql) => (sql.includes('RETURNING') ? [{ type: 'email-verification', version: 3 }] : []));
	const routes = routeMap(buildTemplateAdminRoutes(store, 'tok'));
	const handler = routes.get('PUT /admin/templates/:type')!;
	const res = await handler(adminCtx('http://localhost/admin/templates/email-verification', {
		auth: 'tok', params: { type: 'email-verification' }, body: { text: 'hi', subject: 'Verify' },
	}));
	assert.equal(res.status, 200);
	assert.ok(seen.some((s) => s.includes('fonderie_courier_templates') && s.includes('subject')));
});

test('template admin: PUT without body.text → 422', async () => {
	const { buildTemplateAdminRoutes } = await import('../templates/admin-routes');
	const { store } = captureStore(() => []);
	const routes = routeMap(buildTemplateAdminRoutes(store, 'tok'));
	const handler = routes.get('PUT /admin/templates/:type')!;
	const res = await handler(adminCtx('http://localhost/admin/templates/x', {
		auth: 'tok', params: { type: 'x' }, body: {},
	}));
	assert.equal(res.status, 422);
});

test('template admin: PUT stale ifVersion → 409', async () => {
	const { buildTemplateAdminRoutes } = await import('../templates/admin-routes');
	const { store } = captureStore((sql) => (sql.includes('SELECT version') ? [{ version: 9 }] : []));
	const routes = routeMap(buildTemplateAdminRoutes(store, 'tok'));
	const handler = routes.get('PUT /admin/templates/:type')!;
	const res = await handler(adminCtx('http://localhost/admin/templates/x', {
		auth: 'tok', params: { type: 'x' }, body: { text: 'hi', ifVersion: 1 },
	}));
	assert.equal(res.status, 409);
});

test('template admin: GET :type uses ?locale scope, 404 when absent', async () => {
	const { buildTemplateAdminRoutes } = await import('../templates/admin-routes');
	let sql = '';
	const { store } = captureStore((q) => { sql = q; return []; });
	const routes = routeMap(buildTemplateAdminRoutes(store, 'tok'));
	const handler = routes.get('GET /admin/templates/:type')!;
	const res = await handler(adminCtx('http://localhost/admin/templates/x?locale=fr-CA', {
		auth: 'tok', params: { type: 'x' },
	}));
	assert.equal(res.status, 404);
	assert.match(sql, /locale IS NOT DISTINCT FROM \$2/);
});

test('template admin: rollback → 200 with toVersion', async () => {
	const { buildTemplateAdminRoutes } = await import('../templates/admin-routes');
	const { store } = captureStore((sql) => (sql.includes('RETURNING') || sql.includes('SELECT') ? [{ type: 'x', version: 4, text: 'old' }] : []));
	const routes = routeMap(buildTemplateAdminRoutes(store, 'tok'));
	const handler = routes.get('POST /admin/templates/:type/rollback')!;
	const res = await handler(adminCtx('http://localhost/admin/templates/x/rollback', {
		auth: 'tok', params: { type: 'x' }, body: { toVersion: 2 },
	}));
	assert.equal(res.status, 200);
});

function captureStore(rows: (sql: string) => unknown[]) {
	const seen: string[] = [];
	const stub: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => { seen.push(sql); return rows(sql) as T[]; },
		transaction: async (fn) => fn(stub),
	};
	return { store: stub, seen };
}

test('setTemplate: versioned write to the template table (subject/html/text)', async () => {
	const { setTemplate } = await import('../templates/admin');
	const { store, seen } = captureStore((sql) => (sql.includes('RETURNING') ? [{ type: 'email-verification', version: 2 }] : []));
	const row = await setTemplate(
		{ type: 'email-verification', subject: 'Verify', html: '<p>hi</p>', text: 'hi', actor: 'ada' },
		store,
	);
	assert.equal(row.version, 2);
	assert.ok(seen.some((s) => s.includes('fonderie_courier_templates') && s.includes('subject')));
	assert.ok(seen.some((s) => s.includes('INSERT INTO fonderie_courier_template_revisions')));
	assert.ok(seen.some((s) => s.includes("pg_notify('fonderie_courier_templates_changed'")));
});

test('setTemplate: stale ifVersion throws VersionConflictError', async () => {
	const { setTemplate } = await import('../templates/admin');
	const { VersionConflictError } = await import('@fonderie/store');
	const { store } = captureStore((sql) => (sql.includes('SELECT version') ? [{ version: 5 }] : []));
	await assert.rejects(
		() => setTemplate({ type: 'email-verification', text: 'x', ifVersion: 1 }, store),
		(e: unknown) => e instanceof VersionConflictError,
	);
});

test('listTemplateRevisions: null-safe key match (base locale)', async () => {
	const { listTemplateRevisions } = await import('../templates/admin');
	let sql = '';
	const { store } = captureStore((q) => { sql = q; return [{ version: 1 }]; });
	await listTemplateRevisions('email-verification', null, store);
	assert.match(sql, /locale IS NOT DISTINCT FROM \$2/);
	assert.match(sql, /FROM fonderie_courier_template_revisions/);
});

// ── Security/correctness: provider message id persisted (H7) ─────────────────
// The delivery webhooks above match on provider_message_id — but the send path
// never persisted it, so every delivered/opened/bounced UPDATE matched zero
// rows and delivery tracking was silently dead. The dispatcher must write the
// id a channel returns.

test('dispatcher: persists the providerMessageId a channel returns', async () => {
	const executed: { sql: string; params: unknown[] }[] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			executed.push({ sql, params: params ?? [] });
			if (sql.includes('INSERT INTO fonderie_message_log')) return [{ id: 'log-42' }] as T[];
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};

	const channel = {
		name: 'email',
		send: async () => ({ providerMessageId: 'prov-msg-9' }),
	};
	const dispatcher = new Dispatcher(
		{ channels: { 'password-reset': [Channel.EMAIL] } },
		makeResolver(),
		store,
	);
	dispatcher.registerChannel(channel);

	await dispatcher.dispatch({
		type: 'password-reset',
		recipient: { email: 'a@b.com', phone: null, deviceToken: null },
		data: {},
	});

	const providerUpdate = executed.find(
		(q) => q.sql.includes('provider_message_id') && q.sql.includes('UPDATE'),
	);
	assert.ok(providerUpdate, 'provider_message_id UPDATE must run');
	assert.deepEqual(providerUpdate!.params, ['log-42', 'prov-msg-9']);
});

test('dispatcher: a channel returning void still marks the message sent', async () => {
	const executed: string[] = [];
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			executed.push(sql);
			if (sql.includes('INSERT INTO fonderie_message_log')) return [{ id: 'log-1' }] as T[];
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	const channel = { name: 'email', send: async () => undefined };
	const dispatcher = new Dispatcher(
		{ channels: { 'password-reset': [Channel.EMAIL] } },
		makeResolver(),
		store,
	);
	dispatcher.registerChannel(channel);
	await dispatcher.dispatch({
		type: 'password-reset',
		recipient: { email: 'a@b.com', phone: null, deviceToken: null },
		data: {},
	});
	assert.ok(executed.some((s) => s.includes("status = 'sent'")), 'markMessageSent ran');
	assert.ok(
		!executed.some((s) => s.includes('provider_message_id') && s.includes('UPDATE')),
		'no provider-id UPDATE when the channel returned none',
	);
});

// ── Security: HTML injection in email templates (audit №2 H4) ────────
// {{var}} values are user-influenced (e.g. registration firstName). Unescaped
// interpolation let a user inject markup/links into platform-branded emails.

test('renderFragment: interpolated values are HTML-escaped in the html part, raw in text', async () => {
	const { renderFragment } = await import('../templates/resolver');
	const hostile = '<a href="https://evil.example">Reset now</a>';
	const out = renderFragment(
		{ subject: 'Hi {{firstName}}', text: 'Hi {{firstName}}', html: '<p>Hi {{firstName}}</p>' },
		undefined,
		{ firstName: hostile },
	);
	assert.ok(!out.html!.includes('<a href="https://evil.example">'), 'no raw injected markup in html');
	assert.ok(out.html!.includes('&lt;a href=&quot;https://evil.example&quot;&gt;'), 'entities escaped');
	assert.equal(out.text, `Hi ${hostile}`, 'text part is not an HTML context — stays raw');
	assert.equal(out.subject, `Hi ${hostile}`, 'subject is a header, not HTML — stays raw');
});

test('renderFragment: benign values render unchanged in html', async () => {
	const { renderFragment } = await import('../templates/resolver');
	const out = renderFragment(
		{ text: '{{n}} credits', html: '<b>{{n}} credits on {{plan}}</b>' },
		undefined,
		{ n: 3, plan: 'Pro' },
	);
	assert.ok(out.html!.includes('<b>3 credits on Pro</b>'));
});

test('delivery webhooks: stale signed timestamps are rejected (replay guard)', async () => {
	const { handleSendGridDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();
	const { generateKeyPairSync: gen, sign: sgn } = await import('node:crypto');
	const { publicKey, privateKey } = gen('ec', { namedCurve: 'P-256' });
	const publicKeyB64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
	const body = JSON.stringify([{ event: 'bounce', sg_message_id: 'replayed' }]);
	const staleTs = String(Math.floor(Date.now() / 1000) - 3600); // 1h old
	const signature = sgn('sha256', Buffer.from(staleTs + body), privateKey).toString('base64');
	const res = await handleSendGridDelivery(
		new Request('http://localhost/courier/delivery/sendgrid', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-twilio-email-event-webhook-signature': signature,
				'x-twilio-email-event-webhook-timestamp': staleTs,
			},
			body,
		}),
		stub,
		publicKeyB64,
	);
	assert.equal(res.status, 401, 'a validly-signed but stale payload must not replay');
	assert.equal(updates.length, 0);
});

// ── Audit-3 C3: Mailgun token replay is rejected within the window ──
test('handleMailgunDelivery: a replayed (timestamp,token,signature) is rejected', async () => {
	const { handleMailgunDelivery } = await import('../delivery');
	const { stub } = makeDeliveryStore();
	const signingKey = 'mg-key';
	const timestamp = String(Math.floor(Date.now() / 1000));
	const token = 'nonce-once';
	const signature = cryptoCreateHmac('sha256', signingKey).update(timestamp + token).digest('hex');
	const payload = {
		signature: { timestamp, token, signature },
		'event-data': { event: 'delivered', message: { headers: { 'message-id': 'mg-1' } } },
	};
	const mk = () => new Request('http://localhost/courier/delivery/mailgun', {
		method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
	});
	const first = await handleMailgunDelivery(mk(), stub, signingKey);
	assert.equal(first.status, 200, 'first delivery accepted');
	const replay = await handleMailgunDelivery(mk(), stub, signingKey);
	assert.equal(replay.status, 401, 'same token replayed → rejected');
});
