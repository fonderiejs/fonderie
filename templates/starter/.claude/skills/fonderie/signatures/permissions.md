<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/permissions — signatures

## @fonderie/permissions

Subpath exports: `@fonderie/permissions/config`, `@fonderie/permissions/types`, `@fonderie/permissions/middleware`, `@fonderie/permissions/migrations`

```ts
type Operation = 'create' | 'read' | 'update' | 'delete';

type PermissionKey = string;

interface IRole {
    id: string;
    name: string;
    isSystem: boolean;
    workspaceId: string | null;
}

interface IPermission {
    permissionKey: PermissionKey;
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
}

interface IMembership {
    userId: string;
    workspaceId: string;
    roleId: string;
    roleName: string;
}

interface IRoleWithPermissions extends IRole {
    permissions: IPermission[];
}

new PermissionsModule(store: IStoreAdapter, config?: IPermissionsConfig): PermissionsModule
  .engine: PermissionsEngine
  .name: "@fonderie/permissions"
  .deps: string[]
  .install(app: IFonderieApp): void

new PermissionsEngine(store: IStoreAdapter, config?: IPermissionsConfig): PermissionsEngine
  .getMembership(userId: string, workspaceId: string): Promise<IMembership | null>
  .can(userId: string, operation: Operation, permissionKey: string, workspaceId: string): Promise<boolean>
  .assert(userId: string, operation: Operation, permissionKey: string, workspaceId: string): Promise<void>
  .canAll(userId: string, checks: { operation: Operation; permissionKey: string; }[], workspaceId: string): Promise<boolean>
  .canAny(userId: string, checks: { operation: Operation; permissionKey: string; }[], workspaceId: string): Promise<boolean>

new PermissionDeniedError(operation: string, permissionKey: string): PermissionDeniedError
  .status: 403
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface IPermissionsConfig {
    wildcards?: boolean;
    superRole?: string;
}

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

const PERMISSION_COLUMN: { create: string; read: string; update: string; delete: string; }

function requireRole(roleName: string | string[], store: IStoreAdapter): Middleware

function requirePermission(operation: Operation, permissionKey: string): Middleware
```
