import nodemailer from 'nodemailer';

import type { ICourierChannel, ICourierMessage, IRenderedTemplate, ISendResult } from '../types';
import type { IEmailChannelConfig } from '../config';

export class EmailChannel implements ICourierChannel {
	readonly name = 'email';
	private transport: ReturnType<typeof nodemailer.createTransport> | null = null;

	constructor(private config: IEmailChannelConfig) {
		if (config.provider === 'smtp' && config.smtp) {
			this.transport = nodemailer.createTransport({
				host: config.smtp.host,
				port: config.smtp.port,
				secure: config.smtp.secure,
				auth: { user: config.smtp.user, pass: config.smtp.pass },
			});
		}
	}

	async send(message: ICourierMessage, template: IRenderedTemplate): Promise<ISendResult | void> {
		const to = message.recipient.email;
		if (!to) {
			console.warn('[courier:email] no email address for recipient — skipping');
			return;
		}

		if (this.config.provider === 'resend') {
			return this.sendViaResend(to, template);
		}
		if (this.config.provider === 'smtp') {
			return this.sendViaSMTP(to, template);
		}
		console.warn(`[courier:email] provider ${this.config.provider} not implemented`);
	}

	private async sendViaResend(to: string, template: IRenderedTemplate): Promise<ISendResult> {
		if (!this.config.apiKey) {
			throw new Error('Resend apiKey is required');
		}

		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${this.config.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: this.config.from,
				to,
				subject: template.subject ?? '(no subject)',
				html: template.html,
				text: template.text,
			}),
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`[courier:email] Resend error ${res.status}: ${body}`);
		}

		// Resend returns { id } — persist it so delivery webhooks can correlate.
		const data = (await res.json().catch(() => null)) as { id?: string } | null;
		return typeof data?.id === 'string' ? { providerMessageId: data.id } : {};
	}

	private async sendViaSMTP(to: string, template: IRenderedTemplate): Promise<ISendResult> {
		if (!this.transport) {
			throw new Error('SMTP transport not initialised — check smtp config');
		}

		// Omit `html` when the template has none rather than passing `undefined`:
		// nodemailer 10's SendMailOptions is an exact-optional type, so an explicit
		// `html: undefined` is a type error (and was never meaningful at runtime).
		const info = await this.transport.sendMail({
			from: this.config.from,
			to,
			subject: template.subject ?? '(no subject)',
			text: template.text,
			...(template.html !== undefined ? { html: template.html } : {}),
		});

		// nodemailer reports the Message-ID as "<id@host>"; providers' delivery
		// events reference it WITHOUT the angle brackets (e.g. Mailgun's
		// message.headers.message-id) — strip them so the lookup matches.
		const raw = typeof info?.messageId === 'string' ? info.messageId : '';
		const providerMessageId = raw.replace(/^<|>$/g, '');
		return providerMessageId ? { providerMessageId } : {};
	}
}
