<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/workspaces — signatures

## @fonderie/workspaces

Subpath exports: `@fonderie/workspaces/types`, `@fonderie/workspaces/middleware`, `@fonderie/workspaces/migrations`

```ts
new WorkspacesModule(store: IStoreAdapter, config?: IWorkspacesConfig, bus?: EventBus | undefined): WorkspacesModule
  .name: "@fonderie/workspaces"
  .deps: string[]
  .install(app: IFonderieApp): void

interface IWorkspacesConfig {
    invitationTtl?: string;
    personalWorkspace?: boolean;
}

type WorkspacesMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

type WorkspacesEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

const MESSAGE_KEYS: { readonly workspaceInvitation: "workspace-invitation"; }

const EVENT_KEYS: { readonly personalWorkspaceCreated: "fonderie.workspace.personal.created"; }

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
    address: IWorkspaceAddress | null;
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
    address: IWorkspaceAddressDTO;
    plan: string;
    ownerId: string;
    isPersonal: boolean;
    isArchived: boolean;
    archivedAt: string;
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
}

interface IWorkspaceSettingsDTO {
    locale: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    timeFormat: string;
}

function toWorkspaceDTO(ws: IWorkspace): IWorkspaceDTO

function toRoleDTO(role: IRole): IRoleDTO

function toMemberDTO(m: IMember): IMemberDTO

function toInvitationDTO(inv: IInvitation): IInvitationDTO

function toSettingsDTO(s: IWorkspaceSettings): IWorkspaceSettingsDTO

function withWorkspace(store: IStoreAdapter): Middleware

function requireWorkspace(ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>

namespace schemas — exports: acceptInvitationSchema, addMemberRoleSchema, createInvitationsSchema, createRoleSchema, createWorkspaceSchema, setRolePermissionsSchema, updateRoleSchema, updateSettingsSchema, updateWorkspaceSchema
```
