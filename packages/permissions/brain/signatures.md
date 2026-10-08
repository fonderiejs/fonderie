<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/permissions — signatures

## @fonderie/permissions

Subpath exports: `@fonderie/permissions/config`, `@fonderie/permissions/types`, `@fonderie/permissions/middleware`, `@fonderie/permissions/migrations`, `@fonderie/permissions/env.json`

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

interface IPermissionCatalogEntry {
    key: string;
    operations?: Operation[];
    label?: string;
    description?: string;
}

interface IEffectivePermissions {
    isSuper: boolean;
    permissions: Record<string, Record<Operation, boolean>>;
}

new PermissionsModule(store: IStoreAdapter, config?: IPermissionsConfig): PermissionsModule
  .engine: PermissionsEngine
  .name: "@fonderie/permissions"
  .version: string
  .deps: string[]
  .install(app: IFonderieApp): void

new PermissionsEngine(store: IStoreAdapter, config?: IPermissionsConfig): PermissionsEngine
  .catalog: readonly IPermissionCatalogEntry[] | null
  .systemGrants: Record<string, Record<string, Operation[]>>
  .isKnown(permissionKey: string): boolean
  .operationsOf(permissionKey: string): Operation[]
  .effective(userId: string, workspaceId: string): Promise<IEffectivePermissions | null>
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
    catalog?: IPermissionCatalogEntry[];
    systemGrants?: Record<string, Record<string, Operation[]>>;
}

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

const PERMISSION_COLUMN: Record<Operation, string>

function requireRole(roleName: string | string[], store: IStoreAdapter): Middleware

function requirePermission(operation: Operation, permissionKey: string): Middleware

function listGrants(store: IStoreAdapter): Promise<IGrant[]>

interface IGrant {
    userId: string;
    workspaceId: string;
    roleId: string;
    roleName: string;
    suspended: boolean;
}
```
