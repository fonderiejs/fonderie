export function normalizeEmail(email: string): string {
	if (typeof email !== 'string' || email.length === 0) {
		throw new Error('Invalid email');
	}

	const lower = email.trim().toLowerCase();

	if (lower.length === 0) {
		throw new Error('Email cannot be empty');
	}

	const atIndex = lower.indexOf('@');
	if (atIndex === -1 || lower.lastIndexOf('@') !== atIndex) {
		throw new Error('Invalid email format');
	}

	const local  = lower.substring(0, atIndex);
	const domain = lower.substring(atIndex + 1);

	if (!local || !domain) {
		throw new Error('Invalid email format');
	}

	const plusIndex = local.indexOf('+');
	const normalizedLocal = plusIndex === -1 ? local : local.substring(0, plusIndex);

	if (!normalizedLocal) {
		throw new Error('Invalid email format');
	}

	return `${normalizedLocal}@${domain}`;
}

export function normalizeEmailSafe(email: string): string | null {
	try {
		return normalizeEmail(email);
	} catch {
		return null;
	}
}
