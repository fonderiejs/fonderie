<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-native-auth — signatures

## @fonderie/react-native-auth

```ts
new AuthClient(http: HttpClient, tokens: TokenStore): AuthClient
  .mfa: MfaClient
  .hasAccessToken(): boolean
  .setAccessToken(token: string | undefined): void
  .providers(): Promise<IApiResponse<IAuthProvidersResult>>
  .unlinkOauth(provider: string): Promise<IApiResponse<null>>
  .register(input: IRegisterInput): Promise<IApiResponse<IRegisterResult>>
  .login(input: ILoginInput): Promise<IApiResponse<ILoginResult | IMfaRequiredResult>>
  .appleNative(input: IAppleNativeInput): Promise<IApiResponse<ILoginResult | IMfaRequiredResult>>
  .googleNative(input: IGoogleNativeInput): Promise<IApiResponse<ILoginResult | IMfaRequiredResult>>
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
  .stepUpMethods(): Promise<IApiResponse<IStepUpMethodsResult>>
  .requestStepUpCode(channel: "email" | "sms"): Promise<IApiResponse<{ channel: "email" | "sms"; expiresInSeconds: number; }>>
  .stepUp(proof: IStepUpProof): Promise<IApiResponse<IStepUpResult>>
  .requestAccountDeletion(input: IRequestAccountDeletionInput): Promise<IApiResponse<IRequestAccountDeletionResult>>
  .confirmAccountDeletion(input: IConfirmAccountDeletionInput): Promise<IApiResponse<IAccountDeletionResult>>
  .restoreAccount(input: IRestoreAccountInput): Promise<IApiResponse<ILoginResult>>
  .getLoginHistory(input?: IGetLoginHistoryInput | undefined, opts?: IReadOptions | undefined): Promise<IApiResponse<ILoginHistoryPageResult>>
  .listSessions(opts?: IReadOptions | undefined): Promise<IApiResponse<ISessionsResult>>
  .terminateSession(id: string): Promise<IApiResponse<{ id: string; }>>
  .terminateOtherSessions(): Promise<IApiResponse<{ count: number; }>>

interface IAppleNativeInput {
    identityToken: string;
    nonce?: string;
}

interface IGoogleNativeInput {
    idToken: string;
    nonce?: string;
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

interface IMfaRequiredResult {
    mfaToken: string;
}

interface IRegisterInput {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    locale?: string;
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

interface ITokens {
    access: string;
    refresh: string;
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
    provider: string;
    hasPassword: boolean;
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

interface IChangePasswordInput {
    currentPassword: string;
    newPassword: string;
}

interface IMfaEnabledResult {
    mfaEnabled: boolean;
}

interface IMfaSetupResult {
    qr: string;
    backupCodes: string[];
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
    location: IRequestLocationDTO | null;
    createdAt: string;
}

interface IRequestLocationDTO {
    country?: string;
    countryName?: string;
    subdivision?: string;
    subdivisionName?: string;
    city?: string;
    postalCode?: string;
    continent?: string;
    timeZone?: string;
    latitude?: number;
    longitude?: number;
    accuracyRadius?: number;
    geonameId?: number;
    isp?: string;
    org?: string;
    asn?: string;
    mobile?: boolean;
    proxy?: boolean;
    hosting?: boolean;
}

interface ISessionDTO {
    id: string;
    current: boolean;
    ipAddress: string | null;
    userAgent: string | null;
    location: IRequestLocationDTO | null;
    createdAt: string;
    expiresAt: string;
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

function isSessionRefusal(err: unknown): err is FonderieApiError

interface IUseForgotPasswordReturn {
    forgotPassword: (email: string) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
    sent: boolean;
}

interface IUseLoginReturn {
    login: (input: ILoginInput) => Promise<ILoginResult | IMfaRequiredResult>;
    isLoading: boolean;
    error: FonderieApiError | null;
    data: ILoginResult | null;
    mfaPending: IMfaRequiredResult | null;
}

interface IUseAppleSignInReturn {
    signIn: (input: IAppleNativeInput) => Promise<ILoginResult | IMfaRequiredResult>;
    isLoading: boolean;
    error: FonderieApiError | null;
    data: ILoginResult | null;
}

interface IUseGoogleSignInReturn {
    signIn: (input: IGoogleNativeInput) => Promise<ILoginResult | IMfaRequiredResult>;
    isLoading: boolean;
    error: FonderieApiError | null;
    data: ILoginResult | null;
}

interface IUseLogoutReturn {
    logout: (refreshToken?: string) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseAccountDataReturn {
    exportData: () => Promise<unknown>;
    deleteUser: () => Promise<void>;
    requestDeletion: (input: IRequestAccountDeletionInput) => Promise<IRequestAccountDeletionResult>;
    confirmDeletion: (input: IConfirmAccountDeletionInput) => Promise<IAccountDeletionResult>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseRestoreAccountReturn {
    restore: (input: IRestoreAccountInput) => Promise<ILoginResult>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseChangePasswordReturn {
    changePassword: (input: IChangePasswordInput) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
    done: boolean;
}

interface IUseMfaLoginReturn {
    verifyLogin: (mfaToken: string, code: string) => Promise<ILoginResult>;
    isLoading: boolean;
    error: FonderieApiError | null;
    data: ILoginResult | null;
}

interface IUseMfaSetupReturn {
    setup: () => Promise<IMfaSetupResult>;
    setupData: IMfaSetupResult | null;
    verify: (code: string) => Promise<IMfaEnabledResult>;
    disable: (code: string) => Promise<void>;
    regenerateBackupCodes: (code: string) => Promise<string[]>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseProfileReturn {
    user: IUserDTO | null;
    refresh: () => Promise<void>;
    updateProfile: (input: IUpdateProfileInput) => Promise<IUserDTO>;
    updatePreferences: (input: IUpdatePreferencesInput) => Promise<IUserDTO>;
    updateEmail: (email: string) => Promise<void>;
    updatePhone: (phone: string) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseRegisterReturn {
    register: (input: IRegisterInput) => Promise<IRegisterResult>;
    isLoading: boolean;
    error: FonderieApiError | null;
    data: IRegisterResult | null;
}

interface IUseResetPasswordReturn {
    resetPassword: (input: IResetPasswordInput) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
    done: boolean;
}

interface IUseSessionReturn {
    user: IUserDTO | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    refresh: () => Promise<void>;
    logout: (refreshToken?: string) => Promise<void>;
}

interface IUseVerifyEmailReturn {
    verifyEmail: (pin: string) => Promise<IVerifyEmailResult>;
    resend: () => Promise<void>;
    resent: boolean;
    isLoading: boolean;
    error: FonderieApiError | null;
    data: IVerifyEmailResult | null;
}

interface IUseLoginHistoryReturn {
    events: ILoginEventDTO[];
    isLoading: boolean;
    isLoadingMore: boolean;
    error: FonderieApiError | null;
    hasMore: boolean;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    loadMore: () => Promise<void>;
}

interface IUseSessionsReturn {
    sessions: ISessionDTO[];
    isLoading: boolean;
    error: FonderieApiError | null;
    refresh: (opts?: {
        force?: boolean;
    }) => Promise<void>;
    terminate: (id: string) => Promise<void>;
    terminateOthers: () => Promise<void>;
}

interface IUseAuthProvidersReturn {
    providers: string[];
    has: (provider: string) => boolean;
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

interface IUseUnlinkOauthReturn {
    unlinkOauth: (provider: string) => Promise<void>;
    unlinked: boolean;
    isLoading: boolean;
    error: FonderieApiError | null;
    requiresPassword: boolean;
}

interface IUseStepUpReturn {
    methods: StepUpMethod[];
    loadMethods: () => Promise<StepUpMethod[]>;
    requestCode: (channel: 'email' | 'sms') => Promise<void>;
    confirm: (proof: IStepUpProof) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

function useForgotPassword(client?: AuthClient | undefined): IUseForgotPasswordReturn

function useLogin(client?: AuthClient | undefined): IUseLoginReturn

function useAppleSignIn(client?: AuthClient | undefined): IUseAppleSignInReturn

function useGoogleSignIn(client?: AuthClient | undefined): IUseGoogleSignInReturn

function useLogout(client?: AuthClient | undefined): IUseLogoutReturn

function useAccountData(client?: AuthClient | undefined): IUseAccountDataReturn

function useRestoreAccount(client?: AuthClient | undefined): IUseRestoreAccountReturn

function useChangePassword(client?: AuthClient | undefined): IUseChangePasswordReturn

function useMfaLogin(client?: AuthClient | undefined): IUseMfaLoginReturn

function useMfaSetup(client?: AuthClient | undefined): IUseMfaSetupReturn

function useProfile(client?: AuthClient | undefined): IUseProfileReturn

function useRegister(client?: AuthClient | undefined): IUseRegisterReturn

function useResetPassword(client?: AuthClient | undefined): IUseResetPasswordReturn

function useAuthProviders(client?: AuthClient | undefined): IUseAuthProvidersReturn

function useUnlinkOauth(client?: AuthClient | undefined): IUseUnlinkOauthReturn

function useSession(client?: AuthClient | undefined): IUseSessionReturn

function useVerifyEmail(client?: AuthClient | undefined): IUseVerifyEmailReturn

function useLoginHistory(rawFilters?: IGetLoginHistoryInput | undefined): IUseLoginHistoryReturn

function useSessions(client?: AuthClient | undefined): IUseSessionsReturn

function useStepUp(client?: AuthClient | undefined): IUseStepUpReturn

function resolveSocialButtons(providers: readonly string[], options: { isIOS: boolean; enforceAppleGuideline?: boolean; }): ISocialButtons

interface ISocialButtons {
    apple: boolean;
    google: boolean;
    appleGuidelineRisk: boolean;
}

function clearToken(): Promise<void>

function persistToken(token: string): Promise<void>

function readToken(): Promise<string | null>

const TOKEN_KEY: "fonderie_access_token"
```
