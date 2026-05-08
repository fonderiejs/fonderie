import nodemailer                                                    from 'nodemailer';

import type { ICourierChannel, ICourierMessage, IRenderedTemplate }  from '../types';
import type { IEmailChannelConfig }                                  from '../config';

export class EmailChannel implements ICourierChannel {
	readonly name = 'email';

	constructor(private config: IEmailChannelConfig) {}

	async send(message: ICourierMessage, template: IRenderedTemplate): Promise<void> {
		const to = message.recipient.email;
		if (!to) {
			console.warn('[courier:email] no email address for recipient — skipping');
			return
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
			method:  'POST',
			headers: {
				'Authorization': `Bearer ${this.config.apiKey}`,
				'Content-Type':  'application/json',
			},
			body: JSON.stringify({
				from:    this.config.from,
				to,
				subject: template.subject ?? '(no subject)',
				html:    template.html,
				text:    template.text,
			}),
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`[courier:email] Resend error ${res.status}: ${body}`);
		}
	}

	private async sendViaSMTP(to: string, template: IRenderedTemplate): Promise<void> {
		const smtp = this.config.smtp
		if (!smtp) {
			throw new Error('SMTP config is required');
		}

		const transport = nodemailer.createTransport({
			host:   smtp.host,
			port:   smtp.port,
			secure: smtp.secure,
			auth:   { user: smtp.user, pass: smtp.pass },
		})

		await transport.sendMail({
			from:    this.config.from,
			to,
			subject: template.subject ?? '(no subject)',
			html:    template.html,
			text:    template.text,
		});
	}
}
