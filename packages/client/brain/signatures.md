<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/client — signatures

## @fonderie/client

```ts
interface IClientAuthConfig {
    getRefreshToken?: () => string | undefined;
    onTokensChanged?: (tokens: ITokens) => void;
    onAuthError?: () => void;
}

interface IFonderieClientOptions {
    baseUrl: string;
    accessToken?: string;
    workspaceId?: string;
    cache?: ICache;
    auth?: IClientAuthConfig;
}

interface IRequestConfig {
    workspaceId?: string;
    cache?: number | false;
    bust?: boolean;
    invalidate?: string[];
}

interface ICache {
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, ttlMs: number): void;
    dedupe<T>(key: string, fn: () => Promise<T>): Promise<T>;
    invalidate(fragment: string): void;
    clear(): void;
}

interface IMemoryCacheOptions {
    defaultTtlMs?: number;
}

function createMemoryCache(opts?: IMemoryCacheOptions): ICache & { defaultTtlMs: number; }

new FonderieClient(opts: IFonderieClientOptions): FonderieClient
  .auth: AuthClient
  .billing: BillingClient
  .workspaces: WorkspacesClient
  .audit: AuditClient
  .webhooks: WebhooksClient
  .customers: CustomersClient
  .setAccessToken(token: string | undefined): void
  .clearCache(): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .request<T = unknown>(opts: { method: string; path: string; body?: unknown; workspaceId?: string | undefined; cache?: number | false | undefined; bust?: boolean | undefined; invalidate?: string[] | undefined; }): Promise<IApiResponse<...>>
  .get<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .post<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .put<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .patch<T = unknown>(path: string, body?: unknown, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>
  .delete<T = unknown>(path: string, config?: IRequestConfig | undefined): Promise<IApiResponse<T>>

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

interface IChangePasswordInput {
    currentPassword: string;
    newPassword: string;
}

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
    pin: string;
    password: string;
}

interface IUpdatePreferencesInput {
    locale?: string;
    timezone?: string;
    notifications?: unknown;
    emailDigest?: unknown;
    dateFormat?: unknown;
    timeFormat?: unknown;
}

interface IUpdateProfileInput {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
}

new AuthClient(http: HttpClient, tokens: TokenStore): AuthClient
  .mfa: MfaClient
  .setAccessToken(token: string | undefined): void
  .register(input: IRegisterInput): Promise<IApiResponse<IRegisterResult>>
  .login(input: ILoginInput): Promise<IApiResponse<ILoginResult>>
  .refreshTokens(refreshToken?: string | undefined): Promise<IApiResponse<IRefreshResult>>
  .forgotPassword(email: string): Promise<IApiResponse<undefined>>
  .resetPassword(input: IResetPasswordInput): Promise<IApiResponse<undefined>>
  .verifyEmail(token: string): Promise<IApiResponse<IVerifyEmailResult>>
  .logout(refreshToken?: string | undefined): Promise<IApiResponse<undefined>>
  .sendVerificationEmail(): Promise<IApiResponse<IResendVerificationResult>>
  .getUser(): Promise<IApiResponse<IMeResult>>
  .updateProfile(input: IUpdateProfileInput): Promise<IApiResponse<IMeResult>>
  .updatePreferences(input: IUpdatePreferencesInput): Promise<IApiResponse<IMeResult>>
  .updateEmail(email: string): Promise<IApiResponse<unknown>>
  .updatePhone(phone: string): Promise<IApiResponse<unknown>>
  .changePassword(input: IChangePasswordInput): Promise<IApiResponse<undefined>>
  .exportData(): Promise<IApiResponse<unknown>>
  .deleteUser(): Promise<IApiResponse<undefined>>

interface ICheckoutInput {
    plan: string;
    interval?: 'month' | 'year';
}

interface ICreatePlanInput {
    name: string;
    description?: string | null;
    tier?: number;
    seats?: number | null;
    trialDays?: number;
    monthlyAmount?: number | null;
    monthlyPriceId?: string | null;
    yearlyAmount?: number | null;
    yearlyPriceId?: string | null;
    features?: unknown;
    metadata?: unknown;
}

interface IRecordUsageInput {
    metric: string;
    quantity?: number;
}

type IUpdatePlanInput = Partial<ICreatePlanInput>;

new BillingClient(http: HttpClient, tokens: TokenStore): BillingClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listPlans(): Promise<IApiResponse<IPlanListResult>>
  .getPlan(planId: string): Promise<IApiResponse<IPlanResult>>
  .createPlan(input: ICreatePlanInput): Promise<IApiResponse<IPlanResult>>
  .updatePlan(planId: string, input: Partial<ICreatePlanInput>): Promise<IApiResponse<IPlanResult>>
  .deletePlan(planId: string): Promise<IApiResponse<undefined>>
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

interface IAddAddressInput {
    countryIso: string;
    zipPostalCode: string;
    subdivision1Iso?: string | null;
    subdivision2Iso?: string | null;
    unit?: string | null;
    line1?: string | null;
    line2?: string | null;
    label?: string;
    isPrimary?: boolean;
}

interface IAddEmailInput {
    email: string;
    label?: string;
    isPrimary?: boolean;
}

interface IAddPhoneInput {
    phone: string;
    label?: string;
    isPrimary?: boolean;
}

interface IAddRelationshipInput {
    relatedId: string;
    relationship?: string;
    isPrimary?: boolean;
}

interface IBlacklistCustomerInput {
    reason?: string;
}

interface ICreateCustomerInput {
    type?: CustomerType;
    sex?: CustomerSex;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    avatarUrl?: string | null;
    locale?: string | null;
    referenceCode?: string | null;
    referralCode?: string | null;
    referredByCode?: string | null;
}

interface IGetCustomerInput {
    depth?: 1 | 2;
}

interface IListCustomersInput {
    search?: string;
    blacklisted?: boolean;
    limit?: number;
    offset?: number;
}

type IUpdateCustomerInput = ICreateCustomerInput;

new CustomersClient(http: HttpClient, tokens: TokenStore): CustomersClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listCustomers(input?: IListCustomersInput): Promise<IApiResponse<ICustomerListResult>>
  .createCustomer(input?: ICreateCustomerInput): Promise<IApiResponse<ICustomerResult>>
  .getCustomer(customerId: string, input?: IGetCustomerInput): Promise<IApiResponse<ICustomerDetailDTO | ICustomerDetailD2DTO>>
  .updateCustomer(customerId: string, input: ICreateCustomerInput): Promise<IApiResponse<ICustomerResult>>
  .deleteCustomer(customerId: string): Promise<IApiResponse<undefined>>
  .blacklistCustomer(customerId: string, input?: IBlacklistCustomerInput): Promise<IApiResponse<undefined>>
  .unblacklistCustomer(customerId: string): Promise<IApiResponse<undefined>>
  .listEmails(customerId: string): Promise<IApiResponse<ICustomerEmailListResult>>
  .addEmail(customerId: string, input: IAddEmailInput): Promise<IApiResponse<ICustomerEmailResult>>
  .updateEmailLabel(customerId: string, emailId: string, label: string): Promise<IApiResponse<ICustomerEmailResult>>
  .setPrimaryEmail(customerId: string, emailId: string): Promise<IApiResponse<undefined>>
  .removeEmail(customerId: string, emailId: string): Promise<IApiResponse<undefined>>
  .listPhones(customerId: string): Promise<IApiResponse<ICustomerPhoneListResult>>
  .addPhone(customerId: string, input: IAddPhoneInput): Promise<IApiResponse<ICustomerPhoneResult>>
  .updatePhoneLabel(customerId: string, phoneId: string, label: string): Promise<IApiResponse<ICustomerPhoneResult>>
  .setPrimaryPhone(customerId: string, phoneId: string): Promise<IApiResponse<undefined>>
  .removePhone(customerId: string, phoneId: string): Promise<IApiResponse<undefined>>
  .listAddresses(customerId: string): Promise<IApiResponse<ICustomerAddressListResult>>
  .addAddress(customerId: string, input: IAddAddressInput): Promise<IApiResponse<ICustomerAddressResult>>
  .updateAddressLabel(customerId: string, addrId: string, label: string): Promise<IApiResponse<ICustomerAddressResult>>
  .setPrimaryAddress(customerId: string, addrId: string): Promise<IApiResponse<undefined>>
  .removeAddress(customerId: string, addrId: string): Promise<IApiResponse<undefined>>
  .listNotes(customerId: string): Promise<IApiResponse<ICustomerNoteListResult>>
  .createNote(customerId: string, body: string): Promise<IApiResponse<ICustomerNoteResult>>
  .updateNote(customerId: string, noteId: string, body: string): Promise<IApiResponse<ICustomerNoteResult>>
  .deleteNote(customerId: string, noteId: string): Promise<IApiResponse<undefined>>
  .listTags(customerId: string): Promise<IApiResponse<ICustomerTagListResult>>
  .addTag(customerId: string, tag: string): Promise<IApiResponse<undefined>>
  .removeTag(customerId: string, tag: string): Promise<IApiResponse<undefined>>
  .listRelationships(customerId: string): Promise<IApiResponse<ICustomerRelationshipListResult>>
  .addRelationship(customerId: string, input: IAddRelationshipInput): Promise<IApiResponse<ICustomerRelationshipResult>>
  .setPrimaryRelationship(customerId: string, relatedId: string): Promise<IApiResponse<undefined>>
  .removeRelationship(customerId: string, relatedId: string): Promise<IApiResponse<undefined>>
  .listLabels(type: CustomerLabelType): Promise<IApiResponse<ICustomerLabelListResult>>
  .removeLabel(labelId: string): Promise<IApiResponse<undefined>>

interface ICreateWebhookEndpointInput {
    url: string;
    events?: string[];
}

interface IUpdateWebhookEndpointInput {
    url?: string;
    events?: string[];
    enabled?: boolean;
}

new WebhooksClient(http: HttpClient, tokens: TokenStore): WebhooksClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listEndpoints(): Promise<IApiResponse<IWebhookEndpointListResult>>
  .createEndpoint(input: ICreateWebhookEndpointInput): Promise<IApiResponse<IWebhookEndpointCreatedDTO>>
  .getEndpoint(endpointId: string): Promise<IApiResponse<IWebhookEndpointDTO>>
  .updateEndpoint(endpointId: string, input: IUpdateWebhookEndpointInput): Promise<IApiResponse<IWebhookEndpointDTO>>
  .deleteEndpoint(endpointId: string): Promise<undefined>
  .listDeliveries(endpointId: string): Promise<IApiResponse<IWebhookDeliveryListResult>>
  .testEndpoint(endpointId: string): Promise<IApiResponse<ITestWebhookResult>>

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

interface IRolePermissionsResult {
    permissions: IRolePermission[];
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
  .archiveWorkspace(): Promise<IApiResponse<undefined>>
  .restoreWorkspace(): Promise<IApiResponse<undefined>>
  .listRoles(): Promise<IApiResponse<IRoleListResult>>
  .createRole(input: ICreateRoleInput): Promise<IApiResponse<IRoleResult>>
  .getRole(roleId: string): Promise<IApiResponse<IRoleResult>>
  .updateRole(roleId: string, input: IUpdateRoleInput): Promise<IApiResponse<IRoleResult>>
  .removeRole(roleId: string): Promise<IApiResponse<undefined>>
  .getRolePermissions(roleId: string): Promise<IApiResponse<IRolePermissionsResult>>
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

type CustomerLabelType = 'phone' | 'email' | 'address';

type CustomerSex = 'UNKNOWN' | 'MALE' | 'FEMALE';

type CustomerType = 'individual' | 'business';

interface IAcceptInvitationResult {
    workspaceId: string;
}

interface IAddressDTO {
    countryIso: string;
    subdivision1Iso: string;
    subdivision2Iso: string;
    zipPostalCode: string;
    unit: string;
    line1: string;
    line2: string;
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

interface ICustomerAddressDTO {
    id: string;
    label: string;
    isPrimary: boolean;
    address: IAddressDTO;
}

interface ICustomerAddressListResult {
    addresses: ICustomerAddressDTO[];
}

interface ICustomerAddressResult {
    address: ICustomerAddressDTO;
}

interface ICustomerDetailD2DTO extends Omit<ICustomerDetailDTO, 'relationships'> {
    relationships: ICustomerRelationshipExpandedD2DTO[];
}

interface ICustomerDetailDTO extends ICustomerDTO {
    emails: ICustomerEmailDTO[];
    phones: ICustomerPhoneDTO[];
    addresses: ICustomerAddressDTO[];
    notes: ICustomerNoteDTO[];
    relationships: ICustomerRelationshipExpandedDTO[];
    tags: string[];
}

interface ICustomerDTO {
    id: string;
    type: string;
    sex: CustomerSex;
    firstName: string;
    lastName: string;
    companyName: string;
    avatarUrl: string;
    locale: string;
    referenceCode: string;
    referralCode: string;
    referredBy: string | null;
    blacklisted: {
        status: boolean;
        reason: string | null;
    };
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

interface ICustomerEmailDTO {
    id: string;
    email: string;
    label: string;
    isPrimary: boolean;
    createdAt: string;
}

interface ICustomerEmailListResult {
    emails: ICustomerEmailDTO[];
}

interface ICustomerEmailResult {
    email: ICustomerEmailDTO;
}

interface ICustomerLabelDTO {
    id: string;
    type: CustomerLabelType;
    value: string;
    createdAt: string;
}

interface ICustomerLabelListResult {
    labels: ICustomerLabelDTO[];
}

interface ICustomerListResult {
    customers: ICustomerDTO[];
}

interface ICustomerNoteDTO {
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}

interface ICustomerNoteListResult {
    notes: ICustomerNoteDTO[];
}

interface ICustomerNoteResult {
    note: ICustomerNoteDTO;
}

interface ICustomerPhoneDTO {
    id: string;
    phone: string;
    label: string;
    isPrimary: boolean;
    createdAt: string;
}

interface ICustomerPhoneListResult {
    phones: ICustomerPhoneDTO[];
}

interface ICustomerPhoneResult {
    phone: ICustomerPhoneDTO;
}

interface ICustomerRelationshipDTO {
    id: string;
    relatedId: string;
    relationship: string;
    isPrimary: boolean;
    createdAt: string;
}

type ICustomerRelationshipExpandedD2DTO = ICustomerRelationshipExpandedDTO & {
    relationships: ICustomerRelationshipExpandedDTO[];
};

type ICustomerRelationshipExpandedDTO = Omit<ICustomerShallowDTO, 'id'> & {
    id: string;
    customerId: string;
    relationship: string;
    isPrimary: boolean;
};

interface ICustomerRelationshipListResult {
    relationships: ICustomerRelationshipDTO[];
}

interface ICustomerRelationshipResult {
    relationship: ICustomerRelationshipDTO;
}

interface ICustomerResult {
    customer: ICustomerDTO;
}

interface ICustomerShallowDTO extends ICustomerDTO {
    emails: ICustomerEmailDTO[];
    phones: ICustomerPhoneDTO[];
    addresses: ICustomerAddressDTO[];
    notes: ICustomerNoteDTO[];
    tags: string[];
}

interface ICustomerTagListResult {
    tags: string[];
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

interface ITestWebhookResult {
    status: number | null;
    ok: boolean;
    error?: string;
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

interface IWebhookDeliveryDTO {
    id: string;
    eventId: string;
    eventType: string;
    status: string;
    attempts: number;
    responseStatus: number | null;
    deliveredAt: string | null;
    createdAt: string;
}

interface IWebhookDeliveryListResult {
    deliveries: IWebhookDeliveryDTO[];
}

interface IWebhookEndpointCreatedDTO extends IWebhookEndpointDTO {
    secret: string;
}

interface IWebhookEndpointDTO {
    id: string;
    url: string;
    events: string[];
    enabled: boolean;
    createdAt: string;
}

interface IWebhookEndpointListResult {
    endpoints: IWebhookEndpointDTO[];
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
