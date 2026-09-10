import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
	IReadOptions,
	CustomerLabelType,
	CustomerSex,
	CustomerType,
	IApiResponse,
	ICustomerAddressListResult,
	ICustomerAddressResult,
	ICustomerDetailD2DTO,
	ICustomerDetailDTO,
	ICustomerEmailListResult,
	ICustomerEmailResult,
	ICustomerLabelListResult,
	ICustomerListResult,
	ICustomerNoteListResult,
	ICustomerNoteResult,
	ICustomerPhoneListResult,
	ICustomerPhoneResult,
	ICustomerRelationshipListResult,
	ICustomerRelationshipResult,
	ICustomerResult,
	ICustomerTagListResult,
} from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────────

export interface IListCustomersInput {
	search?: string;
	blacklisted?: boolean;
	limit?: number;
	offset?: number;
}

export interface IGetCustomerInput {
	depth?: 1 | 2;
}

export interface ICreateCustomerInput {
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

// Referral codes are create-time only — the server's update path never
// writes them, so including them here made updateCustomer({ referralCode })
// a type-correct 200-OK silent no-op.
export type IUpdateCustomerInput = Omit<ICreateCustomerInput, 'referralCode' | 'referredByCode'>;

export interface IBlacklistCustomerInput {
	reason?: string;
}

export interface IAddEmailInput {
	email: string;
	label?: string;
	isPrimary?: boolean;
}

export interface IAddPhoneInput {
	phone: string;
	label?: string;
	isPrimary?: boolean;
}

export interface IAddAddressInput {
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

export interface IAddRelationshipInput {
	relatedId: string;
	// Required — the server rejects relationship-less links with a 422.
	relationship: string;
	isPrimary?: boolean;
}

// ── Customers client ─────────────────────────────────────────────────────────

export class CustomersClient {
	private workspaceId: string | undefined;

	constructor(
		private http: HttpClient,
		private tokens: TokenStore,
	) {}

	setAccessToken(token: string | undefined) {
		this.tokens.set(token);
	}

	// Scopes every request to this workspace (X-Workspace-ID). Falls back to
	// the caller's personal workspace when unset, same as billing/workspaces/audit/webhooks.
	setWorkspaceId(workspaceId: string | undefined) {
		this.workspaceId = workspaceId;
	}

	// ── Core customer CRUD ───────────────────────────────────────────────────────

