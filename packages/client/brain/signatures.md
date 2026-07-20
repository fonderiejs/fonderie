<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/client — signatures

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
