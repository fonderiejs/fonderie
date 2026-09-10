import { createHmac, createPublicKey, verify as cryptoVerify } from 'node:crypto';

import { constantTimeEqual } from '@fonderie/core';

import type { IStoreAdapter } from '@fonderie/store';
import {
	markMessageDelivered,
	markMessageOpened,
	markMessageClicked,
	markMessageBounced,
} from './log';

// Delivery webhooks are FAIL-CLOSED: every handler requires its verification
// key and rejects unverified payloads with 401. Without verification, anyone
// who finds the endpoint can forge delivered/opened/bounced events — poisoning
// the message log and (via bounce handling) suppressing real mail. The module
// additionally only registers a delivery route when its key is configured.

// ── SendGrid ──────────────────────────────────────────────────────
//
// Verifies the X-Twilio-Email-Event-Webhook-Signature header. SendGrid signs
// with ECDSA (P-256 over `timestamp + body`, base64 DER signature) — NOT HMAC;
// `publicKey` is the base64 "Verification Key" from the SendGrid dashboard.
// Expects an array of event objects in the request body.
// https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/getting-started-event-webhook-security-features

export async function handleSendGridDelivery(
	req: Request,
	store: IStoreAdapter,
	publicKey?: string,
): Promise<Response> {
	if (!publicKey) {
		return Response.json({ error: 'VERIFICATION_NOT_CONFIGURED' }, { status: 401 });
	}

	const sig = req.headers.get('x-twilio-email-event-webhook-signature') ?? '';
	const ts  = req.headers.get('x-twilio-email-event-webhook-timestamp') ?? '';
	const body = await req.text();

	if (!verifySendGridSignature(publicKey, ts, body, sig)) {
		return Response.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
	}

	const events = parseJson(body) as SendGridEvent[] | null;
	if (!Array.isArray(events)) return Response.json({ ok: true });

	await processSendGridEvents(events, store);
	return Response.json({ ok: true });
}

function verifySendGridSignature(
	publicKeyB64: string,
	timestamp: string,
	body: string,
	signature: string,
): boolean {
	try {
		const key = createPublicKey({
			key: Buffer.from(publicKeyB64, 'base64'),
			format: 'der',
			type: 'spki',
		});
		return cryptoVerify(
			'sha256',
			Buffer.from(timestamp + body),
			key,
			Buffer.from(signature, 'base64'),
		);
	} catch {
		return false;
	}
}

interface SendGridEvent {
	event: string;
	sg_message_id?: string;
	reason?: string;
	[key: string]: unknown;
}

async function processSendGridEvents(
	events: SendGridEvent[],
	store: IStoreAdapter,
): Promise<void> {
	for (const ev of events) {
		const msgId = ev['sg_message_id'];
		if (!msgId || typeof msgId !== 'string') continue;
		// sg_message_id is "msgId.filterXxx" — strip the filter suffix
		const id = msgId.split('.')[0] ?? msgId;

		switch (ev.event) {
			case 'delivered': await markMessageDelivered(id, store); break;
			case 'open':      await markMessageOpened(id, store); break;
			case 'click':     await markMessageClicked(id, store); break;
			case 'bounce':
			case 'blocked':
			case 'dropped':
				await markMessageBounced(id, typeof ev['reason'] === 'string' ? ev['reason'] : ev.event, store);
				break;
		}
	}
}

// ── Mailgun ───────────────────────────────────────────────────────
//
// Verifies signature using token + timestamp + signing key (HMAC-SHA256).
// https://documentation.mailgun.com/docs/mailgun/user-manual/tracking-messages/#securing-webhooks

export async function handleMailgunDelivery(
	req: Request,
	store: IStoreAdapter,
	signingKey?: string,
): Promise<Response> {
	if (!signingKey) {
		return Response.json({ error: 'VERIFICATION_NOT_CONFIGURED' }, { status: 401 });
	}

	const body = (await req.json()) as MailgunPayload;

	const { signature } = body;
	if (!signature || !verifyMailgunSignature(signingKey, signature.timestamp, signature.token, signature.signature)) {
		return Response.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
	}

	const event = body['event-data'];
	if (event) {
		await processMailgunEvent(event, store);
	}

	return Response.json({ ok: true });
}

function verifyMailgunSignature(
	signingKey: string,
	timestamp: string,
	token: string,
	signature: string,
): boolean {
	try {
		const value = timestamp + token;
		const expected = createHmac('sha256', signingKey).update(value).digest('hex');
		return constantTimeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
	} catch {
		return false;
	}
}

interface MailgunPayload {
	signature?: { timestamp: string; token: string; signature: string };
	'event-data'?: MailgunEvent;
	[key: string]: unknown;
}

interface MailgunEvent {
	event: string;
	message?: { headers?: { 'message-id'?: string } };
	'delivery-status'?: { message?: string };
	[key: string]: unknown;
}

async function processMailgunEvent(event: MailgunEvent, store: IStoreAdapter): Promise<void> {
	const msgId = event.message?.headers?.['message-id'];
	if (!msgId) return;

	switch (event.event) {
		case 'delivered': await markMessageDelivered(msgId, store); break;
		case 'opened':    await markMessageOpened(msgId, store); break;
		case 'clicked':   await markMessageClicked(msgId, store); break;
		case 'failed':
		case 'bounced': {
			const reason = event['delivery-status']?.message ?? event.event;
			await markMessageBounced(msgId, reason, store);
			break;
		}
	}
}

// ── Mailtrap (testing only — has NO signature scheme) ────────────
//
// Registered only when config.delivery.allowUnverifiedMailtrap is explicitly
// true: with no signature to verify, the route accepts forged events by
// construction, so it must be a deliberate dev/test opt-in, never a default.

export async function handleMailtrapDelivery(
	req: Request,
	store: IStoreAdapter,
): Promise<Response> {
	const events = (await req.json()) as MailtrapEvent[];
	if (!Array.isArray(events)) return Response.json({ ok: true });

	for (const ev of events) {
		const msgId = ev.message_id;
		if (!msgId) continue;

		switch (ev.event) {
			case 'delivery': await markMessageDelivered(msgId, store); break;
			case 'open':     await markMessageOpened(msgId, store); break;
			case 'click':    await markMessageClicked(msgId, store); break;
			case 'bounce':
			case 'soft_bounce':
				await markMessageBounced(msgId, ev.event, store);
				break;
		}
	}

	return Response.json({ ok: true });
}

interface MailtrapEvent {
	event: string;
	message_id?: string;
	[key: string]: unknown;
}

// ── Utility ───────────────────────────────────────────────────────

function parseJson(text: string): unknown {
	try { return JSON.parse(text); } catch { return null; }
}
