import { z } from 'zod';

// Request schemas — the validation contract for webhooks' body-taking routes.
// Wired via @fonderie/core's validate(); same pattern as @fonderie/auth.

const url = z.string().trim().pipe(z.url());
const events = z.array(z.string().min(1).max(200)).max(100);

export const createEndpointSchema = z.object({
	url,
	events: events.optional(),
});

export const updateEndpointSchema = z
	.object({
		url: url.optional(),
		events: events.optional(),
		enabled: z.boolean().optional(),
	})
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');
