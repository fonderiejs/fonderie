<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/auth — signatures

## @fonderie/auth

Subpath exports: `@fonderie/auth/types`, `@fonderie/auth/middleware`, `@fonderie/auth/migrations`, `@fonderie/auth/env.json`

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
    provider: string | null;
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
  .version: string
  .describeAdmin(): IAdminDescription
  .describeEvents(): IEventCatalogEntry<unknown>[]
  .checkReadiness(): IReadinessProblem[]
  .install(app: IFonderieApp): void

interface IAccountEraser {
    name: string;
    erase: (subject: IErasureSubject) => Promise<{
        erased: number;
        kept?: string;
    }>;
}

interface IErasureSubject {
    userId: string;
    email: string | null;
    phone: string | null;
}

interface IAuthConfig extends IAuthSecrets, IAuthRuntimeConfig {
    location?: LocationResolver;
    secureCookies?: boolean;
    rateLimit?: IAuthRateLimitConfig | false;
    accessTokenDuration?: string;
    providers: ('email' | 'phone' | 'google' | 'github' | 'apple')[];
    appName?: string;
    passwordResetUrl?: string;
    resolve?: (ctx: {
        meta: Record<string, unknown>;
    }) => Partial<IAuthRuntimeConfig>;
    routes?: Partial<Record<AuthRouteId, AuthRouteOverride>>;
    legacyVerify?: (plain: string, hash: string) => boolean | Promise<boolean>;
    dataExportContributors?: IDataExportContributor[];
    accountDeletion?: IAccountDeletionConfig;
}

interface IAuthSecrets {
    jwtSecret: string;
    jwtPreviousSecrets?: string[];
    mfaSecretKey?: string;
    google?: {
        clientId: string;
        clientSecret?: string;
        redirectUri?: string;
        nativeClientIds?: string[];
    };
    apple?: {
        clientId: string;
        teamId: string;
        keyId: string;
        privateKey: string;
        redirectUri: string;
        nativeClientIds?: string[];
    };
}

interface IAuthRuntimeConfig {
    sessionDuration?: string;
    sessionMaxAge?: string;
    sessionPolicies?: Partial<Record<ClientKind, ISessionPolicy>>;
    verificationCooldown?: number;
    mfa?: boolean;
    requireVerification?: boolean;
}

interface IDataExportContributor {
    name: string;
    collect: (userId: string) => Promise<unknown> | unknown;
}

const AUTH_CONFIG_KEYS: Record<Exclude<keyof IAuthRuntimeConfig, 'sessionPolicies'>, string>

const MESSAGE_KEYS: { readonly emailRegistration: "email-registration"; readonly emailVerification: "email-verification"; readonly passwordReset: "password-reset"; readonly phoneOtp: "phone-otp"; readonly mfaEnabled: "mfa-enabled"; readonly mfaDisabled: "mfa-disabled"; readonly mfaBackupCodesRegenerated: "mfa-backup-codes-regenerated"; readonly emailChanged: "email-changed"; readonly phoneChanged: "phone-changed"; readonly passwordRevoked: "password-revoked"; readonly oauthRegistration: "oauth-registration"; readonly oauthLinked: "oauth-linked"; readonly oauthUnlinked: "oauth-unlinked"; readonly accountDeletionCode: "account-deletion-code"; readonly accountDeletionScheduled: "account-deletion-scheduled"; readonly accountRestored: "account-restored"; readonly accountDeletionReminder: "account-deletion-reminder"; }

type AuthMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

const DEFAULT_TEMPLATES: { "email-registration": IDefaultTemplate; "email-verification": IDefaultTemplate; "password-reset": IDefaultTemplate; "phone-otp": IDefaultTemplate; "mfa-enabled": IDefaultTemplate; "mfa-disabled": IDefaultTemplate; "mfa-backup-codes-regenerated": IDefaultTemplate; "email-changed": IDefaultTemplate; "phone-changed": IDefaultTemplate; "password-revoked": IDefaultTemplate; "oauth-registration": IDefaultTemplate; "oauth-linked": IDefaultTemplate; "oauth-unlinked": IDefaultTemplate; "account-deletion-code": IDefaultTemplate; "account-deletion-scheduled": IDefaultTemplate; "account-restored": IDefaultTemplate; "account-deletion-reminder": IDefaultTemplate; }

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
    provider: string;
    hasPassword: boolean;
    suspended: boolean;
    whitelist: boolean;
    ipWhitelist: string[];
    createdAt: string;
    updatedAt: string;
}

function toUserDTO(user: IUser, phoneVerified?: boolean): IUserDTO

interface ILoginEventDTO {
    id: string;
    method: string;
    outcome: string;
    failureReason: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    location: IRequestLocation | null;
    createdAt: string;
}

interface ILoginHistoryPageDTO {
    events: ILoginEventDTO[];
    nextCursor: string | null;
}

interface ISessionDTO {
    id: string;
    current: boolean;
    ipAddress: string | null;
    userAgent: string | null;
    location: IRequestLocation | null;
    createdAt: string;
    expiresAt: string;
    clientKind: string | null;
}

function sanitizeLocation(input: unknown): IRequestLocation | null

function resolveLocation(resolver: LocationResolver | undefined, req: ILocationRequest, timeoutMs?: number): Promise<IRequestLocation | null>

interface IRequestLocation {
    country?: string | null;
    countryName?: string | null;
    subdivision?: string | null;
    subdivisionName?: string | null;
    city?: string | null;
    postalCode?: string | null;
    continent?: string | null;
    timeZone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    accuracyRadius?: number | null;
    geonameId?: number | null;
    isp?: string | null;
    org?: string | null;
    asn?: string | null;
    mobile?: boolean | null;
    proxy?: boolean | null;
    hosting?: boolean | null;
}

