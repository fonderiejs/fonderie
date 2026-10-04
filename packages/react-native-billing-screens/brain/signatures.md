<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-native-billing-screens — signatures

## @fonderie/react-native-billing-screens

```ts
interface IPricingScreenProps {
    client?: BillingClient;
    onCheckoutStart?: (url: string) => void;
    locale?: string;
}

interface ISubscriptionScreenProps {
    client?: BillingClient;
    onManageBilling?: (url: string) => void;
    onNavigateToPricing?: () => void;
    onAddPaymentMethod?: () => void;
    locale?: string;
}

function PricingScreen({ client, onCheckoutStart, locale }: IPricingScreenProps): Element

function SubscriptionScreen({ client, onManageBilling, onNavigateToPricing, onAddPaymentMethod, locale, }: ISubscriptionScreenProps): Element
```
