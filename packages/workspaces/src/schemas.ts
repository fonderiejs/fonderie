import { z } from 'zod';

// Request schemas — the validation contract for every body-taking workspaces
// route. Wired into routes.ts via @fonderie/core's validate(); exported so
// docs generators and typed clients read the source of truth the runtime
// enforces. Same pattern as @fonderie/auth/src/schemas.ts.

const name = z.string().trim().min(1, 'name is required').max(200);
const email = z.string().trim().pipe(z.email());

export const createWorkspaceSchema = z.object({
	name,
	description: z.string().max(2000).optional(),
	// PERSONAL workspaces are created automatically by the module; the
	// controller enforces the rule — schema just types the field.
	type: z.string().max(40).optional(),
});

const addressSchema = z
	.object({
		line1: z.string().max(200).optional(),
		line2: z.string().max(200).optional(),
		city: z.string().max(100).optional(),
		region: z.string().max(100).optional(),
		postalCode: z.string().max(20).optional(),
		country: z.string().max(60).optional(),
	})
	.passthrough();

export const updateWorkspaceSchema = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		description: z.string().max(2000).nullable().optional(),
		motto: z.string().max(300).nullable().optional(),
		phone: z.string().max(32).nullable().optional(),
		businessType: z.string().max(100).nullable().optional(),
		address: addressSchema.nullable().optional(),
	})
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');

export const updateSettingsSchema = z
	.object({
		locale: z.string().max(35).optional(),
		timezone: z.string().max(64).optional(),
		currency: z.string().max(8).optional(),
		dateFormat: z.string().max(32).optional(),
		timeFormat: z.string().max(32).optional(),
	})
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'No settings provided');

export const addMemberRoleSchema = z.object({ roleId: z.string().min(1, 'roleId is required') });

const inviteEntry = z.object({
	email,
	roleId: z.string().min(1).optional(),
});

// POST /workspaces/invitations accepts a single invite or a batch.
export const createInvitationsSchema = z.union([
	inviteEntry,
	z.array(inviteEntry).min(1, 'at least one invite is required'),
]);

export const acceptInvitationSchema = z.object({ pin: z.string().trim().min(1, 'pin is required') });

export const createRoleSchema = z.object({
	name,
	description: z.string().max(1000).optional(),
});

export const updateRoleSchema = z
	.object({
		name: z.string().trim().min(1).max(200).optional(),
		description: z.string().max(1000).nullable().optional(),
		active: z.boolean().optional(),
	})
	.refine((o) => Object.values(o).some((v) => v !== undefined), 'Provide at least one field');

export const setRolePermissionsSchema = z.object({
	permissions: z.array(
		z.object({
			permissionKey: z.string().min(1),
			canCreate: z.boolean().optional(),
			canRead: z.boolean().optional(),
			canUpdate: z.boolean().optional(),
			canDelete: z.boolean().optional(),
		}),
	),
});
