// Reply-To, for the case that makes it necessary.
//
// Sending from a dedicated subdomain (email.example.com) isolates sending
// reputation from the apex — but that subdomain has no MX, so a reply to the
// From address BOUNCES. Recipients do reply to transactional mail, and a bounced
// reply is worse than no reply: the sender believes they reached you.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailChannel } from '../channels/email';

const template = { subject: 'Receipt', text: 'thanks', html: '<p>thanks</p>' };

/** Capture the body of the Resend API call without sending anything. */
async function captureResendBody(config: Record<string, unknown>) {
	const original = globalThis.fetch;
	let captured: Record<string, unknown> = {};
	globalThis.fetch = (async (_url: string, init: { body: string }) => {
		captured = JSON.parse(init.body);
		return { ok: true, json: async () => ({ id: 'x' }) } as never;
	}) as never;
	try {
		const message = { type: 'test', recipient: { email: 'user@example.com' }, data: {} };
		await new EmailChannel(config as never).send(message as never, template as never);
	} finally {
		globalThis.fetch = original;
	}
	return captured;
}

test('replyTo is sent to Resend as reply_to when configured', async () => {
	const body = await captureResendBody({
		provider: 'resend',
		apiKey: 'k',
		from: 'LeadEasyGen <hello@email.example.com>',
		replyTo: 'hello@example.com',
	});
	assert.equal(body['from'], 'LeadEasyGen <hello@email.example.com>');
	assert.equal(body['reply_to'], 'hello@example.com', 'Resend expects snake_case reply_to');
});

test('the field is OMITTED entirely when unset, not sent as undefined', async () => {
	// An explicit null/undefined in the JSON body is a different thing to the API
	// than an absent key, and providers have rejected the former.
	const body = await captureResendBody({
		provider: 'resend',
		apiKey: 'k',
		from: 'LeadEasyGen <hello@example.com>',
	});
	assert.ok(!('reply_to' in body), 'absent config must produce no reply_to key at all');
});

test('From is never silently replaced by replyTo', async () => {
	// The two are different headers with different jobs: From carries the
	// authenticated sending identity (and DKIM alignment), replyTo only routes
	// human replies. Conflating them would break DMARC alignment.
	const body = await captureResendBody({
		provider: 'resend',
		apiKey: 'k',
		from: 'LeadEasyGen <hello@email.example.com>',
		replyTo: 'hello@example.com',
	});
	assert.notEqual(body['from'], body['reply_to']);
	assert.match(String(body['from']), /@email\.example\.com/, 'From stays on the sending subdomain');
});
