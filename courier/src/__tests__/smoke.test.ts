import { test } from 'node:test';
import assert   from 'node:assert/strict';

import type { ICourierConfig }  from '../config';
import type { ICourierChannel, ICourierMessage, IRenderedTemplate } from '../types';

import { Dispatcher }          from '../dispatcher';
import { FSTemplateResolver }  from '../templates/resolver';

// ── Stub channel ─────────────────────────────────────────────────

function makeChannel(name: string): ICourierChannel & { sent: ICourierMessage[] } {
	const sent: ICourierMessage[] = [];
	return {
		name,
		sent,
		async send(message) {
			sent.push(message);
		},
	}
}

// ── Stub resolver ────────────────────────────────────────────────

function makeResolver(): import('../types').TemplateResolver {
	return {
		async resolve(type, data) {
			return {
				subject: `Subject: ${type}`, 
				text: `Text: ${JSON.stringify(data)}`,
			}
		},
	}
}

// ── Dispatcher ───────────────────────────────────────────────────

test('dispatcher: sends to configured channel', async () => {
	const config: ICourierConfig = {
		channels: {
			'password-reset': ['email']
		},
	}

	const email      = makeChannel('email');
	const resolver   = makeResolver();

	const dispatcher = new Dispatcher(config, resolver);
	dispatcher.registerChannel(email);

	await dispatcher.dispatch({
		type:      'password-reset',
		recipient: { email: 'a@b.com', phone: null, deviceToken: null },
		data:      { token: 'abc123' },
	});

	assert.equal(email.sent.length, 1);
	assert.equal(email.sent[0]?.recipient.email, 'a@b.com');
});

test('dispatcher: sends to multiple channels', async () => {
	const config: ICourierConfig = {
		channels: {
			'workspace-invitation': ['email', 'sms']
		},
	}

	const email    = makeChannel('email');
	const sms      = makeChannel('sms');

	const resolver = makeResolver();

	const dispatcher = new Dispatcher(config, resolver);

	dispatcher.registerChannel(email);
	dispatcher.registerChannel(sms);

	await dispatcher.dispatch({
		type:      'workspace-invitation',
		recipient: {
			email: 'a@b.com', 
			phone: '+15551234567', 
			deviceToken: null
		},
		data: {
			pin: '123456'
		},
	});

	assert.equal(email.sent.length, 1);
	assert.equal(sms.sent.length,   1);
});

test('dispatcher: skips unconfigured message type', async () => {
	const config: ICourierConfig = {
		channels: {}
	}

	const email    = makeChannel('email');
	const resolver = makeResolver();

	const dispatcher = new Dispatcher(config, resolver);
	dispatcher.registerChannel(email);

	await dispatcher.dispatch({
		type:      'unknown-type',
		recipient: {
			email: 'a@b.com',
			phone: null, 
			deviceToken: null
		},
		data:      {},
	});

	assert.equal(email.sent.length, 0);
});

test('dispatcher: skips missing channel without throwing', async () => {
	const config: ICourierConfig = {
		channels: {
			'test-event': ['sms']
		},  // sms not registered
	}

	const resolver   = makeResolver();
	const dispatcher = new Dispatcher(config, resolver);

	// no channels registered
	await assert.doesNotReject(() =>
		dispatcher.dispatch({
			type:      'test-event',
			recipient: { email: null, phone: '+15551234567', deviceToken: null },
			data:      {},
		})
	);
});

// ── FSTemplateResolver ───────────────────────────────────────────

test('FSTemplateResolver: falls back to JSON when template file missing', async () => {
	const resolver = new FSTemplateResolver('/tmp/nonexistent-templates');
	const result   = await resolver.resolve('some-type', { key: 'value' });
	assert.ok(result.text.includes('some-type'));
});

// ── ICourierMessage type ──────────────────────────────────────────

test('ICourierMessage: shape is correct', () => {
	const message: ICourierMessage = {
		type:      'password-reset',
		recipient: { email: 'a@b.com', phone: null, deviceToken: null },
		data:      { token: 'abc' },
	};

	assert.equal(message.type, 'password-reset');
	assert.equal(message.recipient.email, 'a@b.com');
	assert.equal(message.recipient.phone, null);
});

// ── CourierModule shape ──────────────────────────────────────────

test('CourierModule: satisfies IFonderieModule interface', async () => {
	const { CourierModule } = await import('../module');

	const mod = new CourierModule(
		{
			channels: {}, 
			templates: {
				source: 'fs', 
				directory: '/tmp'
			}
		},
	);

	assert.equal(mod.name, '@fonderie-js/courier');
	assert.ok(typeof mod.install    === 'function');
	assert.ok(typeof mod.dispatcher === 'object');
});
