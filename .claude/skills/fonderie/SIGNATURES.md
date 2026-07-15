# Fonderie — generated API signatures

<!-- GENERATED FILE — do not edit. Regenerate with: npm run docs:signatures -->

Exact public signatures extracted from source by `scripts/generate-signatures.mjs`.
For the curated wiring guide (composition rules, golden example, routes), see
[API.md](API.md). If a signature here disagrees with API.md, this file wins.

## @fonderie/core

Subpath exports: `@fonderie/core/config`, `@fonderie/core/types`, `@fonderie/core/middlewares`, `@fonderie/core/parser`, `@fonderie/core/response`

```ts
interface ITenant {
    id: string;
    slug: string;
    plan: string;
}

interface IRouter {
    match(method: string, path: string): IRouteMatch | null;
    add(method: string, path: string, handler: Middleware): void;
}

type Operation = 'create' | 'read' | 'update' | 'delete';

interface IAuthUser {
    id: string;
    email: string | null;
    phone: string | null;
    suspended: boolean;
    mfaEnabled: boolean;
    deletedAt: Date | null;
    emailVerifiedAt: Date | null;
    loginMethod: 'email' | 'phone' | 'google';
    phoneVerified: boolean;
    mfaPending?: boolean;
}

type Middleware = (ctx: IFonderieContext, next: () => Promise<Response>) => Promise<Response>;

interface IWorkspace {
    id: string;
    name: string;
    isPersonal?: boolean;
}

interface IRouteMatch {
    handler: Middleware;
    params: Record<string, string>;
}

interface IFonderieApp {
    use(middleware: Middleware): IFonderieApp;
    register(module: IFonderieModule): IFonderieApp;
    addRoute(method: string, path: string, ...handlers: Middleware[]): void;
    listen(port: number, options?: {
        name?: string;
        version?: string;
        env?: string;
    }): void;
}

interface IFonderieModule {
    name: string;
    deps?: string[];
    install(app: IFonderieApp): void | Promise<void>;
}

interface IFonderieContext {
    request: Request;
    meta: IFonderieContextMeta;
    readonly tenant: ITenant | null;
    readonly user: IAuthUser | null;
    readonly workspace: IWorkspace | null;
    _router: IRouter;
}

interface ICourierMessage {
    type: string;
    locale?: string;
    recipient: {
        email: string | null;
        phone: string | null;
        deviceToken: string | null;
    };
    data: Record<string, unknown>;
}

interface IFonderieContextMeta {
    params?: Record<string, string>;
    body?: unknown;
    clientIp?: string;
    workspaceId?: string;
    userId?: string;
    userWorkspaceRoles?: string[];
    message?: ICourierMessage;
    [key: string]: unknown;
}

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

new FonderieApp(config: FonderieConfig): FonderieApp
  .listen(port: number, options?: { name?: string; version?: string; env?: string; }): void
  .register(module: IFonderieModule): FonderieApp
  .boot(): Promise<FonderieApp>
  .buildContext(request: Request): Promise<IFonderieContext>
  .use(middleware: Middleware): FonderieApp
  .addRoute(method: string, path: string, ...handlers: Middleware[]): void
  .handle(request: Request): Promise<Response>

function defineConfig(config: FonderieConfig): FonderieConfig

function compose(middlewares: Middleware[]): (ctx: IFonderieContext, fallback: () => Promise<Response>) => Promise<Response>

interface FonderieConfig {
    basePath?: string;
    db: {
        url: string;
    };
    billing?: {
        provider: 'stripe';
        plans: IBillingPlan[];
        stripeSecretKey: string;
    };
    email?: {
        from: string;
        apiKey?: string;
        smtp?: ISMTPConfig;
        provider: 'resend' | 'ses' | 'smtp';
    };
    onError?: (err: unknown) => Response;
}

function stringOrEmpty(value: unknown): string

function booleanOrFalse(value: unknown): boolean

function arrayOrEmpty<T>(value: unknown): T[]

function numberOrZero(value: unknown): number

function dateOrEmpty(value: unknown): string

interface IApiError {
    reason: string;
    explanation: string;
    details?: unknown;
}

type HttpStatus = (typeof HTTP)[keyof typeof HTTP];

const HTTP: { readonly OK: 200; readonly CREATED: 201; readonly ACCEPTED: 202; readonly NO_CONTENT: 204; readonly BAD_REQUEST: 400; readonly UNAUTHORIZED: 401; readonly PAYMENT_REQUIRED: 402; readonly FORBIDDEN: 403; readonly NOT_FOUND: 404; readonly CONFLICT: 409; readonly GONE: 410; readonly UNPROCESSABLE: 422; readonly TOO_MANY_REQUESTS: 429; readonly SERVER_ERROR: 500; readonly NOT_IMPLEMENTED: 501; readonly BAD_GATEWAY: 502; readonly SERVICE_UNAVAILABLE: 503; }

function setApiResponse<T>(status: number, reason: string, explanation: string, payload?: T | undefined): Response
```

## @fonderie/store

Subpath exports: `@fonderie/store/sql`, `@fonderie/store/types`, `@fonderie/store/migrations`

