import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { toWorkspaceBranchDTO } from '../dtos/workspace';
import {
	BranchError,
	archiveBranch,
	createBranch,
	findBranch,
	listBranches,
	restoreBranch,
	updateBranch,
} from '../services/branches';

// The workspace's branches — the workspace from X-Workspace-ID (wsCtx);
// members read, managers write (routes.ts).

type Body = Record<string, unknown>;

const param = (ctx: IFonderieContext, name: string) => (ctx.meta['params'] as Record<string, string> | undefined)?.[name] ?? '';
const body = (ctx: IFonderieContext) => (ctx.meta['body'] as Body | undefined) ?? {};

async function guarded(run: () => Promise<Response>): Promise<Response> {
	try {
		return await run();
	} catch (err) {
		if (err instanceof BranchError) return setApiResponse(err.status, err.reason, err.message);
		// A unique index caught what the checks under the lock did not.
		throw err;
	}
}

export function branchesController(store: IStoreAdapter) {
	const noWorkspace = () => setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const branches = await listBranches(ctx.workspace.id, store);
			return setApiResponse(HTTP.OK, 'WORKSPACE_BRANCHES_FETCHED', 'Workspace branches retrieved.', { branches: branches.map(toWorkspaceBranchDTO) });
		},
		async get(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const branch = await findBranch(ctx.workspace.id, param(ctx, 'branchId'), store);
			if (!branch) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Branch not found');
			return setApiResponse(HTTP.OK, 'WORKSPACE_BRANCH_FETCHED', 'Branch retrieved.', { branch: toWorkspaceBranchDTO(branch) });
		},
		async create(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const branch = await createBranch(store, id, body(ctx) as unknown as Parameters<typeof createBranch>[2]);
				return setApiResponse(HTTP.CREATED, 'WORKSPACE_BRANCH_CREATED', 'Branch created.', { branch: toWorkspaceBranchDTO(branch) });
			});
		},
		async update(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const branch = await updateBranch(store, id, param(ctx, 'branchId'), body(ctx));
				return setApiResponse(HTTP.OK, 'WORKSPACE_BRANCH_UPDATED', 'Branch updated.', { branch: toWorkspaceBranchDTO(branch) });
			});
		},
		async setDefault(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const branch = await updateBranch(store, id, param(ctx, 'branchId'), { isDefault: true });
				return setApiResponse(HTTP.OK, 'WORKSPACE_BRANCH_DEFAULT_SET', 'Default branch set.', { branch: toWorkspaceBranchDTO(branch) });
			});
		},
		async archive(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const branch = await archiveBranch(store, id, param(ctx, 'branchId'), ctx.user?.id ?? null);
				return setApiResponse(HTTP.OK, 'WORKSPACE_BRANCH_ARCHIVED', 'Branch archived.', { branch: toWorkspaceBranchDTO(branch) });
			});
		},
		async restore(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return noWorkspace();
			const id = ctx.workspace.id;
			return guarded(async () => {
				const branch = await restoreBranch(store, id, param(ctx, 'branchId'));
				return setApiResponse(HTTP.OK, 'WORKSPACE_BRANCH_RESTORED', 'Branch restored.', { branch: toWorkspaceBranchDTO(branch) });
			});
		},
	};
}
