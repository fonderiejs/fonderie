<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-native-auth — signatures

## @fonderie/react-native-auth

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
  .getUser(): Promise<IApiResponse<IMeResult>>
  .updateProfile(input: IUpdateProfileInput): Promise<IApiResponse<IMeResult>>
  .updatePreferences(input: IUpdatePreferencesInput): Promise<IApiResponse<IMeResult>>
  .updateEmail(email: string): Promise<IApiResponse<unknown>>
  .updatePhone(phone: string): Promise<IApiResponse<unknown>>
  .changePassword(input: IChangePasswordInput): Promise<IApiResponse<undefined>>
  .exportData(): Promise<IApiResponse<unknown>>
  .deleteUser(): Promise<IApiResponse<undefined>>

interface ILoginInput {
    email: string;
    password: string;
}

interface ILoginResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface IMfaRequiredResult {
    mfaToken: string;
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

interface IChangePasswordInput {
    currentPassword: string;
    newPassword: string;
}

interface IMfaEnabledResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface IMfaSetupResult {
    secret: string;
    uri: string;
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

interface IUseLogoutReturn {
    logout: (refreshToken?: string) => Promise<void>;
    isLoading: boolean;
    error: FonderieApiError | null;
}

interface IUseAccountDataReturn {
    exportData: () => Promise<unknown>;
    deleteUser: () => Promise<void>;
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

function useForgotPassword(client?: AuthClient | undefined): IUseForgotPasswordReturn

function useLogin(client?: AuthClient | undefined): IUseLoginReturn

function useLogout(client?: AuthClient | undefined): IUseLogoutReturn

function useAccountData(client?: AuthClient | undefined): IUseAccountDataReturn

function useChangePassword(client?: AuthClient | undefined): IUseChangePasswordReturn

function useMfaLogin(client?: AuthClient | undefined): IUseMfaLoginReturn

function useMfaSetup(client?: AuthClient | undefined): IUseMfaSetupReturn

function useProfile(client?: AuthClient | undefined): IUseProfileReturn

function useRegister(client?: AuthClient | undefined): IUseRegisterReturn

function useResetPassword(client?: AuthClient | undefined): IUseResetPasswordReturn

function useSession(client?: AuthClient | undefined): IUseSessionReturn

function useVerifyEmail(client?: AuthClient | undefined): IUseVerifyEmailReturn

function clearToken(): Promise<void>

function persistToken(token: string): Promise<void>

function readToken(): Promise<string | null>

const TOKEN_KEY: "fonderie_access_token"
```
