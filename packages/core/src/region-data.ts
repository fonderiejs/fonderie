import type { ICountryRules } from './region';

// The country packs Fonderie ships. Data only — add a country by registering a
// pack of the same shape (`regions.register(...)`), not by editing code.

export const CANADA: ICountryRules = {
	code: 'CA',
	names: ['Canada', 'CAN'],
	subdivisionLabel: 'province or territory',
	// Canada is bilingual: the French names are as official as the English ones.
	subdivisions: {
		AB: { name: 'Alberta' },
		BC: { name: 'British Columbia', aliases: ['Colombie-Britannique'] },
		MB: { name: 'Manitoba' },
		NB: { name: 'New Brunswick', aliases: ['Nouveau-Brunswick'] },
		NL: { name: 'Newfoundland and Labrador', aliases: ['Terre-Neuve-et-Labrador'] },
		NS: { name: 'Nova Scotia', aliases: ['Nouvelle-Écosse'] },
		NT: { name: 'Northwest Territories', aliases: ['Territoires du Nord-Ouest'] },
		NU: { name: 'Nunavut' },
		ON: { name: 'Ontario' },
		PE: { name: 'Prince Edward Island', aliases: ['Île-du-Prince-Édouard'] },
		QC: { name: 'Quebec', aliases: ['Québec'] },
		SK: { name: 'Saskatchewan' },
		YT: { name: 'Yukon' },
	},
	postalCode: {
		label: 'postal code',
		pattern: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/,
		format: (c) => `${c.slice(0, 3)} ${c.slice(3)}`,
		example: 'A1A 1A1',
	},
	taxIds: {
		GST_HST: { label: 'GST/HST', pattern: /^\d{9}RT\d{4}$/, example: '123456789RT0001' },
		QST: { label: 'QST', pattern: /^\d{10}TQ\d{4}$/, example: '1234567890TQ0001', region: 'QC' },
		PST: { label: 'PST', regions: ['BC', 'SK', 'MB'] },
		BN: { label: 'Business number', pattern: /^\d{9}$/, example: '123456789' },
	},
};

export const UNITED_STATES: ICountryRules = {
	code: 'US',
	names: ['United States', 'United States of America', 'USA', 'États-Unis', 'Estados Unidos', '美国'],
	subdivisionLabel: 'state',
	subdivisions: Object.fromEntries(
		Object.entries({
			AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
			CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
			HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
			LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
			MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
			NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
			OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
			SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
			VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
			AS: 'American Samoa', GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico',
			VI: 'U.S. Virgin Islands',
		}).map(([code, name]) => [code, { name }]),
	),
	postalCode: {
		label: 'ZIP code',
		pattern: /^\d{5}(\d{4})?$/,
		format: (c) => (c.length === 9 ? `${c.slice(0, 5)}-${c.slice(5)}` : c),
		example: '12345 or 12345-6789',
	},
	taxIds: {
		EIN: { label: 'EIN', pattern: /^\d{9}$/, format: (c) => `${c.slice(0, 2)}-${c.slice(2)}`, example: '12-3456789' },
		// Every state issues its own sales-tax permit, in its own format.
		STATE_SALES_TAX: { label: 'State sales tax permit', regions: [] as string[] },
	},
};
// Any state may issue a sales-tax permit.
UNITED_STATES.taxIds!['STATE_SALES_TAX']!.regions = Object.keys(UNITED_STATES.subdivisions!);
