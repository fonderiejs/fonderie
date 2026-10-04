---
'@fonderie/core': minor
'@fonderie/workspaces': minor
'@fonderie/customers': minor
'@fonderie/client': minor
'@fonderie/react': patch
'@fonderie/react-customers': minor
'@fonderie/vue-customers': minor
---

A business profile fit for Canada and the US, and customers that are safe to delete and speak their own language.

**Country rules as data: `@fonderie/core/region`.** One registry decides what a valid province, postal code or tax number is, per country. Fonderie ships Canada (English and French names: Québec, Colombie-Britannique…; `A1A 1A1`; GST/HST, QST, PST, BN) and the United States (states and territories; ZIP and ZIP+4; EIN, state sales-tax permits). An app adds any other country with `regions.register({ code: 'MX', … })`. A country without a pack is stored as given, never judged by another country's rules.

**Business profile (`PUT /workspaces`)**: `legalName`, `email`, `website`, `logoUrl`, `taxRegistrations` (`{ country, type, number, region?, label? }`, checked and normalized against the country, e.g. `123 456 789 rt 0001` → `123456789RT0001`), and `languages`, the languages the business serves customers in (`['en-CA', 'fr-CA', 'zh-Hant']`). The address is normalized (`Canada`/`Québec`/`h2x1y4` → `CA`/`QC`/`H2X 1Y4`). `businessType` is now one of `SOLE_PROP`, `PARTNERSHIP`, `LLC`, `INC`, `NONPROFIT`, `COOPERATIVE`. Settings check `locale` (BCP 47, canonical), `currency` (ISO 4217) and `timezone` (IANA). Every refusal is a 422 naming the field. Migration `workspaces/005`.

**Customers**
- **Language**: `locale` is validated and canonical, and defaults to the business's own (workspace settings) instead of `en-US`. `displayName` writes the name in the customer's language's order: `王小明` for Chinese, Japanese and Korean, `Marie Tremblay` otherwise, the company name for a business.
- **Archive** (`POST /customers/:id/archive|unarchive`, `archiveCustomer`): hidden from lists and pickers, still readable by id for the documents that name them. Lists exclude archived customers unless `archived: true | 'all'`. Migration `customers/014`.
- **Safe delete**: one transaction. A customer still referenced (a database foreign key, or the new `isInUse(customerId, workspaceId)` config hook) is refused with `409 CUSTOMER_IN_USE` and loses nothing. Before, its emails, phones and notes were deleted first and the customer then survived without them.
- **Search** also matches any email, and any phone by digits (`514 555` finds `+1 (514) 555-0100`). The count always describes the same rows.
- **Primaries can't be lost**: setting a primary email, phone, address or relationship with an id that isn't this customer's now answers 404 and keeps the current primary. Before, it cleared every primary.
- **Relationships**: the expanded relationship now has `relatedId` (the related customer) and `relationshipId`. `id`/`customerId` stay as deprecated aliases; `id` was the relationship's id, which apps read as the customer's.
- Addresses use the same country rules.

**Hooks**
- `useCustomer()` gains `deleteCustomer`/`archiveCustomer`/`unarchiveCustomer`; `useCustomers()` gains `archiveCustomer`/`unarchiveCustomer`.
- Section hooks take `{ read: false }` for their actions only, so a detail screen makes one request instead of one per section.
- `@fonderie/react`: refreshing a disabled query no longer fetches it. A write made through a hook told not to read, or still waiting for an id, used to request that hook's list anyway.
