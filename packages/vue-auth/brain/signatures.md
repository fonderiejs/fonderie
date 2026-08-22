<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-auth — signatures

## @fonderie/vue-auth

```ts
new AuthClient(http: HttpClient, tokens: TokenStore): AuthClient
  .mfa: MfaClient
  .setAccessToken(token: string | undefined): void
  .register(input: IRegisterInput): Promise<IApiResponse<IRegisterResult>>
  .login(input: ILoginInput): Promise<IApiResponse<ILoginResult | IMfaRequiredResult>>
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

interface IChangePasswordInput {
    currentPassword: string;
    newPassword: string;
}

interface ILoginInput {
    email: string;
    password: string;
}

interface ILoginResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface IMfaEnabledResult {
    tokens: ITokens;
    user: IUserDTO;
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
}

interface IResetPasswordInput {
    pin: string;
    password: string;
}

interface ITokens {
    access: string;
    refresh: string;
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

interface IVerifyEmailResult {
    verified: boolean;
    email: string;
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

function useAccountData(client?: AuthClient | undefined): IUseAccountDataReturn

function useChangePassword(client?: AuthClient | undefined): IUseChangePasswordReturn

function useForgotPassword(client?: AuthClient | undefined): { forgotPassword: (email: string) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<FonderieApiError | null, FonderieApiError | null>; sent: Ref<...>; }

function useLogin(client?: AuthClient | undefined): { login: (input: ILoginInput) => Promise<ILoginResult | IMfaRequiredResult>; isLoading: Ref<...>; error: Ref<...>; data: Ref<...>; mfaPending: Ref<...>; }

function useLogout(client?: AuthClient | undefined): { logout: (refreshToken?: string | undefined) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<FonderieApiError | null, FonderieApiError | null>; }

function useMfaLogin(client?: AuthClient | undefined): IUseMfaLoginReturn

function useMfaSetup(client?: AuthClient | undefined): IUseMfaSetupReturn

function useProfile(client?: AuthClient | undefined): IUseProfileReturn

function useRegister(client?: AuthClient | undefined): { register: (input: IRegisterInput) => Promise<IRegisterResult>; isLoading: Ref<boolean, boolean>; error: Ref<...>; data: Ref<...>; }

function useResetPassword(client?: AuthClient | undefined): { resetPassword: (input: IResetPasswordInput) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<...>; done: Ref<...>; }

function useSession(client?: AuthClient | undefined): { user: Ref<{ id: string; email: string; firstName: string; lastName: string; phone: string; profileImageUrl: string; isActive: boolean; lastLogin: string; ... 8 more ...; updatedAt: string; } | null, IUserDTO | ... 1 more ... | null>; isLoading: Ref<...>; isAuthenticated: Ref<...>; refresh: (opts?: { ...; } | undefined) => Promise<...>; logout: (refreshToken?: string | undefined) => Promise<...>; }

function useVerifyEmail(client?: AuthClient | undefined): { verifyEmail: (pin: string) => Promise<IVerifyEmailResult>; resend: () => Promise<void>; resent: Ref<...>; isLoading: Ref<...>; error: Ref<...>; data: Ref<...>; }

function clearToken(): void

function persistToken(token: string): void

function readToken(): string | null

const TOKEN_KEY: "fonderie_access_token"
```
