// ── Public API ───────────────────────────────────────────────────
export { WorkspacesModule }                          from './module';
export type { IWorkspacesConfig }                     from './config';
export type { IWorkspace, IMember, IInvitation, IRole } from './types';

export { workspaceContextMiddleware } from './middlewares/workspace-context';
export { requireWorkspace }           from './middlewares/require-workspace';