```ts
function sql(strings: TemplateStringsArray, ...values: unknown[]): ISqlQuery

interface ISqlQuery {
    text: string;
    params: unknown[];
}

interface IStoreAdapter {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T>;
}

interface IPoolConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    ssl?: boolean | {
        rejectUnauthorized: boolean;
    };
}

new MigrationRunner(store: IStoreAdapter, migrationsDir: string): MigrationRunner
  .run(): Promise<void>

new InternalMigrationRunner(store: IStoreAdapter, migrationsDir: string): InternalMigrationRunner
  .run(): Promise<void>

function createMigrationsPath(importMetaUrl: string): string

new PGAdapter(config: string | IPoolConfig): PGAdapter
  .testConnection(): Promise<boolean>
  .query<T = unknown>(sql: string, params?: unknown[] | undefined): Promise<T[]>
  .transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T>
  .end(): Promise<void>
```

## @fonderie/events

Subpath exports: `@fonderie/events/migrations`

```ts
new EventBus(transport: IEventTransport): EventBus
  .emit<T = unknown>(type: string, payload: T, opts?: { requestId?: string; } | undefined): Promise<void>
  .on<T = unknown>(type: string, handler: IEventHandler<T>, consumer?: string): void
  .start(): Promise<void>
  .stop(): Promise<void>

new EventsModule(config: IEventsConfig): EventsModule
  .name: "@fonderie/events"
  .bus: EventBus
  .install(_app: IFonderieApp): void

interface IEventsConfig {
    transport: EventTransportConfig;
}

type EventTransportConfig = {
    type: 'pg';
    connectionUrl: string;
    maxRetries?: number;
    batchSize?: number;
    pollInterval?: number;
} | IEventTransport;

new MemoryTransport(): MemoryTransport
  .publish(type: string, payload: unknown, meta: IEventMeta): Promise<void>
  .subscribe(pattern: string, handler: IEventHandler, _consumer: string): void
  .start(): Promise<void>
  .stop(): Promise<void>

new PGTransport(config: IPGTransportConfig): PGTransport
  .subscribe(pattern: string, handler: IEventHandler, consumer: string): void
  .publish(type: string, payload: unknown, meta: IEventMeta): Promise<void>
  .start(): Promise<void>
  .stop(): Promise<void>

interface IEventTransport {
    publish(type: string, payload: unknown, meta: IEventMeta): Promise<void>;
    subscribe(type: string, handler: IEventHandler, consumer: string): void;
    start(): Promise<void>;
    stop(): Promise<void>;
}

interface IPGTransportConfig {
    connectionUrl: string;
    maxRetries?: number;
    batchSize?: number;
    pollInterval?: number;
}

function matchesPattern(pattern: string, eventType: string): boolean

interface IEventMeta {
    id: string;
    type: string;
    emittedAt: string;
    attempts: number;
    requestId?: string;
}

type IEventHandler<T = unknown> = (payload: T, meta: IEventMeta) => Promise<void>;

interface IEventRecord {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    meta: IEventMeta;
    created_at: Date;
}

interface IConsumerRecord {
    event_id: string;
    consumer: string;
    status: 'pending' | 'processing' | 'processed' | 'failed' | 'dead';
    attempts: number;
    error: string | null;
    processed_at: Date | null;
}

const NOTIFICATION_EVENT: "fonderie.notification.send"

type NotificationEvent = typeof NOTIFICATION_EVENT;
```

## @fonderie/auth

Subpath exports: `@fonderie/auth/types`, `@fonderie/auth/middleware`, `@fonderie/auth/migrations`

