import { createHmac, randomBytes } from 'node:crypto';

export function generateSecret(): string {
	return randomBytes(32).toString('hex');
}

export function signPayload(secret: string, body: string): string {
	return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}
