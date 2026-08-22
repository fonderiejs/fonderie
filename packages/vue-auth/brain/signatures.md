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

function useForgotPassword(client?: AuthClient | undefined): { forgotPassword: (email: string) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<FonderieApiError | null, FonderieApiError | null>; sent: Ref<...>; }

function useLogin(client?: AuthClient | undefined): { login: (input: ILoginInput) => Promise<ILoginResult | IMfaRequiredResult>; isLoading: Ref<...>; error: Ref<...>; data: Ref<...>; mfaPending: Ref<...>; }

function useLogout(client?: AuthClient | undefined): { logout: (refreshToken?: string | undefined) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<FonderieApiError | null, FonderieApiError | null>; }

function useRegister(client?: AuthClient | undefined): { register: (input: IRegisterInput) => Promise<IRegisterResult>; isLoading: Ref<boolean, boolean>; error: Ref<...>; data: Ref<...>; }

function useResetPassword(client?: AuthClient | undefined): { resetPassword: (input: IResetPasswordInput) => Promise<void>; isLoading: Ref<boolean, boolean>; error: Ref<...>; done: Ref<...>; }

function useSession(client?: AuthClient | undefined): { user: Ref<{ id: string; email: string; firstName: string; lastName: string; phone: string; profileImageUrl: string; isActive: boolean; lastLogin: string; ... 8 more ...; updatedAt: string; } | null, IUserDTO | ... 1 more ... | null>; isLoading: Ref<...>; isAuthenticated: Ref<...>; refresh: () => Promise<...>; logout: (refreshToken?: string | undefined) => Promise<...>; }

function useVerifyEmail(client?: AuthClient | undefined): { verifyEmail: (pin: string) => Promise<IVerifyEmailResult>; isLoading: Ref<boolean, boolean>; error: Ref<...>; data: Ref<...>; }
```
