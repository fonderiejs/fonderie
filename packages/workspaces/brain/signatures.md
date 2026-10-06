<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/workspaces — signatures

## @fonderie/workspaces

Subpath exports: `@fonderie/workspaces/types`, `@fonderie/workspaces/middleware`, `@fonderie/workspaces/migrations`, `@fonderie/workspaces/env.json`

```ts
new WorkspacesModule(store: IStoreAdapter, config?: IWorkspacesConfig, bus?: EventBus | undefined): WorkspacesModule
  .name: "@fonderie/workspaces"
  .version: string
  .deps: string[]
  .install(app: IFonderieApp): void

interface IWorkspacesConfig {
    invitationTtl?: string;
    management?: 'owner-or-admin' | 'any-member';
    teamNotices?: boolean;
    stepUp?: boolean;
    velocityBrake?: {
        limit?: number;
        windowMinutes?: number;
    } | false;
    managerRoles?: string[];
    invitationUrl?: string;
    invitationAccountMatch?: 'email-when-present' | 'email' | 'any';
    personalWorkspace?: boolean;
    routes?: Partial<Record<WorkspaceRouteId, WorkspaceRouteOverride>>;
}

type WorkspacesMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

type WorkspacesEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

const MESSAGE_KEYS: { readonly workspaceInvitation: "workspace-invitation"; readonly memberRemoved: "workspace-member-removed"; readonly memberRemovedAlert: "workspace-member-removed-alert"; readonly managerRemoved: "workspace-manager-removed"; readonly ownershipOffered: "workspace-ownership-offered"; readonly ownershipAccepted: "workspace-ownership-accepted"; readonly managerPaused: "workspace-manager-paused"; readonly webhookCreatedAlert: "workspace-webhook-created-alert"; readonly planCancelAlert: "workspace-plan-cancel-alert"; }

const EVENT_KEYS: { readonly personalWorkspaceCreated: "fonderie.workspace.personal.created"; readonly workspaceCreated: "fonderie.workspace.created"; readonly workspaceUpdated: "fonderie.workspace.updated"; readonly workspaceArchived: "fonderie.workspace.archived"; readonly workspaceRestored: "fonderie.workspace.restored"; readonly settingsUpdated: "fonderie.workspace.settings.updated"; readonly memberRemoved: "fonderie.workspace.member.removed"; readonly memberLeft: "fonderie.workspace.member.left"; readonly memberRoleAdded: "fonderie.workspace.member.role.added"; readonly memberRoleRemoved: "fonderie.workspace.member.role.removed"; readonly managerSet: "fonderie.workspace.manager.set"; readonly managerUnset: "fonderie.workspace.manager.unset"; readonly ownershipOffered: "fonderie.workspace.ownership.offered"; readonly ownershipTransferred: "fonderie.workspace.ownership.transferred"; readonly ownershipDeclined: "fonderie.workspace.ownership.declined"; readonly ownershipWithdrawn: "fonderie.workspace.ownership.withdrawn"; readonly managerPaused: "fonderie.workspace.manager.paused"; readonly managerReleased: "fonderie.workspace.manager.released"; readonly invitationCreated: "fonderie.workspace.invitation.created"; readonly invitationCancelled: "fonderie.workspace.invitation.cancelled"; readonly invitationResent: "fonderie.workspace.invitation.resent"; readonly invitationAccepted: "fonderie.workspace.invitation.accepted"; readonly roleCreated: "fonderie.workspace.role.created"; readonly roleUpdated: "fonderie.workspace.role.updated"; readonly roleDeleted: "fonderie.workspace.role.deleted"; readonly roleRestored: "fonderie.workspace.role.restored"; readonly roleBinPurged: "fonderie.workspace.role.bin.purged"; readonly rolePermissionsSet: "fonderie.workspace.role.permissions.set"; }

const DEFAULT_TEMPLATES: { "workspace-invitation": IDefaultTemplate; "workspace-member-removed": IDefaultTemplate; "workspace-member-removed-alert": IDefaultTemplate; "workspace-manager-removed": IDefaultTemplate; "workspace-ownership-offered": IDefaultTemplate; "workspace-ownership-accepted": IDefaultTemplate; "workspace-manager-paused": IDefaultTemplate; "workspace-webhook-created-alert": IDefaultTemplate; "workspace-plan-cancel-alert": IDefaultTemplate; }

type WorkspaceType = 'ORGANIZATION' | 'PERSONAL' | 'TEAM' | 'COMMUNITY' | 'VENDOR';

type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

interface IWorkspace {
    id: string;
    name: string;
    slug: string;
    type: WorkspaceType;
    description: string | null;
    motto: string | null;
    phone: string | null;
    businessType: string | null;
    industry?: string | null;
    address: IWorkspaceAddress | null;
    legalName: string | null;
    email: string | null;
    website: string | null;
    logoUrl: string | null;
    taxRegistrations: ITaxRegistration[] | null;
    languages: string[] | null;
    plan: string;
    ownerId: string;
    isPersonal: boolean;
    archivedAt: string | null;
    archivedBy: string | null;
    createdAt: string;
    updatedAt: string | null;
}

interface IRole {
    id: string;
    name: string;
    isSystem: boolean;
    active: boolean;
    description: string | null;
    workspaceId: string | null;
}

interface IMember {
    userId: string;
    workspaceId: string;
    roleId: string;
    roleName: string;
    confirmed: boolean;
    createdAt: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    profileImageUrl: string | null;
    roles?: IMemberRole[];
    isOwner?: boolean;
    isManager?: boolean;
    paused?: boolean;
}

interface IInvitation {
    id: string;
    workspaceId: string;
    email: string;
    roleId: string;
    token: string;
    pin: string | null;
    status: InvitationStatus;
    expiresAt: string;
    createdAt: string;
}

interface IWorkspaceSettings {
    locale: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    timeFormat: string;
    documentPrefixes?: Record<string, string>;
}

interface IWorkspaceDTO {
    id: string;
    name: string;
    slug: string;
    type: string;
    description: string;
    motto: string;
    phone: string;
    businessType: string;
    industry: string;
    address: IWorkspaceAddressDTO;
    legalName: string;
    email: string;
    website: string;
    logoUrl: string;
    taxRegistrations: ITaxRegistrationDTO[];
    languages: string[];
    plan: string;
    ownerId: string;
    isPersonal: boolean;
    isArchived: boolean;
    archivedAt: string;
    archivedBy: string;
    createdAt: string;
    updatedAt: string;
}

interface IRoleDTO {
    id: string;
    name: string;
    isSystem: boolean;
    active: boolean;
    description: string;
    workspaceId: string;
}

interface IMemberDTO {
    userId: string;
    workspaceId: string;
    roleId: string;
    roleName: string;
    confirmed: boolean;
    createdAt: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string;
    roles: IMemberRoleDTO[];
    isOwner: boolean;
    isManager: boolean;
    paused: boolean;
}

interface IInvitationDTO {
    id: string;
    workspaceId: string;
    email: string;
    roleId: string;
    token: string;
    status: string;
    expiresAt: string;
    createdAt: string;
    isExpired: boolean;
}

interface IWorkspaceSettingsDTO {
    locale: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    timeFormat: string;
    documentPrefixes: Record<string, string>;
}

function toWorkspaceDTO(ws: IWorkspace): IWorkspaceDTO

function toRoleDTO(role: IRole): IRoleDTO

function toMemberDTO(m: IMember): IMemberDTO

function toInvitationDTO(inv: IInvitation): IInvitationDTO

function toSettingsDTO(s: IWorkspaceSettings): IWorkspaceSettingsDTO

function getWorkspaceSettings(id: string, store: IStoreAdapter): Promise<IWorkspaceSettings>

function withWorkspace(store: IStoreAdapter): Middleware

function requireWorkspace(ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>

function requireManager(store: IStoreAdapter, config: IWorkspacesConfig): Middleware

namespace schemas — exports: BUSINESS_TYPES, DOCUMENT_PREFIX_KINDS_MAX, acceptInvitationSchema, addMemberRoleSchema, createInvitationsSchema, createRoleSchema, createWorkspaceSchema, setRolePermissionsSchema, transferOwnershipSchema, updateRoleSchema, updateSettingsSchema, updateWorkspaceSchema

function importWorkspace(store: IStoreAdapter, ws: IImportWorkspace): Promise<{ id: string; }>

function importRole(store: IStoreAdapter, role: IImportRole): Promise<{ id: string; }>

function importMembership(store: IStoreAdapter, m: IImportMembership): Promise<void>

interface IImportWorkspace {
    id?: string;
    name: string;
    slug: string;
    ownerId: string;
    type?: string;
    plan?: string;
    description?: string | null;
    settings?: Record<string, unknown>;
    isPersonal?: boolean;
    motto?: string | null;
    phone?: string | null;
    businessType?: string | null;
    industry?: string | null;
    address?: Record<string, unknown>;
    createdAt?: Date;
    archivedAt?: Date | null;
    archivedBy?: string | null;
}

interface IImportRole {
    id?: string;
    name: string;
    workspaceId: string;
    description?: string | null;
    active?: boolean;
    createdAt?: Date;
}

interface IImportMembership {
    userId: string;
    workspaceId: string;
    roleId: string;
    confirmed?: boolean;
    createdAt?: Date;
}

function deleteUserData(store: IStoreAdapter, userId: string): Promise<number>

function exportUserData(store: IStoreAdapter, userId: string): Promise<unknown>

function workspaceExportContributor(store: IStoreAdapter): { name: string; collect: (userId: string) => Promise<unknown>; }

function accountDeletionBlocker(store: IStoreAdapter): (userId: string) => Promise<IAccountDeletionRefusal | null>

function accountEraser(store: IStoreAdapter): { name: "workspaces"; erase(subject: IErasureSubject): Promise<IErasureResult>; }

interface IErasureSubject {
    userId: string;
    email: string | null;
    phone: string | null;
}

interface IErasureResult {
    erased: number;
    kept?: string;
}

const ROLE_BIN_RETENTION_DAYS: 30

function emptyRoleBin(store: IStoreAdapter, options?: { olderThanDays?: number; }): Promise<number>

function listRoleBin(store: IStoreAdapter, workspaceId: string, retentionDays?: number): Promise<IBinnedRole[]>

function restoreRole(store: IStoreAdapter, id: string, workspaceId: string, retentionDays?: number): Promise<RestoreRoleOutcome>

interface IBinnedRole {
    id: string;
    name: string;
    description: string | null;
    holders: number;
    deletedBy: string | null;
    deletedAt: Date;
    purgeAt: Date;
}

type RestoreRoleOutcome = {
    status: 'restored';
    reassigned: number;
} | {
    status: 'not-in-bin';
} | {
    status: 'conflict';
};

const VELOCITY_BRAKE_DEFAULTS: { readonly limit: 10; readonly windowMinutes: 10; }

function releaseBrake(store: IStoreAdapter, workspaceId: string, userId: string): Promise<boolean>

function velocityBrake(store: IStoreAdapter, kind: string, options?: false | IVelocityBrakeOptions, bus?: Bus | undefined): Middleware

interface IVelocityBrakeOptions {
    limit?: number;
    windowMinutes?: number;
}

const OWNER_ALERT_EVENTS: { readonly webhookCreated: "fonderie.webhook.endpoint.created"; readonly planCancelRequested: "fonderie.billing.subscription.cancel_requested"; }
```
