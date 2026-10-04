import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';

import { Dispatcher } from '../dispatcher';
import { applyFormats } from '../format';
import { DBTemplateResolver, DefaultTemplates } from '../templates/resolver';
import type { ICourierMessage } from '../types';

// What a reader gets, end to end through the dispatcher and the real resolver:
// the script they read (zh-TW → Traditional, zh-CN → Simplified) and amounts
// written their way (19,99 $ for fr-CA) — billing used to format every amount
// as en-US before anyone knew who would read it.

const RECEIPT = {
	receipt: {
		subject: 'Receipt',
		text: 'Paid {{amountPaidDisplay}}',
		locales: {
			fr: { subject: 'Reçu', text: 'Payé {{amountPaidDisplay}}' },
			'zh-Hans': { subject: '收据', text: '已支付 {{amountPaidDisplay}}' },
			'zh-Hant': { subject: '收據', text: '已付款 {{amountPaidDisplay}}' },
		},
	},
};

// No saved templates: the built-in copy decides.
let accountLocale: string | null = null;
const store = {
	query: async (sql: string) =>
		sql.includes('INSERT INTO fonderie_message_log')
			? [{ id: 'log-1' }]
			: sql.includes('FROM fonderie_users') && accountLocale
				? [{ locale: accountLocale }]
				: [],
	transaction: async (fn: (tx: unknown) => unknown) => fn(store),
} as unknown as IStoreAdapter;

async function render(locale: string | undefined): Promise<{ subject?: string; text: string }> {
	const sent: Array<{ subject?: string; text: string }> = [];
	const d = new Dispatcher({ channels: { receipt: ['email'] } }, new DBTemplateResolver(store, new DefaultTemplates([RECEIPT])), store);
	d.registerChannel({ name: 'email', async send(_m, t) { sent.push(t as { subject?: string; text: string }); } });
	await d.dispatch({
		type: 'receipt',
		...(locale ? { locale } : {}),
		recipient: { email: 'a@client.example', phone: null, deviceToken: null },
		data: { amountPaidDisplay: 'CA$19.99', $format: { amountPaidDisplay: { money: { amount: '1999', currency: 'CAD', precision: 2 } } } },
	} as ICourierMessage);
	return sent[0]!;
}

test('a Chinese reader gets their script; a Canadian reader gets their dollar', async () => {
	assert.deepEqual(await render('zh-TW'), { subject: '收據', text: '已付款 CA$19.99', locale: 'zh-Hant' });
	assert.deepEqual(await render('zh-HK'), { subject: '收據', text: '已付款 CA$19.99', locale: 'zh-Hant' });
	assert.deepEqual(await render('zh-CN'), { subject: '收据', text: '已支付 CA$19.99', locale: 'zh-Hans' });
	assert.deepEqual(await render('zh'), { subject: '收据', text: '已支付 CA$19.99', locale: 'zh-Hans' });
	const fr = await render('fr-CA');
	assert.equal(fr.subject, 'Reçu');
	assert.equal(fr.text.replace(/\s/g, ' '), 'Payé 19,99 $');
	assert.equal((await render('en-CA')).text, 'Paid $19.99', 'an English-Canadian reader sees $, not CA$');
});

test("no language on the message: the amount follows the recipient's account language too", async () => {
	accountLocale = 'fr-CA';
	try {
		const r = await render(undefined);
		assert.equal(r.subject, 'Reçu');
		assert.equal(r.text.replace(/\s/g, ' '), 'Payé 19,99 $');
	} finally {
		accountLocale = null;
	}
});

test('formats: money in any currency or none, dates, and nothing breaks on bad input', () => {
	const out = applyFormats(
		{
			a: 'x', b: 'x', c: 'x', d: 'kept', untouched: 'same',
			$format: {
				a: { money: { amount: '123456', currency: 'USD', precision: 2 } },
				b: { money: { amount: '500', currency: 'CREDITS', precision: 0 } },
				c: { date: '2026-10-04T12:00:00Z' },
				d: { money: { amount: 'not-a-number', currency: 'CAD', precision: 2 } },
			},
		},
		'fr-CA',
	);
	assert.equal(String(out['a']).replace(/\s/g, ' '), '1 234,56 $ US');
	assert.equal(out['b'], '500 CREDITS');
	assert.equal(out['c'], '4 octobre 2026');
	assert.equal(out['d'], 'kept', "the sender's string stays when a value can't be formatted");
	assert.equal(out['untouched'], 'same');
	assert.equal('$format' in out, false);
	assert.deepEqual(applyFormats({ plain: 'x' }, 'fr-CA'), { plain: 'x' });
});
