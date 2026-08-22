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
    onNavigateToRegister?: () => void;
    onNavigateToForgotPassword?: () => void;
}

interface IRegisterScreenProps {
    client?: AuthClient;
    onRegisterSuccess?: (result: IRegisterResult) => void;
    onNavigateToLogin?: () => void;
}

function ForgotPasswordScreen({ client, onNavigateToLogin }: IForgotPasswordScreenProps): Element

function LoginScreen({ client, onLoginSuccess, onNavigateToRegister, onNavigateToForgotPassword, }: ILoginScreenProps): Element

function RegisterScreen({ client, onRegisterSuccess, onNavigateToLogin, }: IRegisterScreenProps): Element
```
