<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/client — signatures

## @fonderie/client

```ts
interface IFonderieClientOptions {
    baseUrl: string;
    accessToken?: string;
}

new FonderieClient(opts: IFonderieClientOptions): FonderieClient
  .auth: AuthClient
  .billing: BillingClient

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

interface ILoginInput {
    email: string;
    password: string;
}

interface IRegisterInput {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
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

interface ICheckoutInput {
    plan: string;
    interval?: 'month' | 'year';
}

interface IRecordUsageInput {
    metric: string;
    quantity?: number;
}

new BillingClient(http: HttpClient, tokens: TokenStore): BillingClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listPlans(): Promise<IApiResponse<IPlanListResult>>
  .getPlan(planId: string): Promise<IApiResponse<IPlanResult>>
  .getSubscription(): Promise<IApiResponse<ISubscriptionResult>>
  .createCheckoutSession(input: ICheckoutInput): Promise<IApiResponse<ICheckoutUrlResult>>
  .createPortalSession(): Promise<IApiResponse<IPortalUrlResult>>
  .recordUsage(input: IRecordUsageInput): Promise<IApiResponse<undefined>>
  .getUsage(metric: string): Promise<IApiResponse<IUsageResult>>

interface IApiError {
    reason: string;
    explanation: string;
    details?: unknown;
}

interface IApiResponse<T = undefined> {
    reason: string;
    explanation: string;
    result: T;
}

interface ICheckoutUrlResult {
    url: string;
}

interface ILoginResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface IMeResult {
    user: IUserDTO;
}

interface IMfaEnabledResult {
    tokens: ITokens;
    user: IUserDTO;
}

interface IMfaSetupResult {
    secret: string;
    uri: string;
}

interface IPlanDTO {
    id: string;
    planId: string;
    name: string;
    description: string;
    tier: number;
    seats: number | null;
    trialDays: number;
    pricing: {
        monthly: number;
        yearly: number;
        currency: string;
    };
    features: IPlanFeature[];
    metadata: Record<string, unknown>;
}

interface IPlanFeature {
    name: string;
    description: string;
    enabled: boolean;
    limit?: number;
}

interface IPlanListResult {
    plans: IPlanDTO[];
}

interface IPlanResult {
    plan: IPlanDTO;
}

interface IPortalUrlResult {
    url: string;
}

interface IRefreshResult {
    tokens: ITokens;
}

interface IRegisterResult {
    tokens: ITokens;
    user: IUserDTO;
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

interface ISubscriptionDTO {
    id: string;
    subscriberType: SubscriberType;
    subscriberId: string;
    plan: string;
    interval: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    createdAt: string;
}

interface ISubscriptionResult {
    subscription: ISubscriptionDTO;
}

interface ITokens {
    access: string;
    refresh: string;
}

interface IUsageResult {
    metric: string;
    total: number;
    since: string;
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

interface IVerifyEmailResult {
    verified: boolean;
    email: string;
}

type SubscriberType = 'user' | 'workspace';
```
