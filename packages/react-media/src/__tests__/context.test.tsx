import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FonderieClient, MediaClient } from '@fonderie/client';
import { FonderieProvider } from '@fonderie/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { useDeleteMedia, useUploadAvatar, useUploadMedia } from '../hooks';

const fakeMedia = { marker: 'context-media' } as unknown as MediaClient;
// useUploadAvatar resolves the whole client (media + auth), so give it both.
const fakeClient = { media: fakeMedia, auth: {} } as unknown as FonderieClient;

function Probe({ run }: { run: () => void }) {
	run();
	return null;
}

function renderWithProvider(run: () => void) {
	return renderToString(
		createElement(FonderieProvider, { client: fakeClient }, createElement(Probe, { run })),
	);
}

test('media hooks resolve from context with their action + idle shape', () => {
	let upload!: ReturnType<typeof useUploadMedia>;
	let avatar!: ReturnType<typeof useUploadAvatar>;
	let del!: ReturnType<typeof useDeleteMedia>;
	renderWithProvider(() => {
		upload = useUploadMedia();
		avatar = useUploadAvatar();
		del = useDeleteMedia();
	});

	assert.equal(typeof upload.upload, 'function');
	assert.equal(upload.isUploading, false);
	assert.equal(upload.error, null);

	assert.equal(typeof avatar.uploadAvatar, 'function');
	assert.equal(avatar.isUploading, false);
	assert.equal(avatar.error, null);

	assert.equal(typeof del.remove, 'function');
	assert.equal(del.isDeleting, false);
	assert.equal(del.error, null);
});

test('an explicit sub-client bypasses context', () => {
	const explicit = { marker: 'explicit-media' } as unknown as MediaClient;
	// No provider at all — the explicit first argument must be enough.
	renderToString(
		createElement(Probe, {
			run: () => {
				const { upload } = useUploadMedia(explicit);
				assert.equal(typeof upload, 'function');
			},
		}),
	);
});

test('hooks throw a named error without provider or argument', () => {
	assert.throws(
		() =>
			renderToString(
				createElement(Probe, {
					run: () => {
						useUploadMedia();
					},
				}),
			),
		/useUploadMedia: no client/,
	);
});
