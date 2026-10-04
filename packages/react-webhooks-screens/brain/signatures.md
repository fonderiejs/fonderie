<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-webhooks-screens — signatures

## @fonderie/react-webhooks-screens

```ts
interface IWebhookDetailScreenProps {
    client?: WebhooksClient;
    endpointId: string;
    onNavigateToList?: () => void;
    locale?: string;
}

interface IWebhooksListScreenProps {
    client?: WebhooksClient;
    onSelectEndpoint?: (endpointId: string) => void;
    locale?: string;
}

function WebhookDetailScreen({ client, endpointId, onNavigateToList, locale, }: IWebhookDetailScreenProps): Element

function WebhooksListScreen({ client, onSelectEndpoint, locale }: IWebhooksListScreenProps): Element
```
