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

type IAcceptInvitationInput = {
    token: string;
} | {
    pin: string;
};

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
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string;
    roles: IMemberRoleDTO[];
    isOwner: boolean;
    isManager: boolean;
    paused?: boolean;
}

interface IMemberRoleDTO {
    id: string;
    name: string;
    isSystem: boolean;
}

interface IMyPermissionsResult {
    isOwner: boolean;
    isManager: boolean;
    isSuper: boolean;
    permissions: Record<string, Record<PermissionOperation, boolean>>;
}

interface IPermissionCatalogEntryDTO {
    key: string;
    operations: PermissionOperation[];
    label: string;
    description: string;
}

interface IRoleDeleteResult {
    membersAffected: number;
    movedToDefaultRole: number;
}

type PermissionOperation = 'create' | 'read' | 'update' | 'delete';

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
    documentPrefixes?: Record<string, string> | null;
}

interface IUpdateWorkspaceInput {
    name?: string;
    description?: string | null;
    motto?: string | null;
    phone?: string | null;
    businessType?: string | null;
    industry?: string | null;
    address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
        accessCode?: string | null;
    } | null;
    legalName?: string | null;
    email?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    taxRegistrations?: Array<{
        country: string;
        type: string;
        number?: string | null;
        region?: string | null;
        label?: string | null;
        rate?: number | null;
    }>;
    languages?: string[];
}

