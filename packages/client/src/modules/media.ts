import type { HttpClient } from '../http';
import type { TokenStore } from '../token-store';
import type { IApiResponse, IMediaAssetResult } from '../types';

// ── Input shapes ─────────────────────────────────────────────────────────────

// Upload an image. `dataBase64` is the RAW base64 payload (no `data:` prefix) —
// the server sniffs the real type from magic bytes, enforces the byte cap, and
// rejects SVG (stored-XSS). `purpose` groups assets (e.g. 'avatar'); ownerType
// /ownerId default server-side to the calling user, so a plain avatar upload
// needs only `dataBase64`.
export interface IUploadMediaInput {
	dataBase64: string;
	purpose?: string;
	ownerType?: string;
	ownerId?: string;
}

// ── Media client ─────────────────────────────────────────────────────────────
// Session-authenticated (shares FonderieClient's TokenStore, like auth). NOT
// workspace-scoped: @fonderie/media keys ownership off ownerType/ownerId in the
// body, not an X-Workspace-ID header.

export class MediaClient {
	constructor(
		private http: HttpClient,
		private tokens: TokenStore,
	) {}

	setAccessToken(token: string | undefined) {
		this.tokens.set(token);
	}

	// POST /media — store an image; returns the asset with its monomorphic
	// /media/:id url. requireAuth server-side.
	upload(input: IUploadMediaInput) {
		return this.http.request<IApiResponse<IMediaAssetResult>>({
			method: 'POST',
			path: '/media',
			body: input,
			token: this.tokens.get(),
		});
	}

	// DELETE /media/:id — uploader-only (403 for anyone else).
	delete(id: string) {
		return this.http.request<IApiResponse<{ id: string }>>({
			method: 'DELETE',
			path: `/media/${encodeURIComponent(id)}`,
			token: this.tokens.get(),
		});
	}

	// Absolute URL for a stored asset — an `<img src>` target. The GET /media/:id
	// route is public and cached (it can't carry a Bearer token), so turn an
	// upload's `asset.id` into a browser-loadable URL with this, and use it as
	// the avatarUrl handed to auth's updateProfile.
	assetUrl(id: string): string {
		return this.http.absolute(`/media/${encodeURIComponent(id)}`);
	}

	// Inverse of assetUrl: pull the asset id out of one of THIS brick's
	// /media/:id URLs (absolute or relative); null for empty/external URLs. Lets
	// avatar cleanup delete only assets we minted (matched as a UUID), never a
	// placeholder or third-party avatar URL.
	assetIdFromUrl(url: string | null | undefined): string | null {
		if (!url) return null;
		const m = url.match(
			/\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i,
		);
		return m ? m[1]! : null;
	}
}
