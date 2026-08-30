/**
 * Checks the bodies this backend sends to Fonderie against Fonderie's own
 * validators.
 *
 * Routing tests prove an endpoint exists. They cannot tell you the payload is
 * right, and a wrong one fails in the worst possible way: Zod strips unknown
 * keys, so sending `roleName` where `roleId` is expected produces a 200 with
 * the role silently dropped. The invitation succeeds and the person joins with
 * no permissions.
 *
 * These are the real schemas, imported from the package. No database.
 */

import { strict as assert } from 'node:assert';
import { test }             from 'node:test';
import { schemas }          from '@fonderie/workspaces';

const ROLE_ID = '11111111-1111-1111-1111-111111111111';

test('the invitation body satisfies createInvitationsSchema', () => {
	// What starter.routes.ts sends for POST /members/invitations.
	const body = { email: 'teammate@example.com', roleId: ROLE_ID };

	const parsed = schemas.createInvitationsSchema.safeParse(body);
	assert.ok(parsed.success, `rejected: ${JSON.stringify(parsed.error?.issues)}`);
});

test('a role NAME is not accepted in place of an id', () => {
	// The bug this file exists to prevent. Zod strips the unknown key rather
	// than failing, so the invite is created with no role at all.
	const wrong = { email: 'teammate@example.com', roleName: 'admin' };

	const parsed = schemas.createInvitationsSchema.safeParse(wrong);
	assert.ok(parsed.success, 'schema unexpectedly rejects — update this test');
	assert.equal(
		(parsed.data as Record<string, unknown>)['roleId'],
		undefined,
		'roleName silently produces an invitation with no role',
	);
});

test('the role-change body satisfies addMemberRoleSchema', () => {
	// What starter.routes.ts sends for PATCH /members/:id.
	const parsed = schemas.addMemberRoleSchema.safeParse({ roleId: ROLE_ID });
	assert.ok(parsed.success, `rejected: ${JSON.stringify(parsed.error?.issues)}`);

	// And the wrong shape must fail outright, which is how this one surfaced.
	assert.equal(schemas.addMemberRoleSchema.safeParse({ roleName: 'admin' }).success, false);
});

test('the organization update body satisfies updateWorkspaceSchema', () => {
	// What starter.routes.ts forwards for PATCH /organization.
	assert.ok(schemas.updateWorkspaceSchema.safeParse({ name: 'Acme' }).success);
	assert.ok(schemas.updateWorkspaceSchema.safeParse({ description: 'Hello' }).success);
});

test('a body of only unsupported fields is rejected, which is why we filter', () => {
	// A workspace has no logo, so forwarding { logoUrl } unfiltered would strip
	// every key and fail the "provide at least one field" rule.
	const parsed = schemas.updateWorkspaceSchema.safeParse({ logoUrl: 'https://x/y.png' });
	assert.equal(parsed.success, false, 'if this passes, the filter in /organization can be dropped');
});