interface IWorkspaceAddressDTO {
    line1: string;
    line2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    accessCode?: string;
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
    industry?: string;
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

interface IWorkspaceSettingsDTO {
    locale: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    timeFormat: string;
    documentPrefixes?: Record<string, string>;
}

new WorkspacesClient(http: HttpClient, tokens: TokenStore): WorkspacesClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .getWorkspaceId(): string | undefined
  .onWorkspaceChange(listener: (workspaceId: string | undefined) => void): () => void
  .listWorkspaces(opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceListResult>>
  .createWorkspace(input: ICreateWorkspaceInput): Promise<IApiResponse<IWorkspaceResult>>
  .getWorkspace(id: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceResult>>
  .getCurrentWorkspace(opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceResult>>
  .getMyPermissions(opts?: IReadOptions | undefined): Promise<IApiResponse<IMyPermissionsResult>>
  .getPermissionCatalog(opts?: IReadOptions | undefined): Promise<IApiResponse<IPermissionCatalogResult>>
  .updateWorkspace(input: IUpdateWorkspaceInput): Promise<IApiResponse<IWorkspaceResult>>
  .archiveWorkspace(): Promise<IApiResponse<undefined>>
  .restoreWorkspace(): Promise<IApiResponse<undefined>>
  .listRoles(opts?: IReadOptions | undefined): Promise<IApiResponse<IRoleListResult>>
  .createRole(input: ICreateRoleInput): Promise<IApiResponse<IRoleResult>>
  .getRole(roleId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IRoleResult>>
  .updateRole(roleId: string, input: IUpdateRoleInput): Promise<IApiResponse<IRoleResult>>
  .removeRole(roleId: string): Promise<IApiResponse<IRoleDeleteResult>>
  .listDeletedRoles(opts?: IReadOptions | undefined): Promise<IApiResponse<{ roles: IDeletedRoleDTO[]; }>>
  .restoreRole(id: string): Promise<IApiResponse<IRestoredRoleResult>>
  .purgeDeletedRole(id: string): Promise<undefined>
  .getRolePermissions(roleId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IRolePermissionsResult>>
  .setRolePermissions(roleId: string, permissions: IRolePermissionInput[]): Promise<IApiResponse<undefined>>
  .listMembers(opts?: IReadOptions | undefined): Promise<IApiResponse<IMemberListResult>>
  .removeMember(userId: string): Promise<IApiResponse<undefined>>
  .getMemberRoles(userId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<IRoleListResult>>
  .addMemberRole(userId: string, roleId: string): Promise<IApiResponse<undefined>>
  .removeMemberRole(userId: string, roleId: string): Promise<IApiResponse<undefined>>
  .setManager(userId: string): Promise<IApiResponse<void>>
  .unsetManager(userId: string): Promise<IApiResponse<void>>
  .releaseBrake(userId: string): Promise<IApiResponse<undefined>>
  .transferOwnership(userId: string): Promise<IApiResponse<{ offer: IOwnershipOfferDTO; }>>
  .getOwnershipOffer(opts?: IReadOptions | undefined): Promise<IApiResponse<{ offer: IOwnershipOfferDTO | null; }>>
  .acceptOwnership(): Promise<IApiResponse<{ previousOwnerId: string; }>>
  .declineOwnership(): Promise<IApiResponse<undefined>>
  .withdrawOwnershipOffer(): Promise<IApiResponse<undefined>>
  .leaveWorkspace(): Promise<IApiResponse<void>>
  .listInvitations(opts?: IReadOptions | undefined): Promise<IApiResponse<IInvitationListResult>>
  .invite(entries: IInviteEntry | IInviteEntry[]): Promise<IApiResponse<IInviteResult>>
  .cancelInvitation(inviteId: string): Promise<IApiResponse<undefined>>
  .resendInvitation(inviteId: string): Promise<IApiResponse<IInvitationResult>>
  .acceptInvitation(code: string | IAcceptInvitationInput): Promise<IApiResponse<IAcceptInvitationResult>>
  .getSettings(opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceSettingsResult>>
  .updateSettings(input: IUpdateSettingsInput): Promise<IApiResponse<IWorkspaceSettingsResult>>

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown, requestId?: string | undefined): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .requestId: string | undefined
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface IUseCurrentWorkspaceReturn {
    workspace: Ref<IWorkspaceDTO | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUseInvitationsReturn {
    invitations: Ref<IInvitationDTO[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
    cancelInvitation: (inviteId: string) => Promise<void>;
    resendInvitation: (inviteId: string) => Promise<void>;
}

interface IUseMemberRolesReturn {
    roles: Ref<IRoleDTO[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    addRole: (roleId: string) => Promise<void>;
    removeRole: (roleId: string) => Promise<void>;
}

interface IUseMembersReturn {
    members: Ref<IMemberDTO[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    removeMember: (userId: string) => Promise<void>;
    setManager: (userId: string) => Promise<void>;
    unsetManager: (userId: string) => Promise<void>;
    releaseBrake: (userId: string) => Promise<void>;
    transferOwnership: (userId: string) => Promise<void>;
}

interface IUsePermissionCatalogReturn {
    catalog: ComputedRef<IPermissionCatalogEntryDTO[]>;
    declared: ComputedRef<boolean>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUsePermissionsReturn {
    can: (operation: PermissionOperation, resource: string) => boolean;
    isOwner: ComputedRef<boolean>;
    isManager: ComputedRef<boolean>;
    permissions: ComputedRef<IMyPermissionsResult['permissions']>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUseRolePermissionsReturn {
    permissions: Ref<IRolePermission[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    setRolePermissions: (permissions: IRolePermissionInput[]) => Promise<void>;
}

interface IUseRoleReturn {
    role: Ref<IRoleDTO | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUseRolesReturn {
    roles: Ref<IRoleDTO[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>;
    createRole: (input: ICreateRoleInput) => Promise<IRoleDTO>;
    removeRole: (roleId: string) => Promise<IRoleDeleteResult>;
}

interface IUseWorkspaceProfileReturn {
    updateWorkspace: (input: IUpdateWorkspaceInput) => Promise<IWorkspaceDTO>;
    archiveWorkspace: () => Promise<void>;
    restoreWorkspace: () => Promise<void>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseWorkspaceSettingsReturn {
    settings: Ref<IWorkspaceSettingsDTO | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    updateSettings: (input: IUpdateSettingsInput) => Promise<void>;
}

interface IUseWorkspaceReturn {
    workspace: Ref<IWorkspaceDTO | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUseWorkspacesReturn {
    workspaces: Ref<IWorkspaceDTO[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>;
    acceptInvitation: (code: string | IAcceptInvitationInput) => Promise<string>;
    leaveWorkspace: () => Promise<void>;
}

interface IUseDeletedRolesReturn {
    roles: Ref<IDeletedRoleDTO[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    restore: (id: string) => Promise<void>;
    purge: (id: string) => Promise<void>;
}

interface IUseOwnershipOfferReturn {
    offer: Ref<IOwnershipOfferDTO | null>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    accept: () => Promise<void>;
    decline: () => Promise<void>;
    withdraw: () => Promise<void>;
}

function useCurrentWorkspace(client?: WorkspacesClient | undefined): IUseCurrentWorkspaceReturn

function useInvitations(client?: WorkspacesClient | undefined): IUseInvitationsReturn

function useMemberRoles(userId: MaybeRefOrGetter<string>): IUseMemberRolesReturn

function useMembers(client?: WorkspacesClient | undefined): IUseMembersReturn

function useCan(operation: MaybeRefOrGetter<PermissionOperation>, resource: MaybeRefOrGetter<string>, client?: WorkspacesClient | undefined): ComputedRef<...>

function usePermissionCatalog(client?: WorkspacesClient | undefined): IUsePermissionCatalogReturn

function usePermissions(client?: WorkspacesClient | undefined): IUsePermissionsReturn

function useRole(id: MaybeRefOrGetter<string>): IUseRoleReturn

function useRolePermissions(roleId: MaybeRefOrGetter<string>): IUseRolePermissionsReturn

function useRoles(client?: WorkspacesClient | undefined): IUseRolesReturn

function useWorkspaceProfile(client?: WorkspacesClient | undefined): IUseWorkspaceProfileReturn

function useWorkspaceSettings(client?: WorkspacesClient | undefined): IUseWorkspaceSettingsReturn

function useWorkspace(id: MaybeRefOrGetter<string>): IUseWorkspaceReturn

function useWorkspaces(client?: WorkspacesClient | undefined): IUseWorkspacesReturn

function useDeletedRoles(client?: WorkspacesClient | undefined): IUseDeletedRolesReturn

function useOwnershipOffer(client?: WorkspacesClient | undefined): IUseOwnershipOfferReturn
```
