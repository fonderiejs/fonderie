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
	IUseRegisterReturn,
	IUseResetPasswordReturn,
	IUseSessionReturn,
	IUseVerifyEmailReturn,
} from './hooks';
export {
	useForgotPassword,
	useLogin,
	useLogout,
	useRegister,
	useResetPassword,
	useSession,
	useVerifyEmail,
} from './hooks';
