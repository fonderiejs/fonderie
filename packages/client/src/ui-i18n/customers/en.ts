// The prebuilt customers screens' words (React, React Native and Vue share them).
// English is canonical: the other languages are typed against this shape, so
// a missing or extra key is a compile error. `{name}` placeholders are
// interpolated; a11y.* are screen-reader labels and hints (React Native, and
// web buttons that show only a symbol).
const customers = {
	loading: 'Loading…',
	fields: {
		firstName: 'First name',
		lastName: 'Last name',
		company: 'Company',
		companyOptional: 'Company (optional)',
	},
	list: {
		title: 'Customers',
		searchPlaceholder: 'Search customers…',
		create: 'Add customer',
		blacklisted: 'Blacklisted',
		a11y: {
			search: 'Search customers',
			firstName: 'First name input',
			lastName: 'Last name input',
			company: 'Company input',
			create: 'Add customer button',
			openCustomer: 'Open {name}',
			openCustomerHint: "Shows this customer's details",
		},
	},
	detail: {
		title: 'Customer',
		save: 'Save',
		emails: 'Emails',
		phones: 'Phones',
		tags: 'Tags',
		notes: 'Notes',
		primary: 'primary',
		withPrimary: '{value} (primary)',
		makePrimary: 'Make primary',
		remove: 'Remove',
		add: 'Add',
		delete: 'Delete',
		emailPlaceholder: 'new@example.com',
		phonePlaceholder: '+1 555 0100',
		tagPlaceholder: 'new tag',
		notePlaceholder: 'Add a note…',
		backToList: 'Back to customers',
		a11y: {
			firstName: 'First name input',
			lastName: 'Last name input',
			company: 'Company input',
			save: 'Save customer button',
			newEmail: 'New email input',
			newPhone: 'New phone input',
			newTag: 'New tag input',
			newNote: 'New note input',
			addEmail: 'Add email',
			addPhone: 'Add phone',
			addTag: 'Add tag',
			addNote: 'Add note',
			makePrimaryEmail: 'Make {value} the primary email',
			makePrimaryPhone: 'Make {value} the primary phone',
			removeEmail: 'Remove email {value}',
			removePhone: 'Remove phone {value}',
			removeTag: 'Remove tag {tag}',
			deleteNote: 'Delete note',
			backToList: 'Back to customers',
		},
	},
};

export default customers;
