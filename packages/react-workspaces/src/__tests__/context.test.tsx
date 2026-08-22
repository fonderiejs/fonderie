import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useCreateWorkspace, useMemberRoles, useWorkspaces } from '../hooks';

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
