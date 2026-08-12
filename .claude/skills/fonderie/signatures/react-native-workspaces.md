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
    refresh: () => Promise<void>;
    invite: (entries: IInviteEntry | IInviteEntry[]) => Promise<void>;
    cancelInvitation: (inviteId: string) => Promise<void>;
}

interface IUseMembersReturn {
    members: IMemberDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

interface IUseRemoveMemberReturn {
    removeMember: (userId: string) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseWorkspaceSettingsReturn {
    settings: IWorkspaceSettingsDTO | null;
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
    updateSettings: (input: IUpdateSettingsInput) => Promise<void>;
}

interface IUseWorkspacesReturn {
    workspaces: IWorkspaceDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: () => Promise<void>;
}

function useAcceptInvitation(client: WorkspacesClient): IUseAcceptInvitationReturn

function useCreateWorkspace(client: WorkspacesClient): IUseCreateWorkspaceReturn

function useInvitations(client: WorkspacesClient): IUseInvitationsReturn

function useMembers(client: WorkspacesClient): IUseMembersReturn

function useRemoveMember(client: WorkspacesClient): IUseRemoveMemberReturn

function useWorkspaceSettings(client: WorkspacesClient): IUseWorkspaceSettingsReturn

function useWorkspaces(client: WorkspacesClient): IUseWorkspacesReturn
```
