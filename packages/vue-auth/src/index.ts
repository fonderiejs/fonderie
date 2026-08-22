export type {
	AuthClient,
	IChangePasswordInput,
	ILoginInput,
	ILoginResult,
	IMfaEnabledResult,
	IMfaRequiredResult,
	IMfaSetupResult,
	IRegisterInput,
	IRegisterResult,
	IResetPasswordInput,
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
	IUseLoginReturn,
	IUseLogoutReturn,
	IUseMfaLoginReturn,
	IUseMfaSetupReturn,
	IUseProfileReturn,
	IUseRegisterReturn,
	IUseResetPasswordReturn,
	IUseSessionReturn,
	IUseVerifyEmailReturn,
} from './composables';
export {
	useAccountData,
	useChangePassword,
	useForgotPassword,
	useLogin,
	useLogout,
	useMfaLogin,
	useMfaSetup,
	useProfile,
	useRegister,
	useResetPassword,
	useSession,
	useVerifyEmail,
} from './composables';

// Token persistence primitives — for wiring app-level flows (e.g. the
// client's auth.onTokensChanged) to the same storage the hooks use.
export { clearToken, persistToken, readToken, TOKEN_KEY } from './storage';
