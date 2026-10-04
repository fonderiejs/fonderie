import { canonicalLocaleTag } from './ui-i18n/resolve';

// The language the app's UI is in (a BCP 47 tag, e.g. 'fr-CA'), observable —
// what the prebuilt screens read to pick their words, and what requests carry
// as Accept-Language. One per FonderieClient, shared by its sub-clients: a
// screen handed only `client.auth` still finds it (uiLocaleFor), the same way
// every sub-client finds the client's one query store.
export class UiLocale {
	private tag: string;
	private readonly listeners = new Set<(tag: string) => void>();

	constructor(initial?: string) {
		this.tag = canonicalLocaleTag(initial) ?? detectDeviceLocale();
	}

	get(): string {
		return this.tag;
	}

	/** Sets the language; an invalid tag is ignored. Notifies only on change. */
	set(tag: string): void {
		const next = canonicalLocaleTag(tag);
		if (!next || next === this.tag) return;
		this.tag = next;
		for (const listener of [...this.listeners]) {
			try {
				listener(next);
			} catch {
				// A listener's failure must not stop the others.
			}
		}
	}

	/** Returns the unsubscribe. */
	on(listener: (tag: string) => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}
}

/**
 * The device's language: the browser's first preference, else what Intl
 * reports (React Native / Node), else en-US.
 */
export function detectDeviceLocale(): string {
	const nav = (globalThis as { navigator?: { languages?: readonly string[]; language?: string } }).navigator;
	for (const tag of [...(nav?.languages ?? []), nav?.language]) {
		const c = canonicalLocaleTag(tag);
		if (c) return c;
	}
	try {
		return canonicalLocaleTag(Intl.DateTimeFormat().resolvedOptions().locale) ?? 'en-US';
	} catch {
		return 'en-US';
	}
}

const registry = new WeakMap<object, UiLocale>();

export function registerUiLocale(owner: object, locale: UiLocale): void {
	registry.set(owner, locale);
}

/** The UI language source of a client or any of its sub-clients; undefined for one nobody registered. */
export function uiLocaleFor(owner: object | undefined): UiLocale | undefined {
	return owner ? registry.get(owner) : undefined;
}
