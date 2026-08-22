<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-auth — signatures

## @fonderie/react-auth

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

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

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
    isLoading: boolean;
    error: FonderieApiError | null;
    data: IVerifyEmailResult | null;
}

function useForgotPassword(client?: AuthClient | undefined): IUseForgotPasswordReturn

function useLogin(client?: AuthClient | undefined): IUseLoginReturn

function useLogout(client?: AuthClient | undefined): IUseLogoutReturn

function useRegister(client?: AuthClient | undefined): IUseRegisterReturn

function useResetPassword(client?: AuthClient | undefined): IUseResetPasswordReturn

function useSession(client?: AuthClient | undefined): IUseSessionReturn

function useVerifyEmail(client?: AuthClient | undefined): IUseVerifyEmailReturn
```
