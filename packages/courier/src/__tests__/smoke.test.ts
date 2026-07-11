import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ICourierConfig } from '../config';
import type { ICourierChannel, ICourierMessage, ITemplateResolver } from '../types';
import type { IStoreAdapter } from '@fonderie/store';

import { Channel } from '../config';
import { Dispatcher } from '../dispatcher';
import { FSTemplateResolver } from '../templates/resolver';

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

test('handleSendGridDelivery: processes open event', async () => {
	const { handleSendGridDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();

	const payload = [{ event: 'open', sg_message_id: 'abc123.filterXxx' }];
	const req = new Request('http://localhost/courier/delivery/sendgrid', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
	});

	const res = await handleSendGridDelivery(req, stub);
	assert.equal(res.status, 200);
	assert.ok(updates.includes('abc123'));
});

test('handleSendGridDelivery: processes bounce event', async () => {
	const { handleSendGridDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();

	const payload = [{ event: 'bounce', sg_message_id: 'msg456', reason: 'Invalid address' }];
	const req = new Request('http://localhost/courier/delivery/sendgrid', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
	});

	const res = await handleSendGridDelivery(req, stub);
	assert.equal(res.status, 200);
	assert.ok(updates.includes('msg456'));
});

test('handleSendGridDelivery: skips events with no sg_message_id', async () => {
	const { handleSendGridDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();

	const payload = [{ event: 'open' }];
	const req = new Request('http://localhost/courier/delivery/sendgrid', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload),
	});

	const res = await handleSendGridDelivery(req, stub);
	assert.equal(res.status, 200);
	assert.equal(updates.length, 0);
});

test('handleMailgunDelivery: processes delivered event', async () => {
	const { handleMailgunDelivery } = await import('../delivery');
	const { stub, updates } = makeDeliveryStore();

	const payload = {
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

	const res = await handleMailgunDelivery(req, stub);
	assert.equal(res.status, 200);
	assert.ok(updates.includes('mg-msg-id-789'));
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
