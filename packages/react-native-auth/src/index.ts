export type {
	AuthClient,
	IAppleNativeInput,
	IGoogleNativeInput,
	ILoginInput,
	ILoginResult,
	IMfaRequiredResult,
	IRegisterInput,
	IRegisterResult,
	IResetPasswordInput,
	ITokens,
	IUserDTO,
	IVerifyEmailResult,
} from '@fonderie/client';

export type {
	IChangePasswordInput,
	IMfaEnabledResult,
	IMfaSetupResult,
	IUpdatePreferencesInput,
	IUpdateProfileInput,
	IGetLoginHistoryInput,
	ILoginEventDTO,
	IRequestLocationDTO,
	ISessionDTO,
} from '@fonderie/client';
export { FonderieApiError, isMfaRequired, isSessionRefusal } from '@fonderie/client';
export type {
	IUseForgotPasswordReturn,
	IUseLoginReturn,
	IUseAppleSignInReturn,
	IUseGoogleSignInReturn,
	IUseLogoutReturn,
	IUseAccountDataReturn,
	IUseRestoreAccountReturn,
	IUseChangePasswordReturn,
	IUseMfaLoginReturn,
	IUseMfaSetupReturn,
	IUseProfileReturn,
	IUseRegisterReturn,
	IUseResetPasswordReturn,
	IUseSessionReturn,
	IUseVerifyEmailReturn,
	IUseLoginHistoryReturn,
	IUseSessionsReturn,
	IUseAuthProvidersReturn,
	IUseUnlinkOauthReturn,
	IUseStepUpReturn,
} from './hooks';
export {
	useForgotPassword,
	useLogin,
	useAppleSignIn,
	useGoogleSignIn,
	useLogout,
	useAccountData,
	useRestoreAccount,
	useChangePassword,
	useMfaLogin,
	useMfaSetup,
	useProfile,
	useRegister,
	useResetPassword,
	useAuthProviders,
	useUnlinkOauth,
	useSession,
	useVerifyEmail,
	useLoginHistory,
	useSessions,
	useStepUp,
} from './hooks';

// Token persistence primitives — for wiring app-level flows (e.g. the
// client's auth.onTokensChanged) to the same storage the hooks use.
export { resolveSocialButtons } from './social-buttons';
export type { ISocialButtons } from './social-buttons';
export { clearToken, persistToken, readToken, TOKEN_KEY } from './storage';
