import nodemailer from 'nodemailer';

import type { ICourierChannel, ICourierMessage, IRenderedTemplate } from '../types';
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

	async send(message: ICourierMessage, template: IRenderedTemplate): Promise<void> {
		const to = message.recipient.email;
		if (!to) {
			console.warn('[courier:email] no email address for recipient — skipping');
			return;
		}

		if (this.config.provider === 'resend') {
			await this.sendViaResend(to, template);
		} else if (this.config.provider === 'smtp') {
			await this.sendViaSMTP(to, template);
		} else {
			console.warn(`[courier:email] provider ${this.config.provider} not implemented`);
		}
	}

	private async sendViaResend(to: string, template: IRenderedTemplate): Promise<void> {
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
	}

	private async sendViaSMTP(to: string, template: IRenderedTemplate): Promise<void> {
		if (!this.transport) {
			throw new Error('SMTP transport not initialised — check smtp config');
		}

		// Omit `html` when the template has none rather than passing `undefined`:
		// nodemailer 10's SendMailOptions is an exact-optional type, so an explicit
		// `html: undefined` is a type error (and was never meaningful at runtime).
		await this.transport.sendMail({
			from: this.config.from,
			to,
			subject: template.subject ?? '(no subject)',
			text: template.text,
			...(template.html !== undefined ? { html: template.html } : {}),
		});
	}
}
