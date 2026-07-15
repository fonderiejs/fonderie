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
