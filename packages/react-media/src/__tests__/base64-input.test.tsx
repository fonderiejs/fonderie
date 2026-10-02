import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useUploadAvatar } from '../hooks';
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

// React Native pickers return base64; turning their file URI into a Blob
// there can hand the server bytes that are not the image. So the hooks take
// base64 directly.

test('toBase64: raw base64 passes through; a data: URL loses its prefix; line breaks go', async () => {
	assert.equal(await toBase64({ base64: 'iVBORw0KGgo=' }), 'iVBORw0KGgo=');
	assert.equal(await toBase64({ base64: 'data:image/jpeg;base64,/9j/4AAQ\nSkZJRg==' }), '/9j/4AAQSkZJRg==');
});

test('toBase64: a Blob still works (browsers)', async () => {
	const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
	assert.equal(await toBase64(blob), 'iVBORw==');
});

test('toBase64: nothing to upload is an error, not an empty request', async () => {
	await assert.rejects(() => toBase64({ base64: '' }), /Nothing to upload/);
	await assert.rejects(() => toBase64({} as never), /Nothing to upload/);
});

test('useUploadAvatar sends picker base64 as-is and sets the avatar', async () => {
	const sent: string[] = [];
	const client = {
		auth: {
			getUser: async () => ({ result: { user: { profileImageUrl: '' } } }),
			updateProfile: async () => ({}),
		},
		media: {
			upload: async (input: { dataBase64: string }) => {
				sent.push(input.dataBase64);
				return { result: { asset: { id: 'a1' } } };
			},
			assetUrl: (id: string) => `https://api.acme.example/v1/media/${id}`,
			assetIdFromUrl: () => null,
			delete: async () => undefined,
		},
	} as unknown as FonderieClient;
	let hook!: ReturnType<typeof useUploadAvatar>;
	function Probe() {
		hook = useUploadAvatar();
		return null;
	}
	renderToString(createElement(FonderieProvider, { client }, createElement(Probe)));
	const url = await hook.uploadAvatar({ base64: '/9j/4AAQSkZJRg==' });
	assert.deepEqual(sent, ['/9j/4AAQSkZJRg==']);
	assert.equal(url, 'https://api.acme.example/v1/media/a1');
});
