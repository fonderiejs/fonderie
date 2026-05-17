export function stringOrEmpty(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

export function booleanOrFalse(value: unknown): boolean {
	if (typeof value === 'boolean') return value;
	if (value === 'true' || value === '1') return true;
	return false;
}

export function arrayOrEmpty<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : [];
}

export function numberOrZero(value: unknown): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

export function dateOrEmpty(value: unknown): string {
	if (typeof value === 'string') return value;
	if (value instanceof Date) return value.toISOString();
	return '';
}
