<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/vue-customers — signatures

## @fonderie/vue-customers

```ts
type CustomerLabelType = 'phone' | 'email' | 'address';

type CustomerSex = 'UNKNOWN' | 'MALE' | 'FEMALE';

new CustomersClient(http: HttpClient, tokens: TokenStore): CustomersClient
  .setAccessToken(token: string | undefined): void
  .setWorkspaceId(workspaceId: string | undefined): void
  .listCustomers(input?: IListCustomersInput | undefined, opts?: IReadOptions | undefined): Promise<IApiResponse<ICustomerListResult>>
  .createCustomer(input?: ICreateCustomerInput | undefined): Promise<IApiResponse<ICustomerResult>>
  .getCustomer(customerId: string, input?: IGetCustomerInput | undefined, opts?: IReadOptions | undefined): Promise<IApiResponse<ICustomerDetailDTO | ICustomerDetailD2DTO>>
  .updateCustomer(customerId: string, input: ICreateCustomerInput): Promise<IApiResponse<ICustomerResult>>
  .deleteCustomer(customerId: string): Promise<IApiResponse<undefined>>
  .blacklistCustomer(customerId: string, input?: IBlacklistCustomerInput | undefined): Promise<IApiResponse<undefined>>
  .unblacklistCustomer(customerId: string): Promise<IApiResponse<undefined>>
  .listEmails(customerId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<ICustomerEmailListResult>>
  .addEmail(customerId: string, input: IAddEmailInput): Promise<IApiResponse<ICustomerEmailResult>>
  .updateEmailLabel(customerId: string, emailId: string, label: string): Promise<IApiResponse<ICustomerEmailResult>>
  .setPrimaryEmail(customerId: string, emailId: string): Promise<IApiResponse<undefined>>
  .removeEmail(customerId: string, emailId: string): Promise<IApiResponse<undefined>>
  .listPhones(customerId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<ICustomerPhoneListResult>>
  .addPhone(customerId: string, input: IAddPhoneInput): Promise<IApiResponse<ICustomerPhoneResult>>
  .updatePhoneLabel(customerId: string, phoneId: string, label: string): Promise<IApiResponse<ICustomerPhoneResult>>
  .setPrimaryPhone(customerId: string, phoneId: string): Promise<IApiResponse<undefined>>
  .removePhone(customerId: string, phoneId: string): Promise<IApiResponse<undefined>>
  .listAddresses(customerId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<ICustomerAddressListResult>>
  .addAddress(customerId: string, input: IAddAddressInput): Promise<IApiResponse<ICustomerAddressResult>>
  .updateAddressLabel(customerId: string, addrId: string, label: string): Promise<IApiResponse<ICustomerAddressResult>>
  .setPrimaryAddress(customerId: string, addrId: string): Promise<IApiResponse<undefined>>
  .removeAddress(customerId: string, addrId: string): Promise<IApiResponse<undefined>>
  .listNotes(customerId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<ICustomerNoteListResult>>
  .createNote(customerId: string, body: string): Promise<IApiResponse<ICustomerNoteResult>>
  .updateNote(customerId: string, noteId: string, body: string): Promise<IApiResponse<ICustomerNoteResult>>
  .deleteNote(customerId: string, noteId: string): Promise<IApiResponse<undefined>>
  .listTags(customerId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<ICustomerTagListResult>>
  .addTag(customerId: string, tag: string): Promise<IApiResponse<undefined>>
  .removeTag(customerId: string, tag: string): Promise<IApiResponse<undefined>>
  .listRelationships(customerId: string, opts?: IReadOptions | undefined): Promise<IApiResponse<ICustomerRelationshipListResult>>
  .addRelationship(customerId: string, input: IAddRelationshipInput): Promise<IApiResponse<ICustomerRelationshipResult>>
  .setPrimaryRelationship(customerId: string, relatedId: string): Promise<IApiResponse<undefined>>
  .removeRelationship(customerId: string, relatedId: string): Promise<IApiResponse<undefined>>
  .listLabels(type: CustomerLabelType, opts?: IReadOptions | undefined): Promise<IApiResponse<ICustomerLabelListResult>>
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

function useCustomer(customerId: string, depth?: 1 | 2 | undefined): IUseCustomerReturn

function useCustomerAddresses(customerId: string): IUseCustomerAddressesReturn

function useCustomerEmails(customerId: string): IUseCustomerEmailsReturn

function useCustomerLabels(type: CustomerLabelType): IUseCustomerLabelsReturn

function useCustomerNotes(customerId: string): IUseCustomerNotesReturn

function useCustomerPhones(customerId: string): IUseCustomerPhonesReturn

function useCustomerRelationships(customerId: string): IUseCustomerRelationshipsReturn

function useCustomers(params?: IListCustomersInput | undefined): IUseCustomersReturn

function useCustomerTags(customerId: string): IUseCustomerTagsReturn
```
