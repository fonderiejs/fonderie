/**
 * `read: false` — the actions only, no list request: for a detail screen that
 * already shows this section from useCustomer() (one request instead of one
 * per section). Writes still refresh everything under /customers.
 */
export interface ICustomerSectionOptions {
	read?: boolean;
}
