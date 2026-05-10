export function checkCooldown(lastSentAt: Date | null, cooldownMs: number): number {
	if (!lastSentAt) return 0;
	return Math.max(0, cooldownMs - (Date.now() - lastSentAt.getTime()));
}
