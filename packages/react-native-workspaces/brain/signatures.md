<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-native-workspaces — signatures

## @fonderie/react-native-workspaces

```ts
new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

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

interface IRolePermission {
    permissionKey: string;
    canCreate: boolean;
    canRead: boolean;
    canUpdate: boolean;
    canDelete: boolean;
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
  .listWorkspaces(opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceListResult>>
  .createWorkspace(input: ICreateWorkspaceInput): Promise<IApiResponse<IWorkspaceResult>>
  .getWorkspace(id: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceResult>>
  .updateWorkspace(input: IUpdateWorkspaceInput): Promise<IApiResponse<IWorkspaceResult>>
  .archiveWorkspace(): Promise<IApiResponse<undefined>>
  .restoreWorkspace(): Promise<IApiResponse<undefined>>
  .listRoles(opts?: IReadOptions | undefined): Promise<IApiResponse<IRoleListResult>>
  .createRole(input: ICreateRoleInput): Promise<IApiResponse<IRoleResult>>
  .getRole(roleId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IRoleResult>>
  .updateRole(roleId: string, input: IUpdateRoleInput): Promise<IApiResponse<IRoleResult>>
  .removeRole(roleId: string): Promise<IApiResponse<undefined>>
  .getRolePermissions(roleId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IRolePermissionsResult>>
  .setRolePermissions(roleId: string, permissions: IRolePermissionInput[]): Promise<IApiResponse<undefined>>
  .listMembers(opts?: IReadOptions | undefined): Promise<IApiResponse<IMemberListResult>>
  .removeMember(userId: string): Promise<IApiResponse<undefined>>
  .getMemberRoles(userId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IRoleListResult>>
  .addMemberRole(userId: string, roleId: string): Promise<IApiResponse<undefined>>
  .removeMemberRole(userId: string, roleId: string): Promise<IApiResponse<undefined>>
  .listInvitations(opts?: IReadOptions | undefined): Promise<IApiResponse<IInvitationListResult>>
  .invite(entries: IInviteEntry | IInviteEntry[]): Promise<IApiResponse<IInviteResult>>
  .cancelInvitation(inviteId: string): Promise<IApiResponse<undefined>>
  .acceptInvitation(pin: string): Promise<IApiResponse<IAcceptInvitationResult>>
  .getSettings(opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceSettingsResult>>
  .updateSettings(input: IUpdateSettingsInput): Promise<IApiResponse<IWorkspaceSettingsResult>>

interface IUseAcceptInvitationReturn {
    acceptInvitation: (pin: string) => Promise<string>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseCreateWorkspaceReturn {
    createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseInvitationsReturn {
    invitations: IInvitationDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
    cancelInvitation: (inviteId: string) => Promise<void>;
}

interface IUseMemberRolesReturn {
    roles: IRoleDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    addRole: (roleId: string) => Promise<void>;
    removeRole: (roleId: string) => Promise<void>;
}

interface IUseMembersReturn {
    members: IMemberDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    removeMember: (userId: string) => Promise<void>;
}

interface IUseRemoveMemberReturn {
    removeMember: (userId: string) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseRolePermissionsReturn {
    permissions: IRolePermission[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    setRolePermissions: (permissions: IRolePermissionInput[]) => Promise<void>;
}

interface IUseRolesReturn {
    roles: IRoleDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    createRole: (input: ICreateRoleInput) => Promise<IRoleDTO>;
    updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>;
    removeRole: (roleId: string) => Promise<void>;
}

interface IUseSetRolePermissionsReturn {
    setRolePermissions: (roleId: string, permissions: IRolePermissionInput[]) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseUpdateRoleReturn {
    updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseWorkspaceProfileReturn {
    updateWorkspace: (input: IUpdateWorkspaceInput) => Promise<IWorkspaceDTO>;
    archiveWorkspace: () => Promise<void>;
    restoreWorkspace: () => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseWorkspaceSettingsReturn {
    settings: IWorkspaceSettingsDTO | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    updateSettings: (input: IUpdateSettingsInput) => Promise<void>;
}

interface IUseWorkspacesReturn {
    workspaces: IWorkspaceDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>;
    acceptInvitation: (pin: string) => Promise<string>;
}

function useAcceptInvitation(client?: WorkspacesClient | undefined): IUseAcceptInvitationReturn

function useCreateWorkspace(client?: WorkspacesClient | undefined): IUseCreateWorkspaceReturn

function useInvitations(client?: WorkspacesClient | undefined): IUseInvitationsReturn

function useMemberRoles(userId: string): IUseMemberRolesReturn

function useMembers(client?: WorkspacesClient | undefined): IUseMembersReturn

function useRemoveMember(client?: WorkspacesClient | undefined): IUseRemoveMemberReturn

function useRolePermissions(roleId: string): IUseRolePermissionsReturn

function useRoles(client?: WorkspacesClient | undefined): IUseRolesReturn

function useSetRolePermissions(client?: WorkspacesClient | undefined): IUseSetRolePermissionsReturn

function useUpdateRole(client?: WorkspacesClient | undefined): IUseUpdateRoleReturn

function useWorkspaceProfile(client?: WorkspacesClient | undefined): IUseWorkspaceProfileReturn

function useWorkspaceSettings(client?: WorkspacesClient | undefined): IUseWorkspaceSettingsReturn

function useWorkspaces(client?: WorkspacesClient | undefined): IUseWorkspacesReturn
```
