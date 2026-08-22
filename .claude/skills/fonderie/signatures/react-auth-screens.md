<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-auth-screens — signatures

## @fonderie/react-auth-screens

```ts
interface IForgotPasswordScreenProps {
    client?: AuthClient;
    onNavigateToLogin?: () => void;
}

interface ILoginScreenProps {
    client?: AuthClient;
    onLoginSuccess?: (result: ILoginResult) => void;
    onMfaRequired?: (mfaToken: string) => void;
    onNavigateToRegister?: () => void;
    onNavigateToForgotPassword?: () => void;
}

interface IMfaChallengeScreenProps {
    client?: AuthClient;
    mfaToken: string;
    onLoginSuccess?: (result: ILoginResult) => void;
    onNavigateToLogin?: () => void;
}

interface IRegisterScreenProps {
    client?: AuthClient;
    onRegisterSuccess?: (result: IRegisterResult) => void;
    onNavigateToLogin?: () => void;
}

interface IResetPasswordScreenProps {
    client?: AuthClient;
    initialPin?: string;
    onResetSuccess?: () => void;
    onNavigateToLogin?: () => void;
}

interface IVerifyEmailScreenProps {
    client?: AuthClient;
    onVerified?: (result: IVerifyEmailResult) => void;
}

function ForgotPasswordScreen({ client, onNavigateToLogin }: IForgotPasswordScreenProps): Element

function LoginScreen({ client, onLoginSuccess, onMfaRequired, onNavigateToRegister, onNavigateToForgotPassword, }: ILoginScreenProps): Element

function MfaChallengeScreen({ client, mfaToken, onLoginSuccess, onNavigateToLogin, }: IMfaChallengeScreenProps): Element

function RegisterScreen({ client, onRegisterSuccess, onNavigateToLogin, }: IRegisterScreenProps): Element

function ResetPasswordScreen({ client, initialPin, onResetSuccess, onNavigateToLogin, }: IResetPasswordScreenProps): Element

function VerifyEmailScreen({ client, onVerified }: IVerifyEmailScreenProps): Element
```
