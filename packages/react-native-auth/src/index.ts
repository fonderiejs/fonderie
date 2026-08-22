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

export { FonderieApiError, isMfaRequired } from '@fonderie/client';
export type {
	IUseForgotPasswordReturn,
	IUseLoginReturn,
	IUseLogoutReturn,
	IUseMfaLoginReturn,
	IUseRegisterReturn,
	IUseResetPasswordReturn,
	IUseSessionReturn,
	IUseVerifyEmailReturn,
} from './hooks';
export {
	useForgotPassword,
	useLogin,
	useLogout,
	useMfaLogin,
	useRegister,
	useResetPassword,
	useSession,
	useVerifyEmail,
} from './hooks';

// Token persistence primitives — for wiring app-level flows (e.g. the
// client's auth.onTokensChanged) to the same storage the hooks use.
export { clearToken, persistToken, readToken, TOKEN_KEY } from './storage';
