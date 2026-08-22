<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/react-native-customers-screens — signatures

## @fonderie/react-native-customers-screens

```ts
interface ICustomerDetailScreenProps {
    client?: CustomersClient;
    customerId: string;
    onNavigateToList?: () => void;
}

interface ICustomersListScreenProps {
    client?: CustomersClient;
    onSelectCustomer?: (customerId: string) => void;
}

function CustomerDetailScreen({ client, customerId, onNavigateToList, }: ICustomerDetailScreenProps): Element

function CustomersListScreen({ client, onSelectCustomer }: ICustomersListScreenProps): Element
```
