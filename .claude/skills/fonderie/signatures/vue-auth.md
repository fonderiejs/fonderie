<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-auth — signatures

## @fonderie/vue-auth

```ts
new AuthClient(http: HttpClient, tokens: TokenStore): AuthClient
  .mfa: MfaClient
  .setAccessToken(token: string | undefined): void
  .register(input: IRegisterInput): Promise<IApiResponse<IRegisterResult>>
  .login(input: ILoginInput): Promise<IApiResponse<ILoginResult | IMfaRequiredResult>>
  .appleNative(input: IAppleNativeInput): Promise<IApiResponse<ILoginResult>>
  .refreshTokens(refreshToken?: string | undefined): Promise<IApiResponse<IRefreshResult>>
  .forgotPassword(email: string): Promise<IApiResponse<undefined>>
  .resetPassword(input: IResetPasswordInput): Promise<IApiResponse<undefined>>
  .verifyEmail(token: string): Promise<IApiResponse<IVerifyEmailResult>>
  .logout(refreshToken?: string | undefined): Promise<IApiResponse<undefined>>
  .sendVerificationEmail(): Promise<IApiResponse<IResendVerificationResult>>
  .getUser(opts?: IReadOptions | undefined): Promise<IApiResponse<IMeResult>>
  .updateProfile(input: IUpdateProfileInput): Promise<IApiResponse<IMeResult>>
  .updatePreferences(input: IUpdatePreferencesInput): Promise<IApiResponse<IMeResult>>
  .updateEmail(email: string): Promise<IApiResponse<unknown>>
  .updatePhone(phone: string): Promise<IApiResponse<unknown>>
  .changePassword(input: IChangePasswordInput): Promise<IApiResponse<undefined>>
  .exportData(): Promise<IApiResponse<unknown>>
  .deleteUser(): Promise<IApiResponse<undefined>>
  .getLoginHistory(input?: IGetLoginHistoryInput | undefined, opts?: IReadOptions | undefined): Promise<IApiResponse<ILoginHistoryPageResult>>
  .listSessions(opts?: IReadOptions | undefined): Promise<IApiResponse<ISessionsResult>>
  .terminateSession(id: string): Promise<IApiResponse<{ id: string; }>>
  .terminateOtherSessions(): Promise<IApiResponse<{ count: number; }>>

interface IChangePasswordInput {
    currentPassword: string;
    newPassword: string;
}

interface IGetLoginHistoryInput {
    outcome?: 'success' | 'failed';
    from?: Date;
    to?: Date;
    limit?: number;
    cursor?: string;
}

interface ILoginEventDTO {
    id: string;
    method: string;
    outcome: string;
    failureReason: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
}

interface ILoginInput {
    email: string;
    password: string;
}

interface ILoginResult {
    tokens: ITokens;
    user: IUserDTO;
    requiresVerification?: boolean;
}

interface IMfaEnabledResult {
    mfaEnabled: boolean;
}

interface IMfaRequiredResult {
    mfaToken: string;
}

interface IMfaSetupResult {
    qr: string;
    backupCodes: string[];
}

interface IRegisterInput {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
}

interface IRegisterResult {
    tokens: ITokens;
    user: IUserDTO;
    requiresVerification?: boolean;
}

interface IResetPasswordInput {
    pin: string;
    password: string;
}

interface ISessionDTO {
    id: string;
    current: boolean;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    expiresAt: string;
}

interface ITokens {
    access: string;
    refresh: string;
}

interface IUpdatePreferencesInput {
    locale?: string;
    timezone?: string;
    notifications?: {
        email?: boolean;
        inApp?: boolean;
        sms?: boolean;
        push?: boolean;
    };
    emailDigest?: string;
    dateFormat?: string;
    timeFormat?: string;
}

interface IUpdateProfileInput {
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
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

interface IVerifyEmailResult {
    verified: boolean;
    email: string;
}

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

function isMfaRequired(result: ILoginResult | IMfaRequiredResult): result is IMfaRequiredResult

interface IUseAccountDataReturn {
    exportData: () => Promise<unknown>;
    deleteUser: () => Promise<void>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseChangePasswordReturn {
    changePassword: (input: IChangePasswordInput) => Promise<void>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    done: Ref<boolean>;
}

interface IUseForgotPasswordReturn {
    forgotPassword: (email: string) => Promise<void>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    sent: Ref<boolean>;
}

interface IUseLoginHistoryReturn {
    events: Ref<ILoginEventDTO[]>;
    isLoading: Ref<boolean>;
    isLoadingMore: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    hasMore: Ref<boolean>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    loadMore: () => Promise<void>;
}

interface IUseLoginReturn {
    login: (input: ILoginInput) => Promise<ILoginResult | IMfaRequiredResult>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    data: Ref<ILoginResult | null>;
    mfaPending: Ref<IMfaRequiredResult | null>;
}

interface IUseLogoutReturn {
    logout: (refreshToken?: string) => Promise<void>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseMfaLoginReturn {
    verifyLogin: (mfaToken: string, code: string) => Promise<ILoginResult>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    data: Ref<ILoginResult | null>;
}

interface IUseMfaSetupReturn {
    setup: () => Promise<IMfaSetupResult>;
    setupData: Ref<IMfaSetupResult | null>;
    verify: (code: string) => Promise<IMfaEnabledResult>;
    disable: (code: string) => Promise<void>;
    regenerateBackupCodes: (code: string) => Promise<string[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseProfileReturn {
    user: Ref<IUserDTO | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    updateProfile: (input: IUpdateProfileInput) => Promise<IUserDTO>;
    updatePreferences: (input: IUpdatePreferencesInput) => Promise<IUserDTO>;
    updateEmail: (email: string) => Promise<void>;
    updatePhone: (phone: string) => Promise<void>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
}

interface IUseRegisterReturn {
    register: (input: IRegisterInput) => Promise<IRegisterResult>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    data: Ref<IRegisterResult | null>;
}

interface IUseResetPasswordReturn {
    resetPassword: (input: IResetPasswordInput) => Promise<void>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    done: Ref<boolean>;
}

interface IUseSessionReturn {
    user: Ref<IUserDTO | null>;
    isLoading: Ref<boolean>;
    isAuthenticated: Ref<boolean>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    logout: (refreshToken?: string) => Promise<void>;
}

interface IUseSessionsReturn {
    sessions: Ref<ISessionDTO[]>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    terminate: (id: string) => Promise<void>;
    terminateOthers: () => Promise<void>;
}

interface IUseVerifyEmailReturn {
    verifyEmail: (pin: string) => Promise<IVerifyEmailResult>;
    resend: () => Promise<void>;
    resent: Ref<boolean>;
    isLoading: Ref<boolean>;
    error: Ref<FonderieApiError | null>;
    data: Ref<IVerifyEmailResult | null>;
}

function useAccountData(client?: AuthClient | undefined): IUseAccountDataReturn

function useChangePassword(client?: AuthClient | undefined): IUseChangePasswordReturn

function useForgotPassword(client?: AuthClient | undefined): IUseForgotPasswordReturn

function useLogin(client?: AuthClient | undefined): IUseLoginReturn

function useLoginHistory(rawFilters?: IGetLoginHistoryInput | undefined): IUseLoginHistoryReturn

function useLogout(client?: AuthClient | undefined): IUseLogoutReturn

function useMfaLogin(client?: AuthClient | undefined): IUseMfaLoginReturn

function useMfaSetup(client?: AuthClient | undefined): IUseMfaSetupReturn

function useProfile(client?: AuthClient | undefined): IUseProfileReturn

function useRegister(client?: AuthClient | undefined): IUseRegisterReturn

function useResetPassword(client?: AuthClient | undefined): IUseResetPasswordReturn

function useSession(client?: AuthClient | undefined): IUseSessionReturn

function useSessions(client?: AuthClient | undefined): IUseSessionsReturn

function useVerifyEmail(client?: AuthClient | undefined): IUseVerifyEmailReturn

function clearToken(): void

function persistToken(token: string): void

function readToken(): string | null

const TOKEN_KEY: "fonderie_access_token"
```
