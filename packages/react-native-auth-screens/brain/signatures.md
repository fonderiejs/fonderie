<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-native-auth-screens — signatures

## @fonderie/react-native-auth-screens

```ts
function LoginScreen({ client, onLoginSuccess, onNavigateToRegister, onNavigateToForgotPassword, }: ILoginScreenProps): Element

function RegisterScreen({ client, onRegisterSuccess, onNavigateToLogin, }: IRegisterScreenProps): Element

function ForgotPasswordScreen({ client, onNavigateToLogin }: IForgotPasswordScreenProps): Element

interface ILoginScreenProps {
    client: AuthClient;
    onLoginSuccess?: (result: ILoginResult) => void;
    onNavigateToRegister?: () => void;
    onNavigateToForgotPassword?: () => void;
}

interface IRegisterScreenProps {
    client: AuthClient;
    onRegisterSuccess?: (result: IRegisterResult) => void;
    onNavigateToLogin?: () => void;
}

interface IForgotPasswordScreenProps {
    client: AuthClient;
    onNavigateToLogin?: () => void;
}
```