	listCustomers(input: IListCustomersInput = {}, opts?: IReadOptions) {
		const params = new URLSearchParams();
		if (input.search !== undefined) params.set('search', input.search);
		if (input.blacklisted !== undefined) params.set('blacklisted', String(input.blacklisted));
		if (input.limit !== undefined) params.set('limit', String(input.limit));
		if (input.offset !== undefined) params.set('offset', String(input.offset));
		const qs = params.toString();

		return this.http.request<IApiResponse<ICustomerListResult>>({
			method: 'GET',
			path: qs ? `/customers?${qs}` : '/customers',
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	createCustomer(input: ICreateCustomerInput = {}) {
		return this.http.request<IApiResponse<ICustomerResult>>({
			method: 'POST',
			path: '/customers',
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// depth defaults to 2 server-side; pass { depth: 1 } for one level of
	// relationship expansion instead of the D2 (nested-relationships) shape.
	getCustomer(customerId: string, input: IGetCustomerInput = {}, opts?: IReadOptions) {
		const qs = input.depth === 1 ? '?depth=1' : '';
		return this.http.request<IApiResponse<ICustomerDetailDTO | ICustomerDetailD2DTO>>({
			method: 'GET',
			path: `/customers/${encodeURIComponent(customerId)}${qs}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	updateCustomer(customerId: string, input: IUpdateCustomerInput) {
		return this.http.request<IApiResponse<ICustomerResult>>({
			method: 'PUT',
			path: `/customers/${encodeURIComponent(customerId)}`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	deleteCustomer(customerId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${encodeURIComponent(customerId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	blacklistCustomer(customerId: string, input: IBlacklistCustomerInput = {}) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/customers/${encodeURIComponent(customerId)}/blacklist`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	unblacklistCustomer(customerId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/customers/${encodeURIComponent(customerId)}/unblacklist`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Emails ───────────────────────────────────────────────────────────────────

	listEmails(customerId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<ICustomerEmailListResult>>({
			method: 'GET',
			path: `/customers/${encodeURIComponent(customerId)}/emails`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	addEmail(customerId: string, input: IAddEmailInput) {
		return this.http.request<IApiResponse<ICustomerEmailResult>>({
			method: 'POST',
			path: `/customers/${encodeURIComponent(customerId)}/emails`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Only the label is editable — email addresses themselves are immutable
	// once added; remove and re-add to change the address.
	updateEmailLabel(customerId: string, emailId: string, label: string) {
		return this.http.request<IApiResponse<ICustomerEmailResult>>({
			method: 'PATCH',
			path: `/customers/${encodeURIComponent(customerId)}/emails/${encodeURIComponent(emailId)}`,
			body: { label },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	setPrimaryEmail(customerId: string, emailId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'PUT',
			path: `/customers/${encodeURIComponent(customerId)}/emails/${encodeURIComponent(emailId)}/primary`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeEmail(customerId: string, emailId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${encodeURIComponent(customerId)}/emails/${encodeURIComponent(emailId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Phones ───────────────────────────────────────────────────────────────────

	listPhones(customerId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<ICustomerPhoneListResult>>({
			method: 'GET',
			path: `/customers/${encodeURIComponent(customerId)}/phones`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	addPhone(customerId: string, input: IAddPhoneInput) {
		return this.http.request<IApiResponse<ICustomerPhoneResult>>({
			method: 'POST',
			path: `/customers/${encodeURIComponent(customerId)}/phones`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Only the label is editable — same as updateEmailLabel.
	updatePhoneLabel(customerId: string, phoneId: string, label: string) {
		return this.http.request<IApiResponse<ICustomerPhoneResult>>({
			method: 'PATCH',
			path: `/customers/${encodeURIComponent(customerId)}/phones/${encodeURIComponent(phoneId)}`,
			body: { label },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	setPrimaryPhone(customerId: string, phoneId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'PUT',
			path: `/customers/${encodeURIComponent(customerId)}/phones/${encodeURIComponent(phoneId)}/primary`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removePhone(customerId: string, phoneId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${encodeURIComponent(customerId)}/phones/${encodeURIComponent(phoneId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Addresses ────────────────────────────────────────────────────────────────

	listAddresses(customerId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<ICustomerAddressListResult>>({
			method: 'GET',
			path: `/customers/${encodeURIComponent(customerId)}/addresses`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	addAddress(customerId: string, input: IAddAddressInput) {
		return this.http.request<IApiResponse<ICustomerAddressResult>>({
			method: 'POST',
			path: `/customers/${encodeURIComponent(customerId)}/addresses`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Only the label is editable — same as updateEmailLabel.
	updateAddressLabel(customerId: string, addrId: string, label: string) {
		return this.http.request<IApiResponse<ICustomerAddressResult>>({
			method: 'PATCH',
			path: `/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addrId)}`,
			body: { label },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	setPrimaryAddress(customerId: string, addrId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'PUT',
			path: `/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addrId)}/primary`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeAddress(customerId: string, addrId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addrId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Notes ────────────────────────────────────────────────────────────────────

	listNotes(customerId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<ICustomerNoteListResult>>({
			method: 'GET',
			path: `/customers/${encodeURIComponent(customerId)}/notes`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	createNote(customerId: string, body: string) {
		return this.http.request<IApiResponse<ICustomerNoteResult>>({
			method: 'POST',
			path: `/customers/${encodeURIComponent(customerId)}/notes`,
			body: { body },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	updateNote(customerId: string, noteId: string, body: string) {
		return this.http.request<IApiResponse<ICustomerNoteResult>>({
			method: 'PUT',
			path: `/customers/${encodeURIComponent(customerId)}/notes/${encodeURIComponent(noteId)}`,
			body: { body },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	deleteNote(customerId: string, noteId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${encodeURIComponent(customerId)}/notes/${encodeURIComponent(noteId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Tags ─────────────────────────────────────────────────────────────────────

	listTags(customerId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<ICustomerTagListResult>>({
			method: 'GET',
			path: `/customers/${encodeURIComponent(customerId)}/tags`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	addTag(customerId: string, tag: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/customers/${encodeURIComponent(customerId)}/tags`,
			body: { tag },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeTag(customerId: string, tag: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${customerId}/tags/${encodeURIComponent(tag)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Relationships ────────────────────────────────────────────────────────────

	listRelationships(customerId: string, opts?: IReadOptions) {
		return this.http.request<IApiResponse<ICustomerRelationshipListResult>>({
			method: 'GET',
			path: `/customers/${encodeURIComponent(customerId)}/relationships`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	addRelationship(customerId: string, input: IAddRelationshipInput) {
		return this.http.request<IApiResponse<ICustomerRelationshipResult>>({
			method: 'POST',
			path: `/customers/${encodeURIComponent(customerId)}/relationships`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	setPrimaryRelationship(customerId: string, relatedId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'PUT',
			path: `/customers/${encodeURIComponent(customerId)}/relationships/${encodeURIComponent(relatedId)}/primary`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeRelationship(customerId: string, relatedId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${encodeURIComponent(customerId)}/relationships/${encodeURIComponent(relatedId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Labels ───────────────────────────────────────────────────────────────────
	// Shared vocabulary across all customers in the workspace — labels are
	// looked up/created implicitly by addEmail/addPhone/addAddress's `label`
	// string; these two methods are for managing the vocabulary directly
	// (e.g. an admin screen listing/pruning unused labels).

	listLabels(type: CustomerLabelType, opts?: IReadOptions) {
		return this.http.request<IApiResponse<ICustomerLabelListResult>>({
			method: 'GET',
			path: `/customers/labels?type=${encodeURIComponent(type)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
			bust: opts?.bust,
		});
	}

	removeLabel(labelId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/labels/${encodeURIComponent(labelId)}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}
}
