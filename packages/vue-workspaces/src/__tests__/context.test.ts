import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { FonderiePlugin } from '@fonderie/vue';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';

import { useCreateWorkspace, useMemberRoles, useRolePermissions, useWorkspaces } from '../composables';

const fakeWorkspace = { id: 'ws-1', name: 'Acme' };
const fakeRole = { id: 'role-1', name: 'admin' };
const fakePermission = { key: 'members:read', allowed: true };
const permissionCalls: unknown[] = [];
// instanceof WorkspacesClient must pass for the overloaded composables.
const fakeWorkspaces: WorkspacesClient = Object.assign(Object.create(WorkspacesClient.prototype), {
	listWorkspaces: async () => ({ result: { workspaces: [fakeWorkspace] } }),
	createWorkspace: async () => ({ result: { workspace: fakeWorkspace } }),
	getMemberRoles: async () => ({ result: { roles: [fakeRole] } }),
	getRolePermissions: async (roleId: string) => {
		permissionCalls.push(['get', roleId]);
		return { result: { permissions: [fakePermission] } };
	},
	setRolePermissions: async (roleId: string, permissions: unknown) => {
		permissionCalls.push(['set', roleId, permissions]);
		return { result: undefined };
	},
});
const fakeClient = { workspaces: fakeWorkspaces } as unknown as FonderieClient;

// Renders `run` inside a component's setup(), capturing its value or error.
async function runInSetup<T>(run: () => T, plugin?: boolean) {
	let value: T | undefined;
	let error: unknown;
	const Root = defineComponent({
		setup() {
			try {
				value = run();
			} catch (err) {
				error = err;
			}
			return () => h('div');
		},
	});
	const app = createSSRApp(Root);
	if (plugin) app.use(FonderiePlugin, fakeClient);
	await renderToString(app);
	return { value, error };
}

test('useCreateWorkspace resolves the client via app.use(FonderiePlugin, client)', async () => {
	const { value, error } = await runInSetup(() => useCreateWorkspace(), true);
	assert.equal(error, undefined);
	assert.ok(value);
	assert.equal(value.isLoading.value, false);
	assert.equal(value.error.value, null);
	const workspace = await value.createWorkspace({ name: 'Acme' });
	assert.equal(workspace, fakeWorkspace);
});

test('useMemberRoles(userId) resolves via the plugin without a client argument', async () => {
	const { value, error } = await runInSetup(() => useMemberRoles('user-1'), true);
	assert.equal(error, undefined);
	assert.ok(value);
	// The initial fetch runs in onMounted, which never fires during SSR.
	assert.deepEqual(value.roles.value, []);
	assert.equal(value.isLoading.value, true);
	await value.refresh();
	assert.equal(value.isLoading.value, false);
	assert.equal(value.error.value, null);
	assert.deepEqual(value.roles.value, [fakeRole]);
});

test('an explicit client argument works without any plugin installed', async () => {
	const { value, error } = await runInSetup(() => useWorkspaces(fakeWorkspaces));
	assert.equal(error, undefined);
	assert.ok(value);
	await value.refresh();
	assert.deepEqual(value.workspaces.value, [fakeWorkspace]);

	const explicit = await runInSetup(() => useMemberRoles(fakeWorkspaces, 'user-1'));
	assert.equal(explicit.error, undefined);
	await explicit.value?.refresh();
	assert.deepEqual(explicit.value?.roles.value, [fakeRole]);
});

test('useRolePermissions(roleId) resolves via the plugin and setRolePermissions re-reads', async () => {
	permissionCalls.length = 0;
	const { value, error } = await runInSetup(() => useRolePermissions('role-1'), true);
	assert.equal(error, undefined);
	assert.ok(value);
	// The initial fetch runs in onMounted, which never fires during SSR.
	assert.deepEqual(value.permissions.value, []);
	assert.equal(value.isLoading.value, true);
	await value.refresh();
	assert.equal(value.isLoading.value, false);
	assert.equal(value.error.value, null);
	assert.deepEqual(value.permissions.value, [fakePermission]);
	assert.deepEqual(permissionCalls, [['get', 'role-1']]);

	await value.setRolePermissions([{ key: 'members:read', allowed: false }] as never);
	assert.deepEqual(permissionCalls, [
		['get', 'role-1'],
		['set', 'role-1', [{ key: 'members:read', allowed: false }]],
		['get', 'role-1'],
	]);
});

test('throws a composable-named error with no plugin and no argument', async () => {
	const { error } = await runInSetup(() => useWorkspaces());
	assert.match(String(error), /useWorkspaces: no client/);

	const memberRoles = await runInSetup(() => useMemberRoles('user-1'));
	assert.match(String(memberRoles.error), /useMemberRoles: no client/);
});


test('refresh({force:true}) passes bust and removeMember folds into useMembers', async () => {
	const log: unknown[] = [];
	const fake = {
		listMembers: async (opts?: { bust?: boolean }) => {
			log.push(['list', opts?.bust ?? false]);
			return { reason: 'OK', explanation: '', result: { members: [] } };
		},
		removeMember: async (userId: string) => {
			log.push(['remove', userId]);
			return { reason: 'OK', explanation: '', result: undefined };
		},
	};
	const { useMembers } = await import('../composables');
	const { value: captured } = await runInSetup(() =>
		useMembers(fake as unknown as WorkspacesClient),
	);
	assert.ok(captured);
	await captured.refresh({ force: true });
	await captured.removeMember('user-9');
	assert.deepEqual(log, [
		['list', true],
		['remove', 'user-9'],
		['list', false],
	]);
});
