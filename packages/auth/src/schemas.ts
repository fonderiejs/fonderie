import { z } from 'zod';

// Request schemas — the validation contract for every body-taking auth route.
// Wired into routes.ts via validate(); exported so docs generators and typed
// clients read the same source of truth the runtime enforces.
//
// Passwords are capped at 128 chars: bcrypt truncates at 72 bytes anyway, and
// an explicit cap stops oversized inputs from reaching the hash function.

const email = z.string().trim().pipe(z.email());
const password = z.string().min(8, 'password must be at least 8 characters').max(128);
// E.164-ish, tolerant of spaces/dashes/parens — controllers normalize further.
const phone = z
	.string()
	.refine((v) => /^\+?[1-9]\d{6,14}$/.test(v.replace(/[\s\-()]/g, '')), 'Invalid phone number');
const sixDigitPin = z
	.string()
	.trim()
	.regex(/^\d{6}$/, 'must be a 6-digit code');

export const registerSchema = z.union([
	z.object({
		email,
		password,
		firstName: z.string().max(100).nullish(),
		lastName: z.string().max(100).nullish(),
	}),
	z.object({ phone }),
]);

export const loginSchema = z.union([
	z.object({ email, password: z.string().min(1).max(128) }),
	z.object({ phone }),
]);

// Native Sign in with Apple: the iOS app posts the identityToken it got from
// the native Apple sheet. Bounded length — it's a JWT, never megabytes.
export const appleNativeSchema = z.object({
	identityToken: z.string().min(1).max(8192),
	// Optional nonce the app bound to the native request; when present we check
	// it against the token's `nonce` claim to defend against replay.
	nonce: z.string().max(256).optional(),
});

// refreshToken may come from the body or the refresh_token cookie.
export const refreshSchema = z.object({ refreshToken: z.string().min(1).optional() });

export const forgotPasswordSchema = z.object({ email });

// Reset by the 6-digit pin (typed from the email; route is IP-rate-limited)
// or by the high-entropy token (from the email's reset link; not
// brute-forceable, so it needs no rate limit).
export const resetPasswordSchema = z.union([
	z.object({ pin: sixDigitPin, password }),
	z.object({ token: z.string().trim().min(32, 'invalid reset token'), password }),
]);

export const verifySchema = z.object({ token: sixDigitPin });

export const updateProfileSchema = z
	.object({
		firstName: z.string().max(100).nullable().optional(),
		lastName: z.string().max(100).nullable().optional(),
		avatarUrl: z.string().trim().pipe(z.url()).nullable().optional(),
	})
	.refine(
		(o) => Object.values(o).some((v) => v !== undefined),
		'Provide at least one of: firstName, lastName, avatarUrl',
	);

export const updatePreferencesSchema = z
	.object({
		locale: z.string().max(35).optional(),
		timezone: z.string().max(64).optional(),
		// Typed at last — these four accepted `unknown`, letting null and
		// arbitrary JSON into stored preferences that the user DTO then served
		// against string-typed client fields.
		notifications: z
			.object({
				email: z.boolean().optional(),
				inApp: z.boolean().optional(),
				sms: z.boolean().optional(),
				push: z.boolean().optional(),
			})
			.optional(),
		emailDigest: z.string().max(20).optional(),
		dateFormat: z.string().max(30).optional(),
		timeFormat: z.string().max(30).optional(),
	})
	.refine(
		(o) => Object.values(o).some((v) => v !== undefined),
		'Provide at least one preference field',
	);

export const updateEmailSchema = z.object({ email });

export const updatePhoneSchema = z.object({ phone });

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1).max(128),
	newPassword: password,
});

// TOTP or backup code — verify/disable accept either; both are short strings.
export const mfaTokenSchema = z.object({ token: z.string().trim().min(6).max(64) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
