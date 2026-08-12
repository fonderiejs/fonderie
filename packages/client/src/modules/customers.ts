import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type {
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

export type IUpdateCustomerInput = ICreateCustomerInput;

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
	relationship?: string;
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

	listCustomers(input: IListCustomersInput = {}) {
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
	getCustomer(customerId: string, input: IGetCustomerInput = {}) {
		const qs = input.depth === 1 ? '?depth=1' : '';
		return this.http.request<IApiResponse<ICustomerDetailDTO | ICustomerDetailD2DTO>>({
			method: 'GET',
			path: `/customers/${customerId}${qs}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	updateCustomer(customerId: string, input: IUpdateCustomerInput) {
		return this.http.request<IApiResponse<ICustomerResult>>({
			method: 'PUT',
			path: `/customers/${customerId}`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	deleteCustomer(customerId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${customerId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	blacklistCustomer(customerId: string, input: IBlacklistCustomerInput = {}) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/customers/${customerId}/blacklist`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	unblacklistCustomer(customerId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/customers/${customerId}/unblacklist`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Emails ───────────────────────────────────────────────────────────────────

	listEmails(customerId: string) {
		return this.http.request<IApiResponse<ICustomerEmailListResult>>({
			method: 'GET',
			path: `/customers/${customerId}/emails`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	addEmail(customerId: string, input: IAddEmailInput) {
		return this.http.request<IApiResponse<ICustomerEmailResult>>({
			method: 'POST',
			path: `/customers/${customerId}/emails`,
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
			path: `/customers/${customerId}/emails/${emailId}`,
			body: { label },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	setPrimaryEmail(customerId: string, emailId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'PUT',
			path: `/customers/${customerId}/emails/${emailId}/primary`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeEmail(customerId: string, emailId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${customerId}/emails/${emailId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Phones ───────────────────────────────────────────────────────────────────

	listPhones(customerId: string) {
		return this.http.request<IApiResponse<ICustomerPhoneListResult>>({
			method: 'GET',
			path: `/customers/${customerId}/phones`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	addPhone(customerId: string, input: IAddPhoneInput) {
		return this.http.request<IApiResponse<ICustomerPhoneResult>>({
			method: 'POST',
			path: `/customers/${customerId}/phones`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Only the label is editable — same as updateEmailLabel.
	updatePhoneLabel(customerId: string, phoneId: string, label: string) {
		return this.http.request<IApiResponse<ICustomerPhoneResult>>({
			method: 'PATCH',
			path: `/customers/${customerId}/phones/${phoneId}`,
			body: { label },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	setPrimaryPhone(customerId: string, phoneId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'PUT',
			path: `/customers/${customerId}/phones/${phoneId}/primary`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removePhone(customerId: string, phoneId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${customerId}/phones/${phoneId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Addresses ────────────────────────────────────────────────────────────────

	listAddresses(customerId: string) {
		return this.http.request<IApiResponse<ICustomerAddressListResult>>({
			method: 'GET',
			path: `/customers/${customerId}/addresses`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	addAddress(customerId: string, input: IAddAddressInput) {
		return this.http.request<IApiResponse<ICustomerAddressResult>>({
			method: 'POST',
			path: `/customers/${customerId}/addresses`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// Only the label is editable — same as updateEmailLabel.
	updateAddressLabel(customerId: string, addrId: string, label: string) {
		return this.http.request<IApiResponse<ICustomerAddressResult>>({
			method: 'PATCH',
			path: `/customers/${customerId}/addresses/${addrId}`,
			body: { label },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	setPrimaryAddress(customerId: string, addrId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'PUT',
			path: `/customers/${customerId}/addresses/${addrId}/primary`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeAddress(customerId: string, addrId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${customerId}/addresses/${addrId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Notes ────────────────────────────────────────────────────────────────────

	listNotes(customerId: string) {
		return this.http.request<IApiResponse<ICustomerNoteListResult>>({
			method: 'GET',
			path: `/customers/${customerId}/notes`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	createNote(customerId: string, body: string) {
		return this.http.request<IApiResponse<ICustomerNoteResult>>({
			method: 'POST',
			path: `/customers/${customerId}/notes`,
			body: { body },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	updateNote(customerId: string, noteId: string, body: string) {
		return this.http.request<IApiResponse<ICustomerNoteResult>>({
			method: 'PUT',
			path: `/customers/${customerId}/notes/${noteId}`,
			body: { body },
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	deleteNote(customerId: string, noteId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${customerId}/notes/${noteId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Tags ─────────────────────────────────────────────────────────────────────

	listTags(customerId: string) {
		return this.http.request<IApiResponse<ICustomerTagListResult>>({
			method: 'GET',
			path: `/customers/${customerId}/tags`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	addTag(customerId: string, tag: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'POST',
			path: `/customers/${customerId}/tags`,
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

	listRelationships(customerId: string) {
		return this.http.request<IApiResponse<ICustomerRelationshipListResult>>({
			method: 'GET',
			path: `/customers/${customerId}/relationships`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	addRelationship(customerId: string, input: IAddRelationshipInput) {
		return this.http.request<IApiResponse<ICustomerRelationshipResult>>({
			method: 'POST',
			path: `/customers/${customerId}/relationships`,
			body: input,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	setPrimaryRelationship(customerId: string, relatedId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'PUT',
			path: `/customers/${customerId}/relationships/${relatedId}/primary`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeRelationship(customerId: string, relatedId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/${customerId}/relationships/${relatedId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	// ── Labels ───────────────────────────────────────────────────────────────────
	// Shared vocabulary across all customers in the workspace — labels are
	// looked up/created implicitly by addEmail/addPhone/addAddress's `label`
	// string; these two methods are for managing the vocabulary directly
	// (e.g. an admin screen listing/pruning unused labels).

	listLabels(type: CustomerLabelType) {
		return this.http.request<IApiResponse<ICustomerLabelListResult>>({
			method: 'GET',
			path: `/customers/labels?type=${type}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}

	removeLabel(labelId: string) {
		return this.http.request<IApiResponse<undefined>>({
			method: 'DELETE',
			path: `/customers/labels/${labelId}`,
			token: this.tokens.get(),
			workspaceId: this.workspaceId,
		});
	}
}
