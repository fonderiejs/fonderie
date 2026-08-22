<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-billing-screens — signatures

## @fonderie/react-billing-screens

```ts
interface IPricingScreenProps {
    client?: BillingClient;
    onCheckoutStart?: (url: string) => void;
}

interface ISubscriptionScreenProps {
    client?: BillingClient;
    onManageBilling?: (url: string) => void;
    onNavigateToPricing?: () => void;
}

function PricingScreen({ client, onCheckoutStart }: IPricingScreenProps): Element

function SubscriptionScreen({ client, onManageBilling, onNavigateToPricing, }: ISubscriptionScreenProps): Element
```
