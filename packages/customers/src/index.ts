export type { CustomersEventKey, ICustomersConfig } from './config';
export { EVENT_KEYS } from './config';
export type {
	IAddressDTO,
	ICustomerAddressDTO,
	ICustomerDetailDTO,
	ICustomerDTO,
	ICustomerEmailDTO,
	ICustomerNoteDTO,
	ICustomerPhoneDTO,
	ICustomerTagDTO,
} from './dtos/customer';
export {
	toAddressDTO,
	toCustomerAddressDTO,
	toCustomerDetailDTO,
	toCustomerDTO,
	toCustomerEmailDTO,
	toCustomerNoteDTO,
	toCustomerPhoneDTO,
	toCustomerTagDTO,
} from './dtos/customer';
export {
	CustomerAddressModel,
	CustomerEmailModel,
	CustomerModel,
	CustomerNoteModel,
	CustomerPhoneModel,
	CustomerTagModel,
} from './models';
export { CustomersModule } from './module';
export type {
	AddressLabel,
	CustomerType,
	EmailLabel,
	IAddress,
	ICustomer,
	ICustomerAddress,
	ICustomerDetail,
	ICustomerEmail,
	ICustomerNote,
	ICustomerPhone,
	ICustomerTag,
	PhoneLabel,
} from './types';

// Request validation — enforced contract for body-taking routes; exported
// for docs generation and typed clients.
export * as schemas from './schemas';
