<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-customers — signatures

## @fonderie/vue-customers

```ts
type CustomerLabelType = 'phone' | 'email' | 'address';

type CustomerSex = 'UNKNOWN' | 'MALE' | 'FEMALE';

new CustomersClient(http: HttpClient, tokens: TokenStore): CustomersClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listCustomers(input?: IListCustomersInput | undefined): Promise<IApiResponse<ICustomerListResult>>
  .createCustomer(input?: ICreateCustomerInput | undefined): Promise<IApiResponse<ICustomerResult>>
  .getCustomer(customerId: string, input?: IGetCustomerInput | undefined): Promise<IApiResponse<ICustomerDetailDTO | ICustomerDetailD2DTO>>
  .updateCustomer(customerId: string, input: ICreateCustomerInput): Promise<IApiResponse<ICustomerResult>>
  .deleteCustomer(customerId: string): Promise<IApiResponse<undefined>>
  .blacklistCustomer(customerId: string, input?: IBlacklistCustomerInput | undefined): Promise<IApiResponse<undefined>>
  .unblacklistCustomer(customerId: string): Promise<IApiResponse<undefined>>
  .listEmails(customerId: string): Promise<IApiResponse<ICustomerEmailListResult>>
  .addEmail(customerId: string, input: IAddEmailInput): Promise<IApiResponse<ICustomerEmailResult>>
  .updateEmailLabel(customerId: string, emailId: string, label: string): Promise<IApiResponse<ICustomerEmailResult>>
  .setPrimaryEmail(customerId: string, emailId: string): Promise<IApiResponse<undefined>>
  .removeEmail(customerId: string, emailId: string): Promise<IApiResponse<undefined>>
  .listPhones(customerId: string): Promise<IApiResponse<ICustomerPhoneListResult>>
  .addPhone(customerId: string, input: IAddPhoneInput): Promise<IApiResponse<ICustomerPhoneResult>>
  .updatePhoneLabel(customerId: string, phoneId: string, label: string): Promise<IApiResponse<ICustomerPhoneResult>>
  .setPrimaryPhone(customerId: string, phoneId: string): Promise<IApiResponse<undefined>>
  .removePhone(customerId: string, phoneId: string): Promise<IApiResponse<undefined>>
  .listAddresses(customerId: string): Promise<IApiResponse<ICustomerAddressListResult>>
  .addAddress(customerId: string, input: IAddAddressInput): Promise<IApiResponse<ICustomerAddressResult>>
  .updateAddressLabel(customerId: string, addrId: string, label: string): Promise<IApiResponse<ICustomerAddressResult>>
  .setPrimaryAddress(customerId: string, addrId: string): Promise<IApiResponse<undefined>>
  .removeAddress(customerId: string, addrId: string): Promise<IApiResponse<undefined>>
  .listNotes(customerId: string): Promise<IApiResponse<ICustomerNoteListResult>>
  .createNote(customerId: string, body: string): Promise<IApiResponse<ICustomerNoteResult>>
  .updateNote(customerId: string, noteId: string, body: string): Promise<IApiResponse<ICustomerNoteResult>>
  .deleteNote(customerId: string, noteId: string): Promise<IApiResponse<undefined>>
  .listTags(customerId: string): Promise<IApiResponse<ICustomerTagListResult>>
  .addTag(customerId: string, tag: string): Promise<IApiResponse<undefined>>
  .removeTag(customerId: string, tag: string): Promise<IApiResponse<undefined>>
  .listRelationships(customerId: string): Promise<IApiResponse<ICustomerRelationshipListResult>>
  .addRelationship(customerId: string, input: IAddRelationshipInput): Promise<IApiResponse<ICustomerRelationshipResult>>
  .setPrimaryRelationship(customerId: string, relatedId: string): Promise<IApiResponse<undefined>>
  .removeRelationship(customerId: string, relatedId: string): Promise<IApiResponse<undefined>>
  .listLabels(type: CustomerLabelType): Promise<IApiResponse<ICustomerLabelListResult>>
  .removeLabel(labelId: string): Promise<IApiResponse<undefined>>

type CustomerType = 'individual' | 'business';

interface IAddAddressInput {
    countryIso: string;
    zipPostalCode: string;
    subdivision1Iso?: string | null;
    subdivision2Iso?: string | null;
    unit?: string | null;
    line1?: string | null;
    line2?: string | null;
    label?: string;
    isPrimary?: boolean;
}

interface IAddEmailInput {
    email: string;
    label?: string;
    isPrimary?: boolean;
}

interface IAddPhoneInput {
    phone: string;
    label?: string;
    isPrimary?: boolean;
}

interface IAddRelationshipInput {
    relatedId: string;
    relationship?: string;
    isPrimary?: boolean;
}

interface IAddressDTO {
    countryIso: string;
    subdivision1Iso: string;
    subdivision2Iso: string;
    zipPostalCode: string;
    unit: string;
    line1: string;
    line2: string;
}

interface IBlacklistCustomerInput {
    reason?: string;
}

interface ICreateCustomerInput {
    type?: CustomerType;
    sex?: CustomerSex;
    firstName?: string | null;
    lastName?: string | null;
    companyName?: string | null;
    avatarUrl?: string | null;
    locale?: string | null;
    referenceCode?: string | null;
    referralCode?: string | null;
    referredByCode?: string | null;
}

interface ICustomerAddressDTO {
    id: string;
    label: string;
    isPrimary: boolean;
    address: IAddressDTO;
}

interface ICustomerDetailD2DTO extends Omit<ICustomerDetailDTO, 'relationships'> {
    relationships: ICustomerRelationshipExpandedD2DTO[];
}

interface ICustomerDetailDTO extends ICustomerDTO {
    emails: ICustomerEmailDTO[];
    phones: ICustomerPhoneDTO[];
    addresses: ICustomerAddressDTO[];
    notes: ICustomerNoteDTO[];
    relationships: ICustomerRelationshipExpandedDTO[];
    tags: string[];
}

interface ICustomerDTO {
    id: string;
    type: string;
    sex: CustomerSex;
    firstName: string;
    lastName: string;
    companyName: string;
    avatarUrl: string;
    locale: string;
    referenceCode: string;
    referralCode: string;
    referredBy: string | null;
    blacklisted: {
        status: boolean;
        reason: string | null;
    };
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

interface ICustomerEmailDTO {
    id: string;
    email: string;
    label: string;
    isPrimary: boolean;
    createdAt: string;
}

interface ICustomerLabelDTO {
    id: string;
    type: CustomerLabelType;
    value: string;
    createdAt: string;
}

interface ICustomerNoteDTO {
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}

interface ICustomerPhoneDTO {
    id: string;
    phone: string;
    label: string;
    isPrimary: boolean;
    createdAt: string;
}

interface ICustomerRelationshipDTO {
    id: string;
    relatedId: string;
    relationship: string;
    isPrimary: boolean;
    createdAt: string;
}

type ICustomerRelationshipExpandedD2DTO = ICustomerRelationshipExpandedDTO & {
    relationships: ICustomerRelationshipExpandedDTO[];
};

type ICustomerRelationshipExpandedDTO = Omit<ICustomerShallowDTO, 'id'> & {
    id: string;
    customerId: string;
    relationship: string;
    isPrimary: boolean;
};

interface ICustomerShallowDTO extends ICustomerDTO {
    emails: ICustomerEmailDTO[];
    phones: ICustomerPhoneDTO[];
    addresses: ICustomerAddressDTO[];
    notes: ICustomerNoteDTO[];
    tags: string[];
}

interface IGetCustomerInput {
    depth?: 1 | 2;
}

interface IListCustomersInput {
    search?: string;
    blacklisted?: boolean;
    limit?: number;
    offset?: number;
}

type IUpdateCustomerInput = ICreateCustomerInput;

new FonderieApiError(reason: string, explanation: string, status: number, details?: unknown): FonderieApiError
  .reason: string
  .explanation: string
  .status: number
  .details: unknown
  .name: string
  .message: string
  .stack: string
  .cause: unknown

function useCustomer(client: CustomersClient, customerId: string, depth?: 1 | 2): { customer: Ref<{ emails: { id: string; email: string; label: string; isPrimary: boolean; createdAt: string; }[]; ... 19 more ...; updatedAt: string; } | { ...; } | null, ICustomerDetailDTO | ... 3 more ... | null>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; updateCustomer: (input: ICreateCustomerInput) => Promise<...>; }

function useCustomerAddresses(client: CustomersClient, customerId: string): { addresses: Ref<{ id: string; label: string; isPrimary: boolean; address: { countryIso: string; subdivision1Iso: string; subdivision2Iso: string; zipPostalCode: string; unit: string; line1: string; line2: string; }; }[], ICustomerAddressDTO[] | { ...; }[]>; ... 6 more ...; removeAddress: (addrId: string) => Promise<...>; }

function useCustomerEmails(client: CustomersClient, customerId: string): { emails: Ref<{ id: string; email: string; label: string; isPrimary: boolean; createdAt: string; }[], ICustomerEmailDTO[] | { ...; }[]>; ... 6 more ...; removeEmail: (emailId: string) => Promise<...>; }

function useCustomerLabels(client: CustomersClient, type: CustomerLabelType): { labels: Ref<{ id: string; type: CustomerLabelType; value: string; createdAt: string; }[], ICustomerLabelDTO[] | { ...; }[]>; isLoading: Ref<...>; error: Ref<...>; refresh: () => Promise<...>; removeLabel: (labelId: string) => Promise<...>; }

function useCustomerNotes(client: CustomersClient, customerId: string): { notes: Ref<{ id: string; authorId: string; body: string; createdAt: string; updatedAt: string; }[], ICustomerNoteDTO[] | { ...; }[]>; ... 5 more ...; deleteNote: (noteId: string) => Promise<...>; }

function useCustomerPhones(client: CustomersClient, customerId: string): { phones: Ref<{ id: string; phone: string; label: string; isPrimary: boolean; createdAt: string; }[], ICustomerPhoneDTO[] | { ...; }[]>; ... 6 more ...; removePhone: (phoneId: string) => Promise<...>; }

function useCustomerRelationships(client: CustomersClient, customerId: string): { relationships: Ref<{ id: string; relatedId: string; relationship: string; isPrimary: boolean; createdAt: string; }[], ICustomerRelationshipDTO[] | { ...; }[]>; ... 5 more ...; removeRelationship: (relatedId: string) => Promise<...>; }

function useCustomers(client: CustomersClient, params?: IListCustomersInput): { customers: Ref<{ id: string; type: string; sex: CustomerSex; firstName: string; ... 10 more ...; updatedAt: string; }[], ICustomerDTO[] | { ...; }[]>; ... 6 more ...; unblacklistCustomer: (customerId: string) => Promise<...>; }

function useCustomerTags(client: CustomersClient, customerId: string): { tags: Ref<string[], string[]>; isLoading: Ref<boolean, boolean>; error: Ref<FonderieApiError | null, FonderieApiError | null>; refresh: () => Promise<...>; addTag: (tag: string) => Promise<...>; removeTag: (tag: string) => Promise<...>; }
```
