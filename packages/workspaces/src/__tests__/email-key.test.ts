import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEmailSafe } from '@fonderie/auth';

import { emailKey, sameEmail } from '../services/email-key';

// Invitations must match addresses exactly the way accounts are stored, or an
// invite to 'ana+crew@' is never Ana's account 'ana@'. This brick keeps its
// own copy of the rule (auth is not a runtime dependency) — so pin it to auth's.
const CORPUS = [
	'  User+Test@Email.com ', 'ana@acme.example', 'ana+crew+2@acme.example', 'A.Na@Acme.Example',
	'', '   ', 'no-at', 'a@b@c', '@acme.example', 'ana@', '+tag@acme.example', 'x+@acme.example',
];

test("emailKey is auth's normalizeEmail, address for address", () => {
	for (const email of CORPUS) assert.equal(emailKey(email), normalizeEmailSafe(email), JSON.stringify(email));
});

test('sameEmail: an alias and its base are one account; different people, dots and invalid input are not', () => {
	assert.equal(sameEmail('Ana+Crew@Acme.example', 'ana@acme.example'), true);
	assert.equal(sameEmail('ana@acme.example', 'anna@acme.example'), false);
	assert.equal(sameEmail('a.na@acme.example', 'ana@acme.example'), false);
	assert.equal(sameEmail(null, 'ana@acme.example'), false);
	assert.equal(sameEmail('no-at', 'no-at'), false);
});
