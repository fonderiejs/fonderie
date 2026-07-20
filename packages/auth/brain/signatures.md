<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/auth — signatures

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
    accessTokenDuration?: string;
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

function buildAuthIpLimiter(route: AuthLimitedRoute, store: IStoreAdapter, config: false | IAuthRateLimitConfig | undefined): Middleware | null

function buildAuthAccountLimiter(route: AuthLimitedRoute, store: IStoreAdapter, config: false | IAuthRateLimitConfig | undefined): Middleware | null

interface IAuthRateLimitConfig {
    store?: IRateLimitStore;
    rules?: Partial<Record<AuthLimitedRoute, IRateLimitRule | false>>;
}

type AuthLimitedRoute = 'login' | 'register' | 'forgot' | 'mfaVerify';
```
