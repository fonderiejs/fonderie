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
	ICustomerLabelDTO,
} from './dtos/customer';
export {
	toAddressDTO,
	toCustomerAddressDTO,
	toCustomerDetailDTO,
	toCustomerDTO,
	toCustomerEmailDTO,
	toCustomerNoteDTO,
	toCustomerPhoneDTO,
	toCustomerLabelDTO,
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
	CustomerType,
	IAddress,
	ICustomer,
	ICustomerAddress,
	ICustomerDetail,
	ICustomerEmail,
	ICustomerNote,
	ICustomerPhone,
} from './types';

// Request validation — enforced contract for body-taking routes; exported
// for docs generation and typed clients.
export * as schemas from './schemas';

// Account erasure (deletion design Phase 4): pass to auth's
// `accountDeletion.erasers`.
export { accountEraser } from './eraser';
export type { ICustomersAccountEraser, ICustomersErasureSubject } from './eraser';

// The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3)
export { CUSTOMER_BIN_RETENTION_DAYS, emptyCustomerBin, listCustomerBin, restoreCustomer } from './models/customer-bin';
export type { IBinnedCustomer, RestoreCustomerOutcome } from './models/customer-bin';