```ts
interface IUser {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    profileImageUrl: string | null;
    locale: string;
    timezone: string;
    isActive: boolean;
    lastLogin: Date | null;
    preferences: IUserPreferences;
    suspended: boolean;
    whitelist: boolean;
    ipWhitelist: string[];
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    mfaEnabled: boolean;
    passwordHash: string | null;
    emailVerifiedAt: Date | null;
}

interface ISession {
    id: string;
    token: string;
    userId: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
    createdAt: Date;
}

interface IMfaChallenge {
    token: string;
    userId: string;
    expiresAt: Date;
    usedAt: Date | null;
}

new AuthModule(store: IStoreAdapter, config: IAuthConfig, bus?: EventBus | undefined): AuthModule
  .name: "@fonderie/auth"
  .install(app: IFonderieApp): void

interface IAuthConfig extends IAuthSecrets, IAuthRuntimeConfig {
    secureCookies?: boolean;
    rateLimit?: IAuthRateLimitConfig | false;
    providers: ('email' | 'phone' | 'google' | 'github')[];
    appName?: string;
    resolve?: (ctx: {
        meta: Record<string, unknown>;
    }) => Partial<IAuthRuntimeConfig>;
}

interface IAuthSecrets {
    jwtSecret: string;
    google?: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    };
}

interface IAuthRuntimeConfig {
    sessionDuration?: string;
    verificationCooldown?: number;
    mfa?: boolean;
    requireVerification?: boolean;
}

const AUTH_CONFIG_KEYS: { sessionDuration: string; verificationCooldown: string; mfa: string; requireVerification: string; }

const MESSAGE_KEYS: { readonly emailRegistration: "email-registration"; readonly emailVerification: "email-verification"; readonly passwordReset: "password-reset"; readonly phoneOtp: "phone-otp"; readonly mfaEnabled: "mfa-enabled"; readonly mfaDisabled: "mfa-disabled"; readonly mfaBackupCodesRegenerated: "mfa-backup-codes-regenerated"; readonly emailChanged: "email-changed"; readonly phoneChanged: "phone-changed"; }

type AuthMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

interface IUserDTO {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    profileImageUrl: string;
    isActive: boolean;
    lastLogin: string;
    preferences: IUserPreferences;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    mfaEnabled: boolean;
    suspended: boolean;
    whitelist: boolean;
    ipWhitelist: string[];
    createdAt: string;
    updatedAt: string;
}

function toUserDTO(user: IUser, phoneVerified?: boolean): IUserDTO

function validate(schema: IRequestSchema): Middleware

namespace schemas — exports: ChangePasswordInput, LoginInput, RegisterInput, ResetPasswordInput, changePasswordSchema, forgotPasswordSchema, loginSchema, mfaTokenSchema, refreshSchema, registerSchema, resetPasswordSchema, updateEmailSchema, updatePhoneSchema, updatePreferencesSchema, updateProfileSchema, verifySchema

type RegisterInput = z.infer<typeof registerSchema>;

type LoginInput = z.infer<typeof loginSchema>;

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

function withSession(store: IStoreAdapter, config: IAuthConfig): Middleware

function requireAuth(ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>

function normalizeEmail(email: string): string

function normalizeEmailSafe(email: string): string | null

function buildAuthLimiter(route: AuthLimitedRoute, store: IStoreAdapter, config: false | IAuthRateLimitConfig | undefined): Middleware | null

interface IAuthRateLimitConfig {
    store?: IRateLimitStore;
    rules?: Partial<Record<AuthLimitedRoute, IRateLimitRule | false>>;
}

type AuthLimitedRoute = 'login' | 'register' | 'forgot' | 'mfaVerify';
```

## @fonderie/courier

Subpath exports: `@fonderie/courier/types`, `@fonderie/courier/migrations`

```ts
new CourierModule(config: ICourierConfig, store?: IStoreAdapter | undefined, bus?: EventBus | undefined): CourierModule
  .name: "@fonderie/courier"
  .deps: string[]
  .dispatcher: Dispatcher
  .install(app: IFonderieApp): void

function handleSendGridDelivery(req: Request, store: IStoreAdapter, webhookSecret?: string | undefined): Promise<Response>

function handleMailgunDelivery(req: Request, store: IStoreAdapter, signingKey?: string | undefined): Promise<Response>

function handleMailtrapDelivery(req: Request, store: IStoreAdapter): Promise<Response>

new Dispatcher(config: ICourierConfig, resolver: ITemplateResolver, store?: IStoreAdapter | undefined): Dispatcher
  .registerChannel(channel: ICourierChannel): Dispatcher
  .dispatch(message: ICourierMessage): Promise<void>

new SmsChannel(config: ISmsChannelConfig): SmsChannel
  .name: "sms"
  .send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>

new PushChannel(config: IPushChannelConfig): PushChannel
  .name: "push"
  .send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>

new EmailChannel(config: IEmailChannelConfig): EmailChannel
  .name: "email"
  .send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>

new DBTemplateResolver(store: IStoreAdapter): DBTemplateResolver
  .resolve(type: string, data: Record<string, unknown>, locale?: string | undefined): Promise<IRenderedTemplate>

new FSTemplateResolver(directory: string): FSTemplateResolver
  .resolve(type: string, data: Record<string, unknown>, locale?: string | undefined): Promise<IRenderedTemplate>

interface IMessageLog {
    id: string;
    messageType: string;
    channel: string;
    recipient: string;
    locale: string | null;
    status: MessageLogStatus;
    error: string | null;
    attempts: number;
    provider: string | null;
    providerMessageId: string | null;
    openedAt: string | null;
    clickedAt: string | null;
    bouncedAt: string | null;
    bounceReason: string | null;
    createdAt: string;
    sentAt: string | null;
}

type MessageLogStatus = 'pending' | 'sent' | 'failed' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam';

interface ICourierMessage {
    type: string;
    locale?: string;
    recipient: {
        email: string | null;
        phone: string | null;
        deviceToken: string | null;
    };
    data: Record<string, unknown>;
}

interface ICourierChannel {
    name: string;
    send(message: ICourierMessage, template: IRenderedTemplate): Promise<void>;
}

interface IRenderedTemplate {
    subject?: string;
    html?: string;
    text: string;
}

interface ITemplateResolver {
    resolve(type: string, data: Record<string, unknown>, locale?: string): Promise<IRenderedTemplate>;
}

const Channel: { readonly EMAIL: "email"; readonly SMS: "sms"; readonly PUSH: "push"; }

interface ICourierConfig {
    channels: Record<string, Array<'email' | 'sms' | 'push'>>;
    sms?: ISmsChannelConfig;
    push?: IPushChannelConfig;
    email?: IEmailChannelConfig;
    templates?: {
        source: 'db' | 'fs';
        directory?: string;
    };
    delivery?: {
        signingKeys?: {
            sendgrid?: string;
            mailgun?: string;
        };
    };
}

interface IEmailChannelConfig {
    provider: 'resend' | 'ses' | 'smtp';
    from: string;
    apiKey?: string;
    smtp?: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
    };
}

interface ISmsChannelConfig {
    provider: 'twilio' | 'vonage';
    from: string;
    accountSid?: string;
    authToken?: string;
    apiKey?: string;
    apiSecret?: string;
}

interface IPushChannelConfig {
    provider: 'fcm';
    serviceAccount: Record<string, unknown>;
}
```

