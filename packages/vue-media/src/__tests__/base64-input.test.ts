import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { toBase64 } from '../lib/mediaInput';

// Node has no FileReader (browsers and React Native do): a minimal one, enough
// for blobToBase64's readAsDataURL.
(globalThis as { FileReader?: unknown }).FileReader ??= class {
	result: string | null = null;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	readAsDataURL(blob: Blob) {
		void blob.arrayBuffer().then((buf) => {
			this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
			this.onload?.();
		});
	}
};

// Same contract as @fonderie/react-media: base64 in, raw base64 out.
test('toBase64: raw, data: URL and line-wrapped base64', async () => {
	assert.equal(await toBase64({ base64: 'iVBORw0KGgo=' }), 'iVBORw0KGgo=');
	assert.equal(await toBase64({ base64: 'data:image/jpeg;base64,/9j/4AAQ\nSkZJRg==' }), '/9j/4AAQSkZJRg==');
});

test('toBase64: a Blob still works', async () => {
	const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
	assert.equal(await toBase64(blob), 'iVBORw==');
});

test('toBase64: nothing to upload is an error', async () => {
	await assert.rejects(() => toBase64({ base64: '' }), /Nothing to upload/);
});
