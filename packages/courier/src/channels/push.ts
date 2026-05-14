import type { IPushChannelConfig } from '../config';
import type { ICourierChannel, ICourierMessage, IRenderedTemplate } from '../types';

export class PushChannel implements ICourierChannel {
	readonly name = 'push';

	constructor(private config: IPushChannelConfig) {}

	async send(message: ICourierMessage, template: IRenderedTemplate): Promise<void> {
		const token = message.recipient.deviceToken;
		if (!token) {
			console.warn('[courier:push] no device token for recipient — skipping');
			return;
		}

		if (this.config.provider === 'fcm') {
			await this.sendViaFCM(token, template);
		}
	}

	private async sendViaFCM(token: string, template: IRenderedTemplate): Promise<void> {
		const apiKey = this.config.serviceAccount['apiKey'] as string | undefined;
		if (!apiKey) {
			throw new Error('[courier:push] FCM apiKey is required in serviceAccount');
		}

		const res = await fetch('https://fcm.googleapis.com/fcm/send', {
			method: 'POST',
			headers: {
				Authorization: `key=${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				to: token,
				notification: {
					title: template.subject,
					body: template.text,
				},
			}),
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`[courier:push] FCM error ${res.status}: ${body}`);
		}
	}
}
