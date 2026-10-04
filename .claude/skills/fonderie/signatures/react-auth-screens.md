<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-auth-screens — signatures

## @fonderie/react-auth-screens

```ts
interface IForgotPasswordScreenProps {
    client?: AuthClient;
    onNavigateToLogin?: () => void;
    locale?: string;
}

interface ILoginScreenProps {
    client?: AuthClient;
    onLoginSuccess?: (result: ILoginResult) => void;
    onMfaRequired?: (mfaToken: string) => void;
    onNavigateToRegister?: () => void;
    onNavigateToForgotPassword?: () => void;
    locale?: string;
}

interface IMfaChallengeScreenProps {
    client?: AuthClient;
    mfaToken: string;
    onLoginSuccess?: (result: ILoginResult) => void;
    onNavigateToLogin?: () => void;
    locale?: string;
}

interface IRegisterScreenProps {
    client?: AuthClient;
    onRegisterSuccess?: (result: IRegisterResult) => void;
    onNavigateToLogin?: () => void;
    locale?: string;
}

interface IResetPasswordScreenProps {
    client?: AuthClient;
    initialPin?: string;
    onResetSuccess?: () => void;
    onNavigateToLogin?: () => void;
    locale?: string;
}

interface IVerifyEmailScreenProps {
    client?: AuthClient;
    onVerified?: (result: IVerifyEmailResult) => void;
    locale?: string;
}

function ForgotPasswordScreen({ client, onNavigateToLogin, locale, }: IForgotPasswordScreenProps): Element

function LoginScreen({ client, onLoginSuccess, onMfaRequired, onNavigateToRegister, onNavigateToForgotPassword, locale, }: ILoginScreenProps): Element

function MfaChallengeScreen({ client, mfaToken, onLoginSuccess, onNavigateToLogin, locale, }: IMfaChallengeScreenProps): Element

function RegisterScreen({ client, onRegisterSuccess, onNavigateToLogin, locale, }: IRegisterScreenProps): Element

function ResetPasswordScreen({ client, initialPin, onResetSuccess, onNavigateToLogin, locale, }: IResetPasswordScreenProps): Element

function VerifyEmailScreen({ client, onVerified, locale }: IVerifyEmailScreenProps): Element
```
