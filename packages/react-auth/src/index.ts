export type {
	AuthClient,
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
	ISessionDTO,
} from '@fonderie/client';
export { FonderieApiError, isMfaRequired } from '@fonderie/client';
export type {
	IUseForgotPasswordReturn,
	IUseLoginReturn,
	IUseLogoutReturn,
	IUseAccountDataReturn,
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
} from './hooks';
export {
	useForgotPassword,
	useLogin,
	useLogout,
	useAccountData,
	useChangePassword,
	useMfaLogin,
	useMfaSetup,
	useProfile,
	useRegister,
	useResetPassword,
	useSession,
	useVerifyEmail,
	useLoginHistory,
	useSessions,
} from './hooks';

// Token persistence primitives — for wiring app-level flows (e.g. the
// client's auth.onTokensChanged) to the same storage the hooks use.
export { clearToken, persistToken, readToken, TOKEN_KEY } from './storage';
