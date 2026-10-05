export type {
	AuthClient,
	IChangePasswordInput,
	IGetLoginHistoryInput,
	ILoginEventDTO,
	IRequestLocationDTO,
	ILoginInput,
	ILoginResult,
	IMfaEnabledResult,
	IMfaRequiredResult,
	IMfaSetupResult,
	IRegisterInput,
	IRegisterResult,
	IResetPasswordInput,
	ISessionDTO,
	ITokens,
	IUpdatePreferencesInput,
	IUpdateProfileInput,
	IUserDTO,
	IVerifyEmailResult,
} from '@fonderie/client';

export { FonderieApiError, isMfaRequired, isSessionRefusal } from '@fonderie/client';

export type {
	IUseAuthProvidersReturn,
	IUseUnlinkOauthReturn,
	IUseAccountDataReturn,
	IUseRestoreAccountReturn,
	IUseChangePasswordReturn,
	IUseForgotPasswordReturn,
	IUseLoginHistoryReturn,
	IUseLoginReturn,
	IUseLogoutReturn,
	IUseMfaLoginReturn,
	IUseMfaSetupReturn,
	IUseProfileReturn,
	IUseRegisterReturn,
	IUseResetPasswordReturn,
	IUseSessionReturn,
	IUseSessionsReturn,
	IUseVerifyEmailReturn,
	IUseStepUpReturn,
} from './composables';
export {
	useAuthProviders,
	useUnlinkOauth,
	useAccountData,
	useRestoreAccount,
	useChangePassword,
	useForgotPassword,
	useLogin,
	useLoginHistory,
	useLogout,
	useMfaLogin,
	useMfaSetup,
	useProfile,
	useRegister,
	useResetPassword,
	useSession,
	useSessions,
	useVerifyEmail,
	useStepUp,
} from './composables';

// Token persistence primitives — for wiring app-level flows (e.g. the
// client's auth.onTokensChanged) to the same storage the hooks use.
export { clearToken, persistToken, readToken, TOKEN_KEY } from './storage';
