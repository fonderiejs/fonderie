<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/client — signatures

## @fonderie/client

```ts
interface IFonderieClientOptions {
    baseUrl: string;
    accessToken?: string;
}

new FonderieClient(opts: IFonderieClientOptions): FonderieClient
  .auth: AuthClient
  .billing: BillingClient
  .workspaces: WorkspacesClient
  .audit: AuditClient

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface IListAuditEventsInput {
    type?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string;
}

new AuditClient(http: HttpClient, tokens: TokenStore): AuditClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listEvents(input?: IListAuditEventsInput): Promise<IApiResponse<IAuditPageResult>>

interface ILoginInput {
    email: string;
    password: string;
}

interface IRegisterInput {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
}

interface IResetPasswordInput {
    resetToken: string;
    password: string;
}

interface IUpdateUserInput {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    locale?: string;
    timezone?: string;
    preferences?: Record<string, unknown>;
}

new AuthClient(http: HttpClient, tokens: TokenStore): AuthClient
  .phone: PhoneClient
  .mfa: MfaClient
  .setAccessToken(token: string | undefined): void
  .register(input: IRegisterInput): Promise<IApiResponse<IRegisterResult>>
  .login(input: ILoginInput): Promise<IApiResponse<ILoginResult>>
  .refreshTokens(refreshToken?: string | undefined): Promise<IApiResponse<IRefreshResult>>
  .forgotPassword(email: string): Promise<IApiResponse<undefined>>
  .resetPassword(input: IResetPasswordInput): Promise<IApiResponse<undefined>>
  .verifyEmail(pin: string): Promise<IApiResponse<IVerifyEmailResult>>
  .logout(refreshToken?: string | undefined): Promise<IApiResponse<undefined>>
  .sendVerificationEmail(): Promise<IApiResponse<IResendVerificationResult>>
  .getUser(): Promise<IApiResponse<IMeResult>>
  .updateUser(input: IUpdateUserInput): Promise<IApiResponse<IMeResult>>
  .deleteUser(): Promise<IApiResponse<undefined>>

interface ICheckoutInput {
    plan: string;
    interval?: 'month' | 'year';
}

interface IRecordUsageInput {
    metric: string;
    quantity?: number;
}

new BillingClient(http: HttpClient, tokens: TokenStore): BillingClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listPlans(): Promise<IApiResponse<IPlanListResult>>
  .getPlan(planId: string): Promise<IApiResponse<IPlanResult>>
  .getSubscription(): Promise<IApiResponse<ISubscriptionResult>>
  .createCheckoutSession(input: ICheckoutInput): Promise<IApiResponse<ICheckoutUrlResult>>
  .createPortalSession(): Promise<IApiResponse<IPortalUrlResult>>
  .recordUsage(input: IRecordUsageInput): Promise<IApiResponse<undefined>>
  .getUsage(metric: string): Promise<IApiResponse<IUsageResult>>

interface IConfigAdminClientOptions {
    baseUrl: string;
    adminToken: string;
}

interface IRollbackInput {
    toVersion: number;
}

interface ISetConfigInput {
    value: unknown;
    description?: string;
    ifVersion?: number;
}

interface ISetSecretInput {
    value: string;
    description?: string;
    ifVersion?: number;
}

new ConfigAdminClient(opts: IConfigAdminClientOptions): ConfigAdminClient
  .listConfig(environment?: string | undefined): Promise<IApiResponse<IConfigEntry[]>>
  .getConfig(key: string, environment?: string | undefined): Promise<IApiResponse<IConfigEntry>>
  .setConfig(key: string, input: ISetConfigInput, environment?: string | undefined): Promise<IApiResponse<IConfigEntry>>
  .deleteConfig(key: string, environment?: string | undefined): Promise<IApiResponse<undefined>>
  .listConfigRevisions(key: string, environment?: string | undefined): Promise<IApiResponse<IConfigRevision[]>>
  .rollbackConfig(key: string, input: IRollbackInput, environment?: string | undefined): Promise<IApiResponse<IConfigEntry>>
  .listSecrets(environment?: string | undefined): Promise<IApiResponse<ISecretEntry[]>>
  .getSecret(key: string, environment?: string | undefined): Promise<IApiResponse<ISecretEntry>>
  .setSecret(key: string, input: ISetSecretInput, environment?: string | undefined): Promise<IApiResponse<ISecretEntry>>
  .deleteSecret(key: string, environment?: string | undefined): Promise<IApiResponse<undefined>>
  .listSecretRevisions(key: string, environment?: string | undefined): Promise<IApiResponse<ISecretRevision[]>>
  .rollbackSecret(key: string, input: IRollbackInput, environment?: string | undefined): Promise<IApiResponse<ISecretEntry>>
  .revealSecret(key: string, environment?: string | undefined): Promise<IApiResponse<IRevealSecretResult>>

interface ICourierAdminClientOptions {
    baseUrl: string;
    adminToken: string;
}

interface IRollbackTemplateInput {
    toVersion: number;
}

interface ISetTemplateInput {
    text: string;
    subject?: string;
    html?: string;
    active?: boolean;
    ifVersion?: number;
}

new CourierAdminClient(opts: ICourierAdminClientOptions): CourierAdminClient
  .listTemplates(): Promise<IApiResponse<ITemplateEntry[]>>
  .getTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>
  .setTemplate(type: string, input: ISetTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>
  .deleteTemplate(type: string, locale?: string | null | undefined): Promise<IApiResponse<undefined>>
  .listRevisions(type: string, locale?: string | null | undefined): Promise<IApiResponse<ITemplateRevision[]>>
  .rollback(type: string, input: IRollbackTemplateInput, locale?: string | null | undefined): Promise<IApiResponse<ITemplateEntry>>

interface ICreateRoleInput {
    name: string;
    description?: string;
}

interface ICreateWorkspaceInput {
    name: string;
    description?: string;
    type?: string;
}

interface IInviteEntry {
    email: string;
    roleId?: string;
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

interface IAcceptInvitationResult {
    workspaceId: string;
}

interface IApiError {
    reason: string;
    explanation: string;
    details?: unknown;
}

interface IApiResponse<T = undefined> {
    reason: string;
    explanation: string;
    result: T;
}

interface IAuditEventDTO {
    id: string;
    type: string;
    actorId: string | null;
    requestId: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
}

interface IAuditPageResult {
    events: IAuditEventDTO[];
    nextCursor: string | null;
}

interface ICheckoutUrlResult {
    url: string;
}

interface IConfigEntry {
    key: string;
    value: unknown;
    environment: string;
    description: string | null;
    active: boolean;
    version: number;
    updatedBy: string | null;
    updatedAt: string;
}

interface IConfigRevision {
    key: string;
    environment: string;
    value: unknown;
    version: number;
    actor: string | null;
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

interface IInvitationListResult {
    invitations: IInvitationDTO[];
}

interface IInviteResult {
    invitations: Array<{
        invitationId: string;
        email: string;
    }>;
}

interface ILoginResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface IMemberDTO {
    userId: string;
    workspaceId: string;
    roleId: string;
    roleName: string;
    confirmed: boolean;
    createdAt: string;
}

interface IMemberListResult {
    members: IMemberDTO[];
}

interface IMeResult {
    user: IUserDTO;
}

interface IMfaEnabledResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface IMfaSetupResult {
    secret: string;
    uri: string;
}

interface IPlanDTO {
    id: string;
    planId: string;
    name: string;
    description: string;
    tier: number;
    seats: number | null;
    trialDays: number;
    pricing: {
        monthly: number;
        yearly: number;
        currency: string;
    };
    features: IPlanFeature[];
    metadata: Record<string, unknown>;
}

interface IPlanFeature {
    name: string;
    description: string;
    enabled: boolean;
    limit?: number;
}

interface IPlanListResult {
    plans: IPlanDTO[];
}

interface IPlanResult {
    plan: IPlanDTO;
}

interface IPortalUrlResult {
    url: string;
}

interface IRefreshResult {
    tokens: ITokens;
}

interface IRegisterResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface IResendVerificationResult {
    stat: string;
    message: string;
    data: {
        token: string;
        expiresAt: string;
        email: string;
    };
}

interface IRevealSecretResult {
    value: string;
}

interface IRoleDTO {
    id: string;
    name: string;
    isSystem: boolean;
    active: boolean;
    description: string;
    workspaceId: string;
}

interface IRoleListResult {
    roles: IRoleDTO[];
}

interface IRoleResult {
    role: IRoleDTO;
}

interface ISecretEntry {
    key: string;
    environment: string;
    description: string | null;
    active: boolean;
    version: number;
    updatedBy: string | null;
    updatedAt: string;
}

interface ISecretRevision {
    key: string;
    environment: string;
    version: number;
    actor: string | null;
    createdAt: string;
}

interface ISubscriptionDTO {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    plan: string;
    interval: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    createdAt: string;
}

interface ISubscriptionResult {
    subscription: ISubscriptionDTO;
}

interface ITemplateEntry {
    type: string;
    locale: string | null;
    subject: string | null;
    html: string | null;
    text: string;
    active: boolean;
    version: number;
    updatedBy: string | null;
    updatedAt: string;
}

interface ITemplateRevision {
    type: string;
    locale: string | null;
    subject: string | null;
    html: string | null;
    text: string;
    version: number;
    actor: string | null;
    createdAt: string;
}

interface ITokens {
    access: string;
    refresh: string;
}

interface IUsageResult {
    metric: string;
    total: number;
    since: string;
}

interface IUserDTO {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    profileImageUrl: string;
    isActive: boolean;
    lastLogin: string;
    skills: IUserSkill[];
    preferences: IUserPreferences;
    isEmailVerified: boolean;
    mfaEnabled: boolean;
    suspended: boolean;
    whitelist: boolean;
    ipWhitelist: string[];
    createdAt: string;
    updatedAt: string;
}

interface IUserPreferences {
    locale: string;
    timezone: string;
    notifications: {
        email: boolean;
        inApp: boolean;
        sms: boolean;
        push: boolean;
    };
    emailDigest: string;
    dateFormat: string;
    timeFormat: string;
}

interface IUserSkill {
    name: string;
    level: string;
}

interface IVerifyEmailResult {
    verified: boolean;
    email: string;
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

interface IWorkspaceListResult {
    workspaces: IWorkspaceDTO[];
}

interface IWorkspaceResult {
    workspace: IWorkspaceDTO;
}

interface IWorkspaceSettingsDTO {
    locale: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    timeFormat: string;
}

interface IWorkspaceSettingsResult {
    settings: IWorkspaceSettingsDTO;
}

type SubscriberType = 'user' | 'workspace';
```