interface ILocationRequest {
    ip: string | null;
    headers: Headers;
}

type LocationResolver = (req: ILocationRequest) => IRequestLocation | null | undefined | Promise<IRequestLocation | null | undefined>;

function validate(schema: IRequestSchema): Middleware

namespace schemas — exports: ChangePasswordInput, LoginInput, RegisterInput, ResetPasswordInput, appleNativeSchema, changePasswordSchema, confirmDeletionSchema, deletionHoldSchema, forgotPasswordSchema, googleNativeSchema, loginSchema, mfaTokenSchema, refreshSchema, registerSchema, requestDeletionSchema, resetPasswordSchema, restoreAccountSchema, updateEmailSchema, updatePhoneSchema, updatePreferencesSchema, updateProfileSchema, verifySchema

type RegisterInput = z.infer<typeof registerSchema>;

type LoginInput = z.infer<typeof loginSchema>;

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

function withSession(store: IStoreAdapter, config: IAuthConfig): Middleware

function requireAuth(ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>

function normalizeEmail(email: string): string

function normalizeEmailSafe(email: string): string | null

function importUser(store: IStoreAdapter, user: IImportUser): Promise<{ id: string; }>

function purgeSoftDeletedUsers(store: IStoreAdapter, { olderThanDays, bus }: IPurgeOptions): Promise<number>

function startUserRetention(store: IStoreAdapter, options: IUserRetentionScheduleOptions): { stop: () => void; }

interface IPurgeOptions {
    olderThanDays: number;
    bus?: {
        emit(type: string, payload: unknown): Promise<void>;
    } | undefined;
}

interface IUserRetentionScheduleOptions extends IPurgeOptions {
    intervalMs?: number;
    onPurge?: (deleted: number) => void;
}

function runAccountDeletionSchedule(store: IStoreAdapter, config: ScheduleConfig, bus?: Bus | undefined, options?: { batchSize?: number; }): Promise<IDeletionScheduleResult>

function startAccountDeletionSchedule(store: IStoreAdapter, config: ScheduleConfig, options?: { bus?: Bus; intervalMs?: number; onRun?: (r: IDeletionScheduleResult) => void; }): { ...; }

function authEraser(store: IStoreAdapter): IAccountEraser

function erasureHash(secret: string, value: string | null): string | null

function eraseAccountNow(store: IStoreAdapter, config: ScheduleConfig, userId: string, bus?: Bus | undefined): Promise<EraseNowResult>

interface IDeletionScheduleResult {
    reminded: number;
    purged: number;
    failed: Array<{
        userId: string;
        eraser: string;
        error: string;
    }>;
}

type EraseNowResult = {
    status: 'erased';
    outcomes: ErasureOutcomes;
} | {
    status: 'not-pending';
} | {
    status: 'held';
} | {
    status: 'busy';
} | {
    status: 'no-erasers';
} | {
    status: 'failed';
    eraser: string;
    error: string;
};

type ErasureOutcomes = Array<{
    brick: string;
    erased: number;
    kept?: string;
}>;

interface IImportUser {
    id?: string;
    email: string;
    passwordHash?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    profileImageUrl?: string | null;
    locale?: string;
    timezone?: string;
    emailVerifiedAt?: Date | null;
    mfaEnabled?: boolean;
    createdAt?: Date;
}

function validateAuthConfig(config: IAuthConfig): void

function buildAuthIpLimiter(route: AuthLimitedRoute, store: IStoreAdapter, config: false | IAuthRateLimitConfig | undefined): Middleware | null

function buildAuthAccountLimiter(route: AuthLimitedRoute, store: IStoreAdapter, config: false | IAuthRateLimitConfig | undefined): Middleware | null

interface IAuthRateLimitConfig {
    store?: IRateLimitStore;
    rules?: Partial<Record<AuthLimitedRoute, IRateLimitRule | false>>;
}

type AuthLimitedRoute = 'login' | 'register' | 'forgot' | 'reset' | 'verify' | 'mfaVerify';

interface IAdminUserDTO extends IUserDTO {
    suspended: boolean;
    deletedAt: string | null;
    createdAt: string;
    deletion?: IAdminDeletionDTO | null;
}

function describeAuthAdminRoutes(store: IStoreAdapter, bus?: EventBus | undefined, config?: DeletionConfig | undefined): IAdminRoute[]

function toAdminUserDTO(user: IUser, deletion?: { facts: IDeletionFacts | undefined; config: Pick<IAuthConfig, "accountDeletion">; } | undefined): IAdminUserDTO

function toAdminUserPageDTO(page: IUserPage): IAdminUserPageDTO

const CLIENT_KINDS: readonly ["mobile", "desktop", "web"]

const SESSION_POLICY_PRESETS: Readonly<Record<ClientKind, ISessionPolicy>>

function clientKindOf(headers: Headers): "mobile" | "desktop" | "web" | null

function configForClient(config: IAuthConfig, runtime: Partial<IAuthRuntimeConfig> | undefined, kind: "mobile" | "desktop" | "web" | null): IAuthConfig

function readAuthRuntimeConfig(read: (key: string) => unknown): Partial<IAuthRuntimeConfig>

function sessionPolicyConfigKeys(kind: "mobile" | "desktop" | "web"): Record<keyof ISessionPolicy, string>

type ClientKind = (typeof CLIENT_KINDS)[number];

interface ISessionPolicy {
    sessionDuration?: string;
    sessionMaxAge?: string;
    accessTokenDuration?: string;
}
```
