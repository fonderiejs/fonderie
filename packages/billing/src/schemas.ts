import { z } from 'zod';

// Request schemas — the validation contract for billing's body-taking routes
// (webhook excluded: provider-shaped, signature-verified in the handler).
// Wired via @fonderie/core's validate(); same pattern as @fonderie/auth.

const planFields = {
	description: z.string().max(2000).nullable().optional(),
	tier: z.number().int().min(0).optional(),
	seats: z.number().int().min(0).nullable().optional(),
	trialDays: z.number().int().min(0).optional(),
	monthlyAmount: z.number().min(0).nullable().optional(),
	monthlyPriceId: z.string().max(200).nullable().optional(),
	yearlyAmount: z.number().min(0).nullable().optional(),
	yearlyPriceId: z.string().max(200).nullable().optional(),
	features: z.unknown().optional(),
	metadata: z.unknown().optional(),
};

export const createPlanSchema = z.object({
	name: z.string().trim().min(1, 'name is required').max(200),
	...planFields,
});

export const updatePlanSchema = z
	.object({ name: z.string().trim().min(1).max(200).optional(), ...planFields })
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');

export const checkoutSchema = z.object({
	plan: z.string().min(1, 'plan is required'),
	interval: z.enum(['month', 'year']).optional(),
});

export const recordUsageSchema = z.object({
	metric: z.string().min(1, 'metric is required').max(100),
	quantity: z.number().min(0).optional(),
});

// Wallet amounts are bigint on the server; the wire carries them as digit
// strings (JSON numbers accepted too, for small hand-written requests).
const walletAmount = z
	.union([
		z.string().regex(/^\d{1,30}$/, 'amount must be a positive integer string'),
		// JSON numbers past 2^53 arrive already rounded — force the digit-string
		// form for anything larger instead of silently granting a wrong amount.
		z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
	])
	.transform((v) => BigInt(v))
	.refine((v) => v > 0n, 'amount must be positive');

export const walletCheckoutSchema = z.object({
	packId: z.string().trim().min(1, 'packId is required').max(100),
});

export const grantWalletSchema = z.object({
	subscriberType: z.enum(['user', 'workspace']),
	subscriberId: z.string().uuid('subscriberId must be a UUID'),
	amount: walletAmount,
	currency: z.string().trim().min(3).max(20).optional(),
	description: z.string().max(500).optional(),
	idempotencyKey: z.string().min(1, 'idempotencyKey is required').max(255),
});
