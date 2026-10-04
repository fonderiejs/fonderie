<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-customers-screens — signatures

## @fonderie/react-customers-screens

```ts
interface ICustomerDetailScreenProps {
    client?: CustomersClient;
    customerId: string;
    onNavigateToList?: () => void;
    locale?: string;
}

interface ICustomersListScreenProps {
    client?: CustomersClient;
    onSelectCustomer?: (customerId: string) => void;
    locale?: string;
}

function CustomerDetailScreen({ client, customerId, onNavigateToList, locale, }: ICustomerDetailScreenProps): Element

function CustomersListScreen({ client, onSelectCustomer, locale, }: ICustomersListScreenProps): Element
```
