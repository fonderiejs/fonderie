<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-native-workspaces — signatures

## @fonderie/react-native-workspaces

```ts
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

type IAcceptInvitationInput = {
    token: string;
} | {
    pin: string;
};

interface IAddWorkspaceEmailInput {
    email: string;
    label?: string | null;
    isPrimary?: boolean;
}

interface IAddWorkspacePhoneInput {
    phone: string;
    extension?: string | null;
    label?: string | null;
    isPrimary?: boolean;
}

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
    isExpired: boolean;
}

interface IInviteEntry {
    email: string;
    roleId?: string;
}

interface IListPageInput {
    limit?: number;
    cursor?: string;
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

interface IRoleDTO {
    id: string;
    name: string;
    isSystem: boolean;
    active: boolean;
    description: string;
    workspaceId: string;
}

interface IRoleDeleteResult {
    membersAffected: number;
    movedToDefaultRole: number;
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

interface IUpdateWorkspaceEmailInput {
    label?: string | null;
    isPrimary?: boolean;
    position?: number;
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

type IUpdateWorkspaceLocationInput = Partial<IWorkspaceLocationInput>;

interface IUpdateWorkspacePhoneInput {
    extension?: string | null;
    label?: string | null;
    isPrimary?: boolean;
    position?: number;
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

interface IWorkspaceContactsResult {
    emails: IWorkspaceEmailDTO[];
    phones: IWorkspacePhoneDTO[];
    locations: IWorkspaceLocationDTO[];
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

interface IWorkspaceEmailDTO {
    id: string;
    email: string;
    label: string;
    isPrimary: boolean;
    position: number;
    createdAt: string;
    updatedAt: string;
}

interface IWorkspaceLocationDTO {
    id: string;
    name: string;
    address: IWorkspaceAddressDTO;
    taxRegion: string;
    latitude: number | null;
    longitude: number | null;
    phone: string;
    email: string;
    isHeadOffice: boolean;
    position: number;
    isArchived: boolean;
    archivedAt: string;
    archivedBy: string;
    createdAt: string;
    updatedAt: string;
}

interface IWorkspaceLocationInput {
    name: string;
    address: NonNullable<IUpdateWorkspaceInput['address']>;
    taxRegion?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    phone?: string | null;
    email?: string | null;
    isHeadOffice?: boolean;
    position?: number;
}

interface IWorkspacePhoneDTO {
    id: string;
    phone: string;
    extension: string;
    label: string;
    isPrimary: boolean;
    position: number;
    createdAt: string;
    updatedAt: string;
}

interface IWorkspaceSeatsResult {
    used: number;
    members: number;
    pendingInvites: number;
    limit: number | null;
    available: number | null;
}

interface IWorkspaceSettingsDTO {
    locale: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    timeFormat: string;
    documentPrefixes?: Record<string, string>;
}

type PermissionOperation = 'create' | 'read' | 'update' | 'delete';

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
  .getSeats(opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceSeatsResult>>
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
  .listMembers(opts?: (IReadOptions & IListPageInput) | undefined): Promise<IApiResponse<IMemberListResult>>
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
  .listInvitations(opts?: (IReadOptions & IListPageInput) | undefined): Promise<IApiResponse<IInvitationListResult>>
  .invite(entries: IInviteEntry | IInviteEntry[]): Promise<IApiResponse<IInviteResult>>
  .cancelInvitation(inviteId: string): Promise<IApiResponse<undefined>>
  .resendInvitation(inviteId: string): Promise<IApiResponse<IInvitationResult>>
  .acceptInvitation(code: string | IAcceptInvitationInput): Promise<IApiResponse<IAcceptInvitationResult>>
  .getContacts(opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceContactsResult>>
  .addEmail(input: IAddWorkspaceEmailInput): Promise<IApiResponse<IWorkspaceEmailResult>>
  .updateEmail(emailId: string, input: IUpdateWorkspaceEmailInput): Promise<IApiResponse<IWorkspaceEmailResult>>
  .removeEmail(emailId: string): Promise<IApiResponse<{ deleted: boolean; }>>
  .addPhone(input: IAddWorkspacePhoneInput): Promise<IApiResponse<IWorkspacePhoneResult>>
  .updatePhone(phoneId: string, input: IUpdateWorkspacePhoneInput): Promise<IApiResponse<IWorkspacePhoneResult>>
  .removePhone(phoneId: string): Promise<IApiResponse<{ deleted: boolean; }>>
  .createLocation(input: IWorkspaceLocationInput): Promise<IApiResponse<IWorkspaceLocationResult>>
  .updateLocation(locationId: string, input: Partial<IWorkspaceLocationInput>): Promise<IApiResponse<IWorkspaceLocationResult>>
  .archiveLocation(locationId: string): Promise<IApiResponse<IWorkspaceLocationResult>>
  .restoreLocation(locationId: string): Promise<IApiResponse<IWorkspaceLocationResult>>
  .getSettings(opts?: IReadOptions | undefined): Promise<IApiResponse<IWorkspaceSettingsResult>>
  .updateSettings(input: IUpdateSettingsInput): Promise<IApiResponse<IWorkspaceSettingsResult>>

interface IUseCurrentWorkspaceReturn {
    workspace: IWorkspaceDTO | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUseDeletedRolesReturn {
    roles: IDeletedRoleDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    restore: (id: string) => Promise<void>;
    purge: (id: string) => Promise<void>;
}

interface IUseInvitationsReturn {
    invitations: IInvitationDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    isLoadingMore: boolean;
    invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
    cancelInvitation: (inviteId: string) => Promise<void>;
    resendInvitation: (inviteId: string) => Promise<void>;
}

interface IUseListPageOptions {
    pageSize?: number;
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
    hasMore: boolean;
    loadMore: () => Promise<void>;
    isLoadingMore: boolean;
    removeMember: (userId: string) => Promise<void>;
    setManager: (userId: string) => Promise<void>;
    unsetManager: (userId: string) => Promise<void>;
    releaseBrake: (userId: string) => Promise<void>;
    transferOwnership: (userId: string) => Promise<void>;
}

interface IUseOwnershipOfferReturn {
    offer: IOwnershipOfferDTO | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    accept: () => Promise<void>;
    decline: () => Promise<void>;
    withdraw: () => Promise<void>;
}

interface IUsePermissionCatalogReturn {
    catalog: IPermissionCatalogEntryDTO[];
    declared: boolean;
    systemGrants: Record<string, Record<string, PermissionOperation[]>>;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUsePermissionsReturn {
    can: (operation: PermissionOperation, resource: string) => boolean;
    isOwner: boolean;
    isManager: boolean;
    permissions: IMyPermissionsResult['permissions'];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
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

interface IUseRoleReturn {
    role: IRoleDTO | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
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
    removeRole: (roleId: string) => Promise<IRoleDeleteResult>;
}

interface IUseWorkspaceContactsReturn {
    emails: IWorkspaceEmailDTO[];
    phones: IWorkspacePhoneDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    addEmail: (input: IAddWorkspaceEmailInput) => Promise<void>;
    updateEmail: (emailId: string, input: IUpdateWorkspaceEmailInput) => Promise<void>;
    removeEmail: (emailId: string) => Promise<void>;
    addPhone: (input: IAddWorkspacePhoneInput) => Promise<void>;
    updatePhone: (phoneId: string, input: IUpdateWorkspacePhoneInput) => Promise<void>;
    removePhone: (phoneId: string) => Promise<void>;
}

interface IUseWorkspaceLocationsReturn {
    locations: IWorkspaceLocationDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    createLocation: (input: IWorkspaceLocationInput) => Promise<void>;
    updateLocation: (locationId: string, input: IUpdateWorkspaceLocationInput) => Promise<void>;
    archiveLocation: (locationId: string) => Promise<void>;
    restoreLocation: (locationId: string) => Promise<void>;
}

interface IUseWorkspaceProfileReturn {
    updateWorkspace: (input: IUpdateWorkspaceInput) => Promise<IWorkspaceDTO>;
    archiveWorkspace: () => Promise<void>;
    restoreWorkspace: () => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseWorkspaceReturn {
    workspace: IWorkspaceDTO | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
}

interface IUseWorkspaceSeatsReturn {
    seats: IWorkspaceSeatsResult | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
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
    acceptInvitation: (code: string | IAcceptInvitationInput) => Promise<string>;
    leaveWorkspace: () => Promise<void>;
}

function useCan(operation: PermissionOperation, resource: string, client?: WorkspacesClient | undefined): boolean

function useCurrentWorkspace(client?: WorkspacesClient | undefined): IUseCurrentWorkspaceReturn

function useDeletedRoles(client?: WorkspacesClient | undefined): IUseDeletedRolesReturn

function useInvitations(client?: WorkspacesClient | undefined, opts?: IUseListPageOptions | undefined): IUseInvitationsReturn

function useMemberRoles(userId: string): IUseMemberRolesReturn

function useMembers(client?: WorkspacesClient | undefined, opts?: IUseListPageOptions | undefined): IUseMembersReturn

function useOwnershipOffer(client?: WorkspacesClient | undefined): IUseOwnershipOfferReturn

function usePermissionCatalog(client?: WorkspacesClient | undefined): IUsePermissionCatalogReturn

function usePermissions(client?: WorkspacesClient | undefined): IUsePermissionsReturn

function useRole(roleId: string): IUseRoleReturn

function useRolePermissions(roleId: string): IUseRolePermissionsReturn

function useRoles(client?: WorkspacesClient | undefined): IUseRolesReturn

function useWorkspace(workspaceId: string): IUseWorkspaceReturn

function useWorkspaceContacts(client?: WorkspacesClient | undefined): IUseWorkspaceContactsReturn

function useWorkspaceLocations(client?: WorkspacesClient | undefined): IUseWorkspaceLocationsReturn

function useWorkspaceProfile(client?: WorkspacesClient | undefined): IUseWorkspaceProfileReturn

function useWorkspaceSeats(client?: WorkspacesClient | undefined): IUseWorkspaceSeatsReturn

function useWorkspaceSettings(client?: WorkspacesClient | undefined): IUseWorkspaceSettingsReturn

function useWorkspaces(client?: WorkspacesClient | undefined): IUseWorkspacesReturn
```
