// Optional blocks: {{#key}}…{{/key}}
//
// Without them a template cannot omit anything, and some fields are genuinely
// ABSENT rather than empty — an invoice number exists only when the charge went
// through an invoice. The alternatives were a dangling "Invoice " with nothing
// after it, or an anchor with an empty href that looks like a link and does
// nothing. Both are worse than saying less.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFragment } from '../templates/resolver';

const frag = (html: string) => ({ subject: 's', text: 't', html });
const out = (html: string, data: Record<string, unknown>) =>
	renderFragment(frag(html), '{{content}}', data).html ?? '';

test('a present value renders the block, and interpolates inside it', () => {
	const html = out('<p>{{#invoiceNumber}}Invoice {{invoiceNumber}}{{/invoiceNumber}}</p>', {
		invoiceNumber: 'A1-0007',
	});
	assert.match(html, /Invoice A1-0007/);
});

test('an absent value removes the block entirely, not just the variable', () => {
	// The actual bug: without sections this left "Invoice " on the page.
	for (const value of [undefined, null, '', '   ']) {
		const html = out('<p>{{#invoiceNumber}}Invoice {{invoiceNumber}}{{/invoiceNumber}}</p>', {
			invoiceNumber: value,
		});
		assert.doesNotMatch(html, /Invoice/, `${JSON.stringify(value)} must render nothing`);
	}
});

test('an anchor inside an absent block does not survive as a dead link', () => {
	// An <a href=""> looks clickable and does nothing — worse than no link.
	const html = out('{{#pdf}}<a href="{{pdf}}">Download</a>{{/pdf}}', { pdf: '' });
	assert.doesNotMatch(html, /<a /, 'no anchor may remain');
	assert.doesNotMatch(html, /Download/);
});

test('content outside the block is untouched either way', () => {
	const tpl = '<p>Total {{total}}</p>{{#ref}}<p>Ref {{ref}}</p>{{/ref}}';
	assert.match(out(tpl, { total: '$9', ref: '' }), /Total \$9/);
	assert.match(out(tpl, { total: '$9', ref: 'X' }), /Total \$9/);
});

test('values inside a section are still HTML-escaped', () => {
	// Sections must not become an escaping bypass.
	const html = out('{{#name}}<p>{{name}}</p>{{/name}}', { name: '<script>x</script>' });
	assert.doesNotMatch(html, /<script>x<\/script>/);
	assert.match(html, /&lt;script&gt;/);
});

test('templates with no sections are unaffected', () => {
	// Every existing template must render exactly as before.
	const html = out('<p>Hello {{name}}</p>', { name: 'Ada' });
	assert.match(html, /Hello Ada/);
});
