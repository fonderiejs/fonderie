import { COURIER_FORMAT_KEY, type ICourierFormatValue } from '@fonderie/core';

/**
 * Format the values a message marked under `$format` in the reader's language,
 * replacing the plain-string versions the sender sent under the same keys.
 * `$format` itself is dropped. Anything that cannot be formatted keeps the
 * sender's string — a notification must never fail over a format.
 */
export function applyFormats(data: Record<string, unknown>, locale: string): Record<string, unknown> {
	const formats = data[COURIER_FORMAT_KEY] as Record<string, ICourierFormatValue> | undefined;
	if (!formats || typeof formats !== 'object') return data;
	const out: Record<string, unknown> = { ...data };
	delete out[COURIER_FORMAT_KEY];
	for (const [key, value] of Object.entries(formats)) {
		const formatted = formatOne(value, locale);
		if (formatted !== undefined) out[key] = formatted;
	}
	return out;
}

function formatOne(value: ICourierFormatValue, locale: string): string | undefined {
	try {
		if ('money' in value) {
			const { amount, currency, precision } = value.money;
			const major = Number(amount) / 10 ** precision;
			if (!Number.isFinite(major)) return undefined;
			try {
				return new Intl.NumberFormat(locale, {
					style: 'currency',
					currency,
					minimumFractionDigits: precision,
					maximumFractionDigits: precision,
				}).format(major);
			} catch {
				// Not an ISO currency (a credits wallet's 'CREDITS'): the number in the
				// reader's style, then the unit.
				const n = new Intl.NumberFormat(locale, { minimumFractionDigits: precision, maximumFractionDigits: precision }).format(major);
				return `${n} ${currency}`;
			}
		}
		if ('date' in value) {
			const d = new Date(value.date);
			if (Number.isNaN(d.getTime())) return undefined;
			return new Intl.DateTimeFormat(locale, { dateStyle: value.style ?? 'long' }).format(d);
		}
	} catch {
		return undefined;
	}
	return undefined;
}
