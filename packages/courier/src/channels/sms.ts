import type { ISmsChannelConfig } from '../config';
import type { ICourierChannel, ICourierMessage, IRenderedTemplate } from '../types';

export class SmsChannel implements ICourierChannel {
	readonly name = 'sms';

	constructor(private config: ISmsChannelConfig) {}

	async send(message: ICourierMessage, template: IRenderedTemplate): Promise<void> {
		const to = message.recipient.phone;
		if (!to) {
			console.warn('[courier:sms] no phone number for recipient — skipping');
			return;
		}

		if (this.config.provider === 'twilio') {
			await this.sendViaTwilio(to, template.text);
		} else if (this.config.provider === 'vonage') {
			await this.sendViaVonage(to, template.text);
		} else {
			console.warn(`[courier:sms] provider ${this.config.provider} not implemented`);
		}
	}

	private async sendViaTwilio(to: string, text: string): Promise<void> {
		const { accountSid, authToken } = this.config;
		if (!accountSid || !authToken) {
			throw new Error('Twilio accountSid and authToken required');
		}

		const res = await fetch(
			`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
			{
				method: 'POST',
				headers: {
					Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({ From: this.config.from, To: to, Body: text }),
			},
		);

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`[courier:sms] Twilio error ${res.status}: ${body}`);
		}
	}

	private async sendViaVonage(to: string, text: string): Promise<void> {
		const { apiKey, apiSecret } = this.config;
		if (!apiKey || !apiSecret) {
			throw new Error('Vonage apiKey and apiSecret required');
		}

		const res = await fetch('https://rest.nexmo.com/sms/json', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				api_key: apiKey,
				api_secret: apiSecret,
				from: this.config.from,
				to,
				text,
			}),
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`[courier:sms] Vonage error ${res.status}: ${body}`);
		}
	}
}
