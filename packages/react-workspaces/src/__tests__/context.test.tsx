import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import type { IUseRolePermissionsReturn } from '../hooks';
import { useCreateWorkspace, useMemberRoles, useRolePermissions, useWorkspaces } from '../hooks';

const fakeWorkspaces = { marker: 'context-workspaces' } as unknown as WorkspacesClient;
const fakeClient = { workspaces: fakeWorkspaces } as unknown as FonderieClient;

function Probe({ run }: { run: () => void }) {
	run();
	return null;
}

function renderWithProvider(run: () => void) {
	return renderToString(
		createElement(FonderieProvider, { client: fakeClient }, createElement(Probe, { run })),
	);
}

test('hooks resolve the workspaces client from context', () => {
	let returned: unknown;
	renderWithProvider(() => {
		returned = useWorkspaces();
	});
	const shape = returned as { workspaces: unknown[]; isLoading: boolean; refresh: unknown };
	assert.deepEqual(shape.workspaces, []);
	assert.equal(shape.isLoading, true);
	assert.equal(typeof shape.refresh, 'function');
});

test('a multi-arg hook resolves from context when the client is omitted', () => {
	renderWithProvider(() => {
		const { addRole, removeRole } = useMemberRoles('user-1');
		assert.equal(typeof addRole, 'function');
		assert.equal(typeof removeRole, 'function');
	});
});

test('an explicit client still works and bypasses context', () => {
	const explicit = Object.assign(Object.create(WorkspacesClient.prototype), {
		marker: 'explicit-workspaces',
	}) as WorkspacesClient;
	// No provider at all — the explicit argument must be enough, in both forms.
	renderToString(
		createElement(Probe, {
			run: () => {
				const { createWorkspace } = useCreateWorkspace(explicit);
				assert.equal(typeof createWorkspace, 'function');
				const { roles } = useMemberRoles(explicit, 'user-1');
				assert.deepEqual(roles, []);
			},
		}),
	);
});

test('useRolePermissions resolves from context and writes then re-reads', async () => {
	const rpCalls: unknown[] = [];
	const fake = {
		getRolePermissions: async (roleId: string) => {
			rpCalls.push(['get', roleId]);
			return { reason: 'OK', explanation: '', result: { permissions: [] } };
		},
		setRolePermissions: async (roleId: string, permissions: unknown) => {
			rpCalls.push(['set', roleId, permissions]);
			return { reason: 'OK', explanation: '', result: undefined };
		},
	} as unknown as WorkspacesClient;
	let returned: unknown;
	renderToString(
		createElement(
			FonderieProvider,
			{ client: { workspaces: fake } as unknown as FonderieClient },
			createElement(Probe, {
				run: () => {
					returned = useRolePermissions('role-1');
				},
			}),
		),
	);
	const { refresh, setRolePermissions } = returned as IUseRolePermissionsReturn;
	// renderToString does not run effects — drive the initial read manually.
	await refresh();
	assert.deepEqual(rpCalls, [['get', 'role-1']]);
	rpCalls.length = 0;
	await setRolePermissions([{ permissionKey: 'docs', canRead: true }]);
	assert.deepEqual(rpCalls, [
		['set', 'role-1', [{ permissionKey: 'docs', canRead: true }]],
		['get', 'role-1'],
	]);
});

test('useRolePermissions accepts an explicit client without a provider', async () => {
	const rpCalls: unknown[] = [];
	const explicit = Object.assign(Object.create(WorkspacesClient.prototype), {
		getRolePermissions: async (roleId: string) => {
			rpCalls.push(['get', roleId]);
			return { reason: 'OK', explanation: '', result: { permissions: [] } };
		},
		setRolePermissions: async (roleId: string, permissions: unknown) => {
			rpCalls.push(['set', roleId, permissions]);
			return { reason: 'OK', explanation: '', result: undefined };
		},
	}) as WorkspacesClient;
	let returned: unknown;
	renderToString(
		createElement(Probe, {
			run: () => {
				returned = useRolePermissions(explicit, 'role-2');
			},
		}),
	);
	const { permissions, setRolePermissions } = returned as IUseRolePermissionsReturn;
	assert.deepEqual(permissions, []);
	await setRolePermissions([{ permissionKey: 'docs', canDelete: false }]);
	assert.deepEqual(rpCalls, [
		['set', 'role-2', [{ permissionKey: 'docs', canDelete: false }]],
		['get', 'role-2'],
	]);
});

test('hooks throw a named error without provider or argument', () => {
	assert.throws(
		() =>
			renderToString(
				createElement(Probe, {
					run: () => {
						useWorkspaces();
					},
				}),
			),
		/useWorkspaces: no client/,
	);
});
