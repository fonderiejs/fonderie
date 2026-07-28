<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/customers — signatures

## @fonderie/customers

Subpath exports: `@fonderie/customers/types`, `@fonderie/customers/migrations`

```ts
type CustomersEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

type ICustomersConfig = {
    referenceCodePrefix?: string;
};

const EVENT_KEYS: { readonly customerCreated: "fonderie.customer.created"; readonly customerUpdated: "fonderie.customer.updated"; readonly customerDeleted: "fonderie.customer.deleted"; readonly customerBlacklisted: "fonderie.customer.blacklisted"; readonly customerUnblacklisted: "fonderie.customer.unblacklisted"; }

interface IAddressDTO {
    countryIso: string;
    subdivision1Iso: string;
    subdivision2Iso: string;
    zipPostalCode: string;
    unit: string;
    line1: string;
    line2: string;
}

interface ICustomerAddressDTO {
    id: string;
    label: string;
    isPrimary: boolean;
    address: IAddressDTO;
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

interface ICustomerTagDTO {
    tag: string;
}

function toAddressDTO(a: IAddress): IAddressDTO

function toCustomerAddressDTO(ca: ICustomerAddress): ICustomerAddressDTO

function toCustomerDetailDTO(c: ICustomerDetail): ICustomerDetailDTO

function toCustomerDTO(c: ICustomer): ICustomerDTO

function toCustomerEmailDTO(e: ICustomerEmail): ICustomerEmailDTO

function toCustomerNoteDTO(n: ICustomerNote): ICustomerNoteDTO

function toCustomerPhoneDTO(p: ICustomerPhone): ICustomerPhoneDTO

function toCustomerTagDTO(t: ICustomerTag): ICustomerTagDTO

new CustomerAddressModel(store: IStoreAdapter): CustomerAddressModel
  .list(customerId: string): Promise<ICustomerAddress[]>
  .add(opts: { customerId: string; countryIso: string; subdivision1Iso?: string | null; subdivision2Iso?: string | null; zipPostalCode: string; unit?: string | null; line1?: string | null; line2?: string | null; labelId: string; isPrimary?: boolean; }): Promise<...>
  .updateLabel(addrId: string, customerId: string, labelId: string): Promise<ICustomerAddress>
  .setPrimary(addrId: string, customerId: string): Promise<void>
  .remove(addrId: string, customerId: string): Promise<void>

new CustomerEmailModel(store: IStoreAdapter): CustomerEmailModel
  .list(customerId: string): Promise<ICustomerEmail[]>
  .add(opts: { customerId: string; email: string; labelId: string; isPrimary?: boolean; }): Promise<ICustomerEmail>
  .updateLabel(emailId: string, customerId: string, labelId: string): Promise<ICustomerEmail>
  .setPrimary(emailId: string, customerId: string): Promise<void>
  .remove(emailId: string, customerId: string): Promise<void>

new CustomerModel(store: IStoreAdapter): CustomerModel
  .resolveReferralCode(workspaceId: string, code: string): Promise<string | null>
  .list(opts: ListCustomersOpts): Promise<ICustomer[]>
  .findById(id: string, workspaceId: string): Promise<ICustomer | null>
  .findDetail(id: string, workspaceId: string, depth: 2): Promise<ICustomerDetailD2 | null>
  .create(opts: CreateCustomerOpts): Promise<ICustomer>
  .update(id: string, workspaceId: string, opts: UpdateCustomerOpts, referenceCodePrefix?: string): Promise<ICustomer | null>
  .delete(id: string, workspaceId: string): Promise<void>
  .blacklist(id: string, workspaceId: string, reason?: string | null | undefined): Promise<void>
  .unblacklist(id: string, workspaceId: string): Promise<void>

new CustomerNoteModel(store: IStoreAdapter): CustomerNoteModel
  .list(customerId: string): Promise<ICustomerNote[]>
  .create(opts: { customerId: string; authorId?: string | null; body: string; }): Promise<ICustomerNote>
  .update(noteId: string, customerId: string, body: string): Promise<ICustomerNote | null>
  .delete(noteId: string, customerId: string): Promise<void>

new CustomerPhoneModel(store: IStoreAdapter): CustomerPhoneModel
  .list(customerId: string): Promise<ICustomerPhone[]>
  .add(opts: { customerId: string; phone: string; labelId: string; isPrimary?: boolean; }): Promise<ICustomerPhone>
  .updateLabel(phoneId: string, customerId: string, labelId: string): Promise<ICustomerPhone>
  .setPrimary(phoneId: string, customerId: string): Promise<void>
  .remove(phoneId: string, customerId: string): Promise<void>

new CustomerTagModel(store: IStoreAdapter): CustomerTagModel
  .list(customerId: string): Promise<string[]>
  .add(customerId: string, tag: string): Promise<void>
  .remove(customerId: string, tag: string): Promise<void>

new CustomersModule(store: IStoreAdapter, config?: ICustomersConfig, bus?: EventBus | undefined): CustomersModule
  .name: "@fonderie/customers"
  .deps: string[]
  .install(app: IFonderieApp): void

type AddressLabel = 'service' | 'billing' | 'other';

type CustomerType = 'individual' | 'business';

type EmailLabel = 'work' | 'personal' | 'billing';

interface IAddress {
    id: string;
    countryIso: string;
    subdivision1Iso: string | null;
    subdivision2Iso: string | null;
    zipPostalCode: string;
    unit: string | null;
    line1: string | null;
    line2: string | null;
}

interface ICustomer {
    id: string;
    workspaceId: string;
    type: CustomerType;
    sex: CustomerSex;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    avatarUrl: string | null;
    locale: string;
    referenceCode: string | null;
    referralCode: string | null;
    referredBy: string | null;
    isBlacklisted: boolean;
    blacklistReason: string | null;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ICustomerAddress {
    addrId: string;
    customerId: string;
    labelId: string;
    label: string;
    isPrimary: boolean;
    address: IAddress;
}

interface ICustomerDetail extends ICustomer {
    emails: ICustomerEmail[];
    phones: ICustomerPhone[];
    addresses: ICustomerAddress[];
    notes: ICustomerNote[];
    relationships: ICustomerRelationshipExpanded[];
    tags: string[];
}

interface ICustomerEmail {
    id: string;
    customerId: string;
    email: string;
    labelId: string;
    label: string;
    isPrimary: boolean;
    createdAt: string;
}

interface ICustomerNote {
    id: string;
    customerId: string;
    authorId: string | null;
    body: string;
    createdAt: string;
    updatedAt: string;
}

interface ICustomerPhone {
    id: string;
    customerId: string;
    phone: string;
    labelId: string;
    label: string;
    isPrimary: boolean;
    createdAt: string;
}

interface ICustomerTag {
    customerId: string;
    tag: string;
}

type PhoneLabel = 'mobile' | 'office' | 'home' | 'fax';

namespace schemas — exports: addAddressSchema, addEmailSchema, addPhoneSchema, addRelationshipSchema, addTagSchema, blacklistSchema, createCustomerSchema, noteSchema, updateAddressSchema, updateCustomerSchema, updateEmailSchema, updatePhoneSchema
```
