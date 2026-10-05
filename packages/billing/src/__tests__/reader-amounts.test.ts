import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildReceiptData } from '../services/receipt';
import { localizedAmounts } from '../utils';

// Amounts used to reach courier only as en-US strings ("CA$19.99"), formatted
// before anyone knew who would read them. Each notice now also carries the raw
// amount under core's `$format`, which courier writes in the reader's language
// — while the string stays for a courier that predates it.

test("a receipt carries each amount raw for courier, and keeps the string for an older courier", () => {
	const data = buildReceiptData({
		packId: 'p100', packName: '100 credits', credits: 100n, creditCurrency: 'CREDITS', precision: 0,
		balanceAfter: 250n, amountPaid: 1999n, paymentCurrency: 'cad', source: 'checkout',
	});
	assert.equal(data['amountPaidDisplay'], 'CA$19.99');
	assert.deepEqual(data['$format'], {
		creditsDisplay: { money: { amount: '100', currency: 'CREDITS', precision: 0 } },
		balanceAfterDisplay: { money: { amount: '250', currency: 'CREDITS', precision: 0 } },
		amountPaidDisplay: { money: { amount: '1999', currency: 'CAD', precision: 2 } },
	});
});

test('no amount paid (a grant): nothing to format for it', () => {
	const data = buildReceiptData({ packId: 'g', credits: 5n, creditCurrency: 'USD', precision: 2, balanceAfter: 5n, source: 'grant' });
	assert.equal('amountPaidDisplay' in (data['$format'] as object), false);
});

test('localizedAmounts survives JSON (the outbox / event bus serializes it)', () => {
	const v = localizedAmounts({ x: { amount: 12345678901234567890n, currency: 'usd', precision: 2 } });
	assert.deepEqual(JSON.parse(JSON.stringify(v)), { $format: { x: { money: { amount: '12345678901234567890', currency: 'USD', precision: 2 } } } });
});
