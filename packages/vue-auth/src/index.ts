export type {
	AuthClient,
	IChangePasswordInput,
	IGetLoginHistoryInput,
	ILoginEventDTO,
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

export { FonderieApiError, isMfaRequired } from '@fonderie/client';

export type {
	IUseAccountDataReturn,
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
} from './composables';
export {
	useAccountData,
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
} from './composables';

// Token persistence primitives — for wiring app-level flows (e.g. the
// client's auth.onTokensChanged) to the same storage the hooks use.
export { clearToken, persistToken, readToken, TOKEN_KEY } from './storage';
