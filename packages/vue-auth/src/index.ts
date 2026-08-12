export type {
	AuthClient,
	ILoginInput,
	ILoginResult,
	IRegisterInput,
	IRegisterResult,
	IResetPasswordInput,
	ITokens,
	IUserDTO,
	IVerifyEmailResult,
} from '@fonderie/client';

export { FonderieApiError } from '@fonderie/client';

export {
	useForgotPassword,
	useLogin,
	useLogout,
	useRegister,
	useResetPassword,
	useSession,
	useVerifyEmail,
} from './composables';