## @fonderie/workspaces

Subpath exports: `@fonderie/workspaces/types`, `@fonderie/workspaces/middleware`, `@fonderie/workspaces/migrations`

```ts
new WorkspacesModule(store: IStoreAdapter, config?: IWorkspacesConfig, bus?: EventBus | undefined): WorkspacesModule
  .name: "@fonderie/workspaces"
  .deps: string[]
  .install(app: IFonderieApp): void

interface IWorkspacesConfig {
    invitationTtl?: string;
    defaultRole?: string;
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

## @fonderie/billing

Subpath exports: `@fonderie/billing/types`, `@fonderie/billing/middleware`, `@fonderie/billing/migrations`

```ts
new BillingModule(store: IStoreAdapter, config: IBillingConfig): BillingModule
  .name: "@fonderie/billing"
  .deps: string[]
  .install(app: IFonderieApp): Promise<void>

new StripeProvider(secretKey: string, webhookSecret?: string | undefined): StripeProvider
  .name: "stripe"
  .createCustomer(opts: { email: string; subscriberType: SubscriberType; subscriberId: string; userId: string; }): Promise<{ customerId: string; }>
  .createCheckoutSession(opts: { customerId: string; priceId: string; subscriberType: SubscriberType; subscriberId: string; trialDays?: number; successUrl: string; cancelUrl: string; }): Promise<{ url: string; }>
  .createPortalSession(opts: { customerId: string; returnUrl: string; }): Promise<{ url: string; }>
  .constructEvent(opts: { payload: string; signature: string; secret: string; }): Promise<IBillingEvent>

function requirePlan(plans: string | string[], store: IStoreAdapter): Middleware

function withBilling(store: IStoreAdapter, config: IBillingConfig, backend: ICounterBackend): Middleware

function hasFeature(ctx: IFonderieContext, key: string): boolean

function getPlanLimit(ctx: IFonderieContext, key: string): number | null

function getLimitStatus(ctx: IFonderieContext, key: string): IPolicyStatus | null

function requireFeature(key: string): Middleware

const MESSAGE_KEYS: { readonly limitWarning: "billing.limit-warning"; readonly limitReached: "billing.limit-reached"; readonly limitBlocked: "billing.limit-blocked"; }

interface IBillingConfig {
    provider: IBillingProvider;
    plans: IBillingPlan[];
    successUrl: string;
    cancelUrl: string;
    webhookSecret?: string;
    rateLimit?: {
        backend?: RateLimitBackendConfig;
    };
    notifications?: IBillingNotificationsConfig;
}

interface IBillingPlan {
    name: string;
    description?: string;
    tier?: number;
    trialDays?: number;
    monthly?: IBillingPlanPrice;
    yearly?: IBillingPlanPrice;
    defaults?: IBillingPlanDefaults;
    policy?: Record<string, PolicyEntry>;
    metadata?: Record<string, unknown>;
}

interface IBillingPlanDefaults {
    warnAt?: number;
    buffer?: number;
}

type RateLimitBackendConfig = 'memory' | 'db' | ICounterBackend;

interface IBillingNotificationsConfig {
    warnAt?: boolean;
    softHit?: boolean;
}

type BillingMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

new MemoryCounterBackend(): MemoryCounterBackend
  .increment(key: string, windowMs: number | null, quantity?: number): Promise<number>
  .get(key: string, windowMs: number | null): Promise<number>

new DBCounterBackend(store: IStoreAdapter): DBCounterBackend
  .increment(key: string, windowMs: number | null, quantity?: number): Promise<number>
  .get(key: string, windowMs: number | null): Promise<number>

interface ICounterBackend {
    increment(key: string, windowMs: number | null, quantity?: number): Promise<number>;
    get(key: string, windowMs: number | null): Promise<number>;
}

interface IBillingProvider {
    name: string;
    createCustomer(opts: {
        email: string;
        subscriberType: SubscriberType;
        subscriberId: string;
        userId: string;
    }): Promise<{
        customerId: string;
    }>;
    createCheckoutSession(opts: {
        customerId: string;
        priceId: string;
        subscriberType: SubscriberType;
        subscriberId: string;
        trialDays?: number;
        successUrl: string;
        cancelUrl: string;
    }): Promise<{
        url: string;
    }>;
    createPortalSession(opts: {
        customerId: string;
        returnUrl: string;
    }): Promise<{
        url: string;
    }>;
    constructEvent(opts: {
        payload: string;
        signature: string;
        secret: string;
    }): Promise<IBillingEvent>;
}

