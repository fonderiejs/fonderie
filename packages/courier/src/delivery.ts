import { createHmac, timingSafeEqual } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie/store';
import {
	markMessageDelivered,
	markMessageOpened,
	markMessageClicked,
	markMessageBounced,
} from './log';

// ── SendGrid ──────────────────────────────────────────────────────
//
// Verifies the X-Twilio-Email-Event-Webhook-Signature header.
// Expects an array of event objects in the request body.
// https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features

export async function handleSendGridDelivery(
	req: Request,
	store: IStoreAdapter,
	webhookSecret?: string,
): Promise<Response> {
	if (webhookSecret) {
		const sig = req.headers.get('x-twilio-email-event-webhook-signature') ?? '';
		const ts  = req.headers.get('x-twilio-email-event-webhook-timestamp') ?? '';
		const body = await req.text();

		if (!verifySendGridSignature(webhookSecret, ts, body, sig)) {
			return Response.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
		}

		const events = parseJson(body) as SendGridEvent[] | null;
		if (!Array.isArray(events)) return Response.json({ ok: true });

		await processSendGridEvents(events, store);
		return Response.json({ ok: true });
	}

	const events = (await req.json()) as SendGridEvent[];
	if (!Array.isArray(events)) return Response.json({ ok: true });

	await processSendGridEvents(events, store);
	return Response.json({ ok: true });
}

function verifySendGridSignature(
	secret: string,
	timestamp: string,
	body: string,
	signature: string,
): boolean {
	try {
		const payload = timestamp + body;
		const expected = createHmac('sha256', secret).update(payload).digest('base64');
		const sigBuf = Buffer.from(signature, 'base64');
		const expBuf = Buffer.from(expected, 'base64');
		if (sigBuf.length !== expBuf.length) return false;
		return timingSafeEqual(sigBuf, expBuf);
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
	const body = (await req.json()) as MailgunPayload;

	if (signingKey) {
		const { signature } = body;
		if (!signature || !verifyMailgunSignature(signingKey, signature.timestamp, signature.token, signature.signature)) {
			return Response.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
		}
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
		const expBuf = Buffer.from(expected, 'hex');
		const sigBuf = Buffer.from(signature, 'hex');
		if (expBuf.length !== sigBuf.length) return false;
		return timingSafeEqual(expBuf, sigBuf);
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

// ── Mailtrap (testing only, no signature) ────────────────────────

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
