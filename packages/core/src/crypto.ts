import { timingSafeEqual } from 'node:crypto';

// The one timing-attack-safe equality across Fonderie — admin tokens (billing/
// config/courier), MFA/TOTP codes (auth), event-log + inbound webhook-signature
// HMACs (events/courier). Length-guard first: timingSafeEqual throws on unequal
// lengths, and the length is not the secret. Accepts strings or Buffers (callers
// comparing decoded signature bytes pass Buffers).
export function constantTimeEqual(a: string | Buffer, b: string | Buffer): boolean {
	const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a);
	const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
}
