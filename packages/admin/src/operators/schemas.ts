import type { IRequestSchema } from '@fonderie/core/middlewares';

import { SCOPES } from '../tokens';

// Envelope validation for the operator routes: types, lengths, unknown keys
// stripped. The judgement calls that deserve their own message (password
// strength, email shape) stay in the handlers, which answer with a specific
// reason rather than a generic INVALID_PARAMETER.

type Field =
	| { type: 'string'; required?: boolean; max: number }
	| { type: 'boolean'; required?: boolean }
	| { type: 'integer'; required?: boolean; min: number; max: number }
	| { type: 'scopes'; required?: boolean };

function schema(fields: Record<string, Field>, opts: { oneOf?: string[] } = {}): IRequestSchema {
	return {
		safeParse(input: unknown) {
			const fail = (path: string, message: string) => ({
				success: false as const,
				error: { issues: [{ path: [path], message }] },
			});
			const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
			const out: Record<string, unknown> = {};
			for (const [key, f] of Object.entries(fields)) {
				const v = b[key];
				if (v === undefined || v === null) {
					if (f.required) return fail(key, `${key} is required`);
					continue;
				}
				if (f.type === 'string') {
					if (typeof v !== 'string' || v.length === 0 || v.length > f.max)
						return fail(key, `${key} must be a string of 1–${f.max} characters`);
				} else if (f.type === 'boolean') {
					if (typeof v !== 'boolean') return fail(key, `${key} must be true or false`);
				} else if (f.type === 'integer') {
					if (!Number.isInteger(v) || (v as number) < f.min || (v as number) > f.max)
						return fail(key, `${key} must be an integer ${f.min}–${f.max}`);
				} else if (!Array.isArray(v) || v.length === 0 || !v.every((s) => SCOPES.includes(s))) {
					return fail(key, `${key} must be a non-empty list of ${SCOPES.join(', ')}`);
				}
				out[key] = v;
			}
			if (opts.oneOf && !opts.oneOf.some((k) => out[k] !== undefined)) {
				return fail(opts.oneOf[0] ?? 'body', `one of ${opts.oneOf.join(', ')} is required`);
			}
			return { success: true as const, data: out };
		},
	};
}

const email = { type: 'string', required: true, max: 320 } as const;
const password = { type: 'string', required: true, max: 256 } as const;
const name = { type: 'string', max: 200 } as const;
const token = { type: 'string', required: true, max: 200 } as const;

export const claimSchema = schema({ email, password, name });
export const loginSchema = schema({ email, password });
export const enrollmentSchema = schema({ code: { type: 'string', required: true, max: 12 } });
export const factorSchema = schema(
	{ code: { type: 'string', max: 12 }, backupCode: { type: 'string', max: 32 } },
	{ oneOf: ['code', 'backupCode'] },
);
export const inspectLinkSchema = schema({ token });
export const redeemLinkSchema = schema({ token, password, name });
export const inviteSchema = schema({
	email,
	scopes: { type: 'scopes', required: true },
	expiresInHours: { type: 'integer', min: 1, max: 336 },
});
export const updateOperatorSchema = schema({
	scopes: { type: 'scopes' },
	name,
	disabled: { type: 'boolean' },
});