interface IBillingEvent {
    type: string;
    subscription: INormalizedSubscription | null;
}

interface IPlan {
    id: string;
    name: string;
    seats: number | null;
    trialDays: number;
    monthlyAmount: number | null;
    monthlyPriceId: string | null;
    yearlyAmount: number | null;
    yearlyPriceId: string | null;
    description: string | null;
    tier: number;
    features: IPlanFeature[];
    metadata: Record<string, unknown>;
}

interface ISubscription {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    plan: string;
    interval: 'month' | 'year';
    status: SubscriptionStatus;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: string | null;
    createdAt: string;
}

interface IUsageRecord {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    metric: string;
    quantity: number;
    recordedAt: string;
}

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'paused';

type PolicyEntry = {
    enabled: boolean;
} | {
    limit: number | null;
    buffer?: number;
    warnAt?: number;
    window?: string;
    unit?: string;
};

type LimitStatus = 'ok' | 'warning' | 'over_limit' | 'blocked';

type IPolicyStatus = {
    type: 'feature';
    enabled: boolean;
} | {
    type: 'counter';
    limit: number | null;
    used: number;
    status: LimitStatus;
    resetsAt: string | null;
};

interface IBillingContext {
    subscriber: {
        type: SubscriberType;
        id: string;
    };
    plan: string;
    active: boolean;
    statuses: Record<string, IPolicyStatus>;
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

interface IUsageRecordDTO {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    metric: string;
    quantity: number;
    recordedAt: string;
}

function toPlanDTO(plan: IPlan): IPlanDTO

function toSubscriptionDTO(sub: ISubscription): ISubscriptionDTO

function toUsageRecordDTO(record: IUsageRecord): IUsageRecordDTO

function recordUsage(opts: { subscriberType: SubscriberType; subscriberId: string; metric: string; quantity: number; }, store: IStoreAdapter): Promise<void>

function getUsage(subscriberType: SubscriberType, subscriberId: string, metric: string, since: Date, store: IStoreAdapter): Promise<number>

function getPlans(config: IBillingConfig): IBillingPlan[]

function getPlanByName(name: string, config: IBillingConfig): IBillingPlan | null

function getDBPlans(store: IStoreAdapter): Promise<IPlan[]>

function getPlanById(id: string, store: IStoreAdapter): Promise<IPlan | null>

function createPlan(data: { name: string; description?: string | null; tier?: number; seats?: number | null; trialDays?: number; features?: unknown; metadata?: unknown; monthlyAmount?: number | null; monthlyPriceId?: string | null; yearlyAmount?: number | null; yearlyPriceId?: string | null; }, store: IStoreAdapter): Promise<...>

function updatePlan(id: string, data: Partial<Omit<IPlan, "id">>, store: IStoreAdapter): Promise<IPlan | null>

function deletePlan(id: string, store: IStoreAdapter): Promise<boolean>

function getSubscription(subscriberType: SubscriberType, subscriberId: string, store: IStoreAdapter): Promise<ISubscription | null>

namespace schemas — exports: checkoutSchema, createPlanSchema, recordUsageSchema, updatePlanSchema
```

## @fonderie/permissions

Subpath exports: `@fonderie/permissions/config`, `@fonderie/permissions/types`, `@fonderie/permissions/middleware`, `@fonderie/permissions/migrations`

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

new PermissionsModule(store: IStoreAdapter, config?: IPermissionsConfig): PermissionsModule
  .engine: PermissionsEngine
  .name: "@fonderie/permissions"
  .deps: string[]
  .install(app: IFonderieApp): void

new PermissionsEngine(store: IStoreAdapter, config?: IPermissionsConfig): PermissionsEngine
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
}

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

const PERMISSION_COLUMN: { create: string; read: string; update: string; delete: string; }

function requireRole(roleName: string | string[], store: IStoreAdapter): Middleware

function requirePermission(operation: Operation, permissionKey: string): Middleware
```

## @fonderie/config

Subpath exports: `@fonderie/config/types`, `@fonderie/config/middleware`, `@fonderie/config/migrations`

```ts
new RemoteConfigModule(store: IStoreAdapter, options?: IRemoteConfigOptions): RemoteConfigModule
  .name: "@fonderie/config"
  .manager: RemoteConfigManager
  .install(app: IFonderieApp): Promise<void>

new RemoteConfigManager(store: IStoreAdapter, options?: IRemoteConfigOptions): RemoteConfigManager
  .boot(): Promise<void>
  .stop(): void
  .get<T>(key: string, fallback: T): T
  .all(): Record<string, unknown>
  .refresh(): Promise<void>
  .isStale(): boolean

const CONFIG_MANAGER_KEY: "fonderie.config.snapshot"

function configContextMiddleware(manager: RemoteConfigManager): Middleware

function getConfig(ctx: { meta: Record<string, unknown>; }, key: string, fallback?: unknown): unknown

function listConfigEntries(environment: string | null, store: IStoreAdapter): Promise<IConfigEntry[]>

function getConfigEntry(key: string, environment: string, store: IStoreAdapter): Promise<IConfigEntry | null>

function setConfigEntry(opts: { key: string; value: unknown; environment?: string; description?: string; active?: boolean; }, store: IStoreAdapter): Promise<IConfigEntry>

function deleteConfigEntry(key: string, environment: string, store: IStoreAdapter): Promise<boolean>

interface IConfigEntry {
    key: string;
    value: unknown;
    environment: string;
    description: string | null;
    active: boolean;
    updatedAt: string;
}

interface IConfigSnapshot {
    entries: Record<string, unknown>;
    fetchedAt: Date;
}

interface IRemoteConfigOptions {
    ttl?: number;
    environment?: string;
    table?: string;
}
```

## @fonderie/customers

Subpath exports: `@fonderie/customers/types`, `@fonderie/customers/migrations`

```ts
type CustomersEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

type ICustomersConfig = {
    referenceCodePrefix?: string;
};

const EVENT_KEYS: { readonly customerCreated: "fonderie.customer.created"; readonly customerUpdated: "fonderie.customer.updated"; readonly customerDeleted: "fonderie.customer.deleted"; readonly customerBlacklisted: "fonderie.customer.blacklisted"; readonly customerUnblacklisted: "fonderie.customer.unblacklisted"; }

interface IAddressDTO {
    countryIso: string;
    subdivision1Iso: string;
    subdivision2Iso: string;
    zipPostalCode: string;
    unit: string;
    line1: string;
    line2: string;
}

interface ICustomerAddressDTO {
    id: string;
    label: string;
    isPrimary: boolean;
    address: IAddressDTO;
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

interface ICustomerNoteDTO {
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}

interface ICustomerPhoneDTO {
    id: string;
    phone: string;
    label: string;
    isPrimary: boolean;
    createdAt: string;
}

interface ICustomerTagDTO {
    tag: string;
}

function toAddressDTO(a: IAddress): IAddressDTO

function toCustomerAddressDTO(ca: ICustomerAddress): ICustomerAddressDTO

function toCustomerDetailDTO(c: ICustomerDetail): ICustomerDetailDTO

function toCustomerDTO(c: ICustomer): ICustomerDTO

function toCustomerEmailDTO(e: ICustomerEmail): ICustomerEmailDTO

function toCustomerNoteDTO(n: ICustomerNote): ICustomerNoteDTO

function toCustomerPhoneDTO(p: ICustomerPhone): ICustomerPhoneDTO

function toCustomerTagDTO(t: ICustomerTag): ICustomerTagDTO

new CustomerAddressModel(store: IStoreAdapter): CustomerAddressModel
  .list(customerId: string): Promise<ICustomerAddress[]>
  .add(opts: { customerId: string; countryIso: string; subdivision1Iso?: string | null; subdivision2Iso?: string | null; zipPostalCode: string; unit?: string | null; line1?: string | null; line2?: string | null; labelId: string; isPrimary?: boolean; }): Promise<...>
  .updateLabel(addrId: string, customerId: string, labelId: string): Promise<ICustomerAddress>
  .setPrimary(addrId: string, customerId: string): Promise<void>
  .remove(addrId: string, customerId: string): Promise<void>

new CustomerEmailModel(store: IStoreAdapter): CustomerEmailModel
  .list(customerId: string): Promise<ICustomerEmail[]>
  .add(opts: { customerId: string; email: string; labelId: string; isPrimary?: boolean; }): Promise<ICustomerEmail>
  .updateLabel(emailId: string, customerId: string, labelId: string): Promise<ICustomerEmail>
  .setPrimary(emailId: string, customerId: string): Promise<void>
  .remove(emailId: string, customerId: string): Promise<void>

new CustomerModel(store: IStoreAdapter): CustomerModel
  .list(opts: ListCustomersOpts): Promise<ICustomer[]>
  .findById(id: string, workspaceId: string): Promise<ICustomer | null>
  .findDetail(id: string, workspaceId: string, depth: 2): Promise<ICustomerDetailD2 | null>
  .create(opts: CreateCustomerOpts): Promise<ICustomer>
  .update(id: string, workspaceId: string, opts: UpdateCustomerOpts, referenceCodePrefix?: string): Promise<ICustomer | null>
  .delete(id: string, workspaceId: string): Promise<void>
  .blacklist(id: string, workspaceId: string, reason?: string | null | undefined): Promise<void>
  .unblacklist(id: string, workspaceId: string): Promise<void>

new CustomerNoteModel(store: IStoreAdapter): CustomerNoteModel
  .list(customerId: string): Promise<ICustomerNote[]>
  .create(opts: { customerId: string; authorId?: string | null; body: string; }): Promise<ICustomerNote>
  .update(noteId: string, customerId: string, body: string): Promise<ICustomerNote | null>
  .delete(noteId: string, customerId: string): Promise<void>

new CustomerPhoneModel(store: IStoreAdapter): CustomerPhoneModel
  .list(customerId: string): Promise<ICustomerPhone[]>
  .add(opts: { customerId: string; phone: string; labelId: string; isPrimary?: boolean; }): Promise<ICustomerPhone>
  .updateLabel(phoneId: string, customerId: string, labelId: string): Promise<ICustomerPhone>
  .setPrimary(phoneId: string, customerId: string): Promise<void>
  .remove(phoneId: string, customerId: string): Promise<void>

new CustomerTagModel(store: IStoreAdapter): CustomerTagModel
  .list(customerId: string): Promise<string[]>
  .add(customerId: string, tag: string): Promise<void>
  .remove(customerId: string, tag: string): Promise<void>

new CustomersModule(store: IStoreAdapter, config?: ICustomersConfig, bus?: EventBus | undefined): CustomersModule
  .name: "@fonderie/customers"
  .deps: string[]
  .install(app: IFonderieApp): void

type AddressLabel = 'service' | 'billing' | 'other';

type CustomerType = 'individual' | 'business';

type EmailLabel = 'work' | 'personal' | 'billing';

interface IAddress {
    id: string;
    countryIso: string;
    subdivision1Iso: string | null;
    subdivision2Iso: string | null;
    zipPostalCode: string;
    unit: string | null;
    line1: string | null;
    line2: string | null;
}

interface ICustomer {
    id: string;
    workspaceId: string;
    type: CustomerType;
    sex: CustomerSex;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    avatarUrl: string | null;
    locale: string;
    referenceCode: string | null;
    isBlacklisted: boolean;
    blacklistReason: string | null;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ICustomerAddress {
    addrId: string;
    customerId: string;
    labelId: string;
    label: string;
    isPrimary: boolean;
    address: IAddress;
}

interface ICustomerDetail extends ICustomer {
    emails: ICustomerEmail[];
    phones: ICustomerPhone[];
    addresses: ICustomerAddress[];
    notes: ICustomerNote[];
    relationships: ICustomerRelationshipExpanded[];
    tags: string[];
}

interface ICustomerEmail {
    id: string;
    customerId: string;
    email: string;
    labelId: string;
    label: string;
    isPrimary: boolean;
    createdAt: string;
}

interface ICustomerNote {
    id: string;
    customerId: string;
    authorId: string | null;
    body: string;
    createdAt: string;
    updatedAt: string;
}

interface ICustomerPhone {
    id: string;
    customerId: string;
    phone: string;
    labelId: string;
    label: string;
    isPrimary: boolean;
    createdAt: string;
}

interface ICustomerTag {
    customerId: string;
    tag: string;
}

type PhoneLabel = 'mobile' | 'office' | 'home' | 'fax';

namespace schemas — exports: addAddressSchema, addEmailSchema, addPhoneSchema, addRelationshipSchema, addTagSchema, blacklistSchema, createCustomerSchema, noteSchema, updateAddressSchema, updateCustomerSchema, updateEmailSchema, updatePhoneSchema
```

## @fonderie/audit

```ts
new AuditModule(store: IStoreAdapter): AuditModule
  .name: "@fonderie/audit"
  .deps: string[]
  .install(app: IFonderieApp): void

interface IAuditEvent {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    meta: Record<string, unknown>;
    createdAt: Date;
}

interface IAuditQuery {
    workspaceId: string;
    type?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string;
}

interface IAuditEventDTO {
    id: string;
    type: string;
    actorId: string | null;
    requestId: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
}

interface IAuditPageDTO {
    events: IAuditEventDTO[];
    nextCursor: string | null;
}
```

## @fonderie/webhooks

Subpath exports: `@fonderie/webhooks/migrations`

```ts
new WebhooksModule(store: IStoreAdapter, config?: IWebhooksConfig, bus?: EventBus | undefined): WebhooksModule
  .name: "@fonderie/webhooks"
  .deps: string[]
  .install(app: IFonderieApp): void

interface IWebhooksConfig {
    maxAttempts?: number;
    retryDelays?: number[];
    retryInterval?: number;
}

interface IWebhookEndpoint {
    id: string;
    workspaceId: string;
    url: string;
    secret: string;
    events: string[];
    enabled: boolean;
    createdAt: Date;
}

interface IWebhookDelivery {
    id: string;
    endpointId: string;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    status: DeliveryStatus;
    attempts: number;
    responseStatus: number | null;
    responseBody: string | null;
    nextAttemptAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
}

type DeliveryStatus = 'pending' | 'delivered' | 'failed';

interface IWebhookEndpointDTO {
    id: string;
    url: string;
    events: string[];
    enabled: boolean;
    createdAt: string;
}

interface IWebhookEndpointCreatedDTO extends IWebhookEndpointDTO {
    secret: string;
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

namespace schemas — exports: createEndpointSchema, updateEndpointSchema
```

## @fonderie/logger

```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface ILogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    requestId?: string;
    userId?: string;
    workspaceId?: string;
    duration?: number;
    error?: {
        message: string;
        stack?: string;
        code?: string;
    };
    [key: string]: unknown;
}

interface ILogTransport {
    write(entry: ILogEntry): void | Promise<void>;
}

interface ILoggerConfig {
    level?: LogLevel;
    transports?: ILogTransport[];
    pretty?: boolean;
}

new Logger(config: ILoggerConfig, context?: Record<string, unknown>): Logger
  .child(context: Record<string, unknown>): Logger
  .debug(message: string, context?: Record<string, unknown> | undefined): void
  .info(message: string, context?: Record<string, unknown> | undefined): void
  .warn(message: string, context?: Record<string, unknown> | undefined): void
  .error(message: string, error?: unknown, context?: Record<string, unknown> | undefined): void
  .fatal(message: string, error?: unknown, context?: Record<string, unknown> | undefined): void

new LoggerModule(config?: ILoggerConfig): LoggerModule
  .name: "@fonderie/logger"
  .logger: Logger
  .install(app: IFonderieApp): void

new FileTransport(path: string): FileTransport
  .write(entry: ILogEntry): void

new ConsoleTransport(opts?: { pretty?: boolean; }): ConsoleTransport
  .write(entry: ILogEntry): void
```

## @fonderie/client

```ts
new FonderieClient(opts: IFonderieClientOptions): FonderieClient
  .auth: AuthClient

interface IFonderieClientOptions {
    baseUrl: string;
    accessToken?: string;
}

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

new AuthClient(http: HttpClient, accessToken?: string | undefined): AuthClient
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

interface IRegisterInput {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
}

interface ILoginInput {
    email: string;
    password: string;
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

interface IApiResponse<T = undefined> {
    reason: string;
    explanation: string;
    result: T;
}

interface IApiError {
    reason: string;
    explanation: string;
    details?: unknown;
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

interface ITokens {
    access: string;
    refresh: string;
}

interface IRegisterResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface ILoginResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface IRefreshResult {
    tokens: ITokens;
}

interface IVerifyEmailResult {
    verified: boolean;
    email: string;
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

interface IMeResult {
    user: IUserDTO;
}

interface IMfaSetupResult {
    secret: string;
    uri: string;
}

interface IMfaEnabledResult {
    tokens: ITokens;
    user: IUserDTO;
}
```

## @fonderie/adapter-express

```ts
function expressRequestToWeb(req: ExpressRequest): Promise<Request>

function webResponseToExpress(webRes: Response, res: ExpressResponse): Promise<void>

function bridge(fonderie: FonderieApp): (req: ExpressRequest, _res: ExpressResponse, next: ExpressNext) => Promise<void>

function adapt(middleware: Middleware): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>

function withWorkspace(store: IStoreAdapter): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>

function requirePermission(operation: Operation, permissionKey: string): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>

function requireFeature(key: string): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>

function mount<T extends ExpressApp>(app: T, fonderie: FonderieApp, register?: ((app: T) => void) | undefined): T

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

type ExpressRequest = IncomingMessage & {
    body?: unknown;
    _fonderie?: IFonderieContext;
};

type ExpressResponse = ServerResponse;

type ExpressNext = (err?: unknown) => void;

function requireAuth(req: ExpressRequest, res: ExpressResponse, next: ExpressNext): Promise<void>
```

## @fonderie/adapter-hono

```ts
function bridge(fonderie: FonderieApp): MiddlewareHandler

function adapt(middleware: Middleware): MiddlewareHandler

function withWorkspace(store: IStoreAdapter): MiddlewareHandler

function requirePermission(operation: Operation, permissionKey: string): MiddlewareHandler

function requireFeature(key: string): MiddlewareHandler

function mount(hono: Hono<BlankEnv, BlankSchema, "/">, fonderie: FonderieApp): Hono<BlankEnv, BlankSchema, "/">

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

type FonderieVariables = {
    _fonderie: IFonderieContext;
};

function requireAuth(c: Context<any, string, {}>, next: Next): Promise<void | Response>
```

## @fonderie/adapter-koa

```ts
function koaContextToWeb(ctx: KoaContext): Request

function webResponseToKoa(webRes: Response, ctx: KoaContext): Promise<void>

function bridge(fonderie: FonderieApp): KoaMiddleware<any, any>

function adapt(middleware: Middleware): KoaMiddleware<any, any>

function withWorkspace(store: IStoreAdapter): KoaMiddleware<any, any>

function requirePermission(operation: Operation, permissionKey: string): KoaMiddleware<any, any>

function requireFeature(key: string): KoaMiddleware<any, any>

function mount(app: Application<DefaultState, DefaultContext>, fonderie: FonderieApp): Application<DefaultState, DefaultContext>

const OPERATIONS: { readonly CREATE: "create"; readonly READ: "read"; readonly UPDATE: "update"; readonly DELETE: "delete"; }

interface KoaContext {
    request: {
        url: string;
        method: string;
        rawBody?: string;
        headers: Record<string, string | string[] | undefined>;
    };
    response: {
        body: unknown;
        status: number;
        set(key: string, value: string): void;
    };
    req: IncomingMessage;
    state: Record<string, unknown>;
}

type KoaNext = () => Promise<void>;

function requireAuth(context: any, next: Next): any
```
