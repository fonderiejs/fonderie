<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-auth — signatures

## @fonderie/react-auth

```ts
new AuthClient(http: HttpClient, tokens: TokenStore): AuthClient
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
    resetToken: string;
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
    login: (input: ILoginInput) => Promise<ILoginResult>;
    isLoading: boolean;
    error: FonderieApiError | null;
    data: ILoginResult | null;
}

interface IUseLogoutReturn {
    logout: () => Promise<void>;
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
    logout: () => Promise<void>;
}

interface IUseVerifyEmailReturn {
    verifyEmail: (pin: string) => Promise<IVerifyEmailResult>;
    isLoading: boolean;
    error: FonderieApiError | null;
    data: IVerifyEmailResult | null;
}

function useForgotPassword(client: AuthClient): IUseForgotPasswordReturn

function useLogin(client: AuthClient): IUseLoginReturn

function useLogout(client: AuthClient): IUseLogoutReturn

function useRegister(client: AuthClient): IUseRegisterReturn

function useResetPassword(client: AuthClient): IUseResetPasswordReturn

function useSession(client: AuthClient): IUseSessionReturn

function useVerifyEmail(client: AuthClient): IUseVerifyEmailReturn
```
