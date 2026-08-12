<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-workspaces — signatures

## @fonderie/vue-workspaces

```ts
interface ICreateRoleInput {
    name: string;
    description?: string;
}

interface ICreateWorkspaceInput {
    name: string;
    description?: string;
    type?: string;
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

interface IInviteEntry {
    email: string;
    roleId?: string;
}

interface IMemberDTO {
    userId: string;
    workspaceId: string;
    roleId: string;
    roleName: string;
    confirmed: boolean;
    createdAt: string;
}

interface IRoleDTO {
    id: string;
    name: string;
    isSystem: boolean;
    active: boolean;
    description: string;
    workspaceId: string;
}

interface IRolePermissionInput {
    permissionKey: string;
    canCreate?: boolean;
    canRead?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
}

interface IUpdateRoleInput {
    name?: string;
    description?: string | null;
    active?: boolean;
}

interface IUpdateSettingsInput {
    locale?: string;
    timezone?: string;
    currency?: string;
    dateFormat?: string;
    timeFormat?: string;
}

interface IUpdateWorkspaceInput {
    name?: string;
    description?: string | null;
    motto?: string | null;
    phone?: string | null;
    businessType?: string | null;
    address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
    } | null;
}

interface IWorkspaceAddressDTO {
    line1: string;
    line2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
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

interface IWorkspaceSettingsDTO {
    locale: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    timeFormat: string;
}

new WorkspacesClient(http: HttpClient, tokens: TokenStore): WorkspacesClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listWorkspaces(): Promise<IApiResponse<IWorkspaceListResult>>
  .createWorkspace(input: ICreateWorkspaceInput): Promise<IApiResponse<IWorkspaceResult>>
  .getWorkspace(id: string): Promise<IApiResponse<IWorkspaceResult>>
  .updateWorkspace(input: IUpdateWorkspaceInput): Promise<IApiResponse<IWorkspaceResult>>
  .listRoles(): Promise<IApiResponse<IRoleListResult>>
  .createRole(input: ICreateRoleInput): Promise<IApiResponse<IRoleResult>>
  .getRole(roleId: string): Promise<IApiResponse<IRoleResult>>
  .updateRole(roleId: string, input: IUpdateRoleInput): Promise<IApiResponse<IRoleResult>>
  .removeRole(roleId: string): Promise<IApiResponse<undefined>>
  .setRolePermissions(roleId: string, permissions: IRolePermissionInput[]): Promise<IApiResponse<undefined>>
  .listMembers(): Promise<IApiResponse<IMemberListResult>>
  .removeMember(userId: string): Promise<IApiResponse<undefined>>
  .getMemberRoles(userId: string): Promise<IApiResponse<IRoleListResult>>
  .addMemberRole(userId: string, roleId: string): Promise<IApiResponse<undefined>>
  .removeMemberRole(userId: string, roleId: string): Promise<IApiResponse<undefined>>
  .listInvitations(): Promise<IApiResponse<IInvitationListResult>>
  .invite(entries: IInviteEntry | IInviteEntry[]): Promise<IApiResponse<IInviteResult>>
  .cancelInvitation(inviteId: string): Promise<IApiResponse<undefined>>
  .acceptInvitation(pin: string): Promise<IApiResponse<IAcceptInvitationResult>>
  .getSettings(): Promise<IApiResponse<IWorkspaceSettingsResult>>
  .updateSettings(input: IUpdateSettingsInput): Promise<IApiResponse<IWorkspaceSettingsResult>>

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

function useAcceptInvitation(client: WorkspacesClient): { acceptInvitation: (pin: string) => Promise<string>; isLoading: Ref<boolean, boolean>; error: Ref<FonderieApiError | null, FonderieApiError | null>; }

function useCreateWorkspace(client: WorkspacesClient): { createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>; isLoading: Ref<...>; error: Ref<...>; }

function useInvitations(client: WorkspacesClient): { invitations: Ref<{ id: string; workspaceId: string; email: string; roleId: string; token: string; status: string; expiresAt: string; createdAt: string; }[], IInvitationDTO[] | { ...; }[]>; ... 4 more ...; cancelInvitation: (inviteId: string) => Promise<...>; }

function useMemberRoles(client: WorkspacesClient, userId: string): { roles: Ref<{ id: string; name: string; isSystem: boolean; active: boolean; description: string; workspaceId: string; }[], IRoleDTO[] | { ...; }[]>; ... 4 more ...; removeRole: (roleId: string) => Promise<...>; }

function useMembers(client: WorkspacesClient): { members: Ref<{ userId: string; workspaceId: string; roleId: string; roleName: string; confirmed: boolean; createdAt: string; }[], IMemberDTO[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }

function useRemoveMember(client: WorkspacesClient): { removeMember: (userId: string) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<FonderieApiError | null, FonderieApiError | null>; }

function useRoles(client: WorkspacesClient): { roles: Ref<{ id: string; name: string; isSystem: boolean; active: boolean; description: string; workspaceId: string; }[], IRoleDTO[] | { ...; }[]>; ... 4 more ...; removeRole: (roleId: string) => Promise<...>; }

function useSetRolePermissions(client: WorkspacesClient): { setRolePermissions: (roleId: string, permissions: IRolePermissionInput[]) => Promise<void>; isLoading: Ref<...>; error: Ref<...>; }

function useUpdateRole(client: WorkspacesClient): { updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>; isLoading: Ref<...>; error: Ref<...>; }

function useWorkspaceSettings(client: WorkspacesClient): { settings: Ref<{ locale: string; timezone: string; currency: string; dateFormat: string; timeFormat: string; } | null, IWorkspaceSettingsDTO | { ...; } | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; updateSettings: (input: IUpdateSettingsInput) => Promise<...>; }

function useWorkspaces(client: WorkspacesClient): { workspaces: Ref<{ id: string; name: string; slug: string; type: string; description: string; motto: string; phone: string; businessType: string; ... 7 more ...; updatedAt: string; }[], IWorkspaceDTO[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; }
```
