import {
	AdminClient,
	AuditAdminClient,
	AuthAdminClient,
	BillingAdminClient,
	ConfigAdminClient,
	CourierAdminClient,
	FonderieApiError,
} from '@fonderie/client';
import type { IAdminManifest } from '@fonderie/client';
import { AdminShell } from '@fonderie/react-admin-screens';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// The page is served AT `<prefix>/ui`, so it knows its own prefix without being
// told — which keeps it correct under a basePath and under a moved surface.
const PREFIX = window.location.pathname.replace(/\/ui\/?$/, '');
const KEY = 'fonderie.admin.token';

// sessionStorage, not localStorage: an admin token should not outlive the tab.
const read = (): string => {
	try {
		return window.sessionStorage.getItem(KEY) ?? '';
	} catch {
		return '';
	}
};
const write = (t: string): void => {
	try {
		if (t) window.sessionStorage.setItem(KEY, t);
		else window.sessionStorage.removeItem(KEY);
	} catch {
		/* private mode — the token just lives for this render */
	}
};

// ── Theme switcher ────────────────────────────────────────────────────────
// Copied from the organisation UI's footer control (index.html .theme-switch),
// markup and icons verbatim; its CSS lives in the served shell because the
// selected pill is `:has(input:checked)`.
//
// Three states, and "System" is the absence of `data-theme` rather than a
// resolved snapshot of the OS — so system mode keeps following the OS after a
// sunset switch, and the CSS decides everything. localStorage (not session):
// unlike the token, a display preference should outlive the tab, and it is not
// a secret.
//
// The key is namespaced. The console can be mounted on the same origin as the
// consumer's own app, and the bare `theme` key the organisation UI uses would
// read and write THEIR preference — silently, and only in their app. Same
// argument as the `--fonderie-*` prefix.
type ThemeChoice = 'system' | 'light' | 'dark';
const THEME_KEY = 'fonderie.admin.theme';

const readTheme = (): ThemeChoice => {
	try {
		const v = window.localStorage.getItem(THEME_KEY);
		return v === 'light' || v === 'dark' ? v : 'system';
	} catch {
		return 'system';
	}
};

const applyTheme = (choice: ThemeChoice): void => {
	if (choice === 'system') document.documentElement.removeAttribute('data-theme');
	else document.documentElement.setAttribute('data-theme', choice);
	try {
		if (choice === 'system') window.localStorage.removeItem(THEME_KEY);
		else window.localStorage.setItem(THEME_KEY, choice);
	} catch {
		/* private mode — the choice holds for this page */
	}
};

const ICONS: Record<ThemeChoice, React.ReactElement> = {
	system: (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="2" y="3" width="20" height="14" rx="2" />
			<path d="M8 21h8" />
			<path d="M12 17v4" />
		</svg>
	),
	light: (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2" />
			<path d="M12 20v2" />
			<path d="m4.93 4.93 1.41 1.41" />
			<path d="m17.66 17.66 1.41 1.41" />
			<path d="M2 12h2" />
			<path d="M20 12h2" />
			<path d="m6.34 17.66-1.41 1.41" />
			<path d="m19.07 4.93-1.41 1.41" />
		</svg>
	),
	dark: (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
		</svg>
	),
};

const CHOICES: ReadonlyArray<readonly [ThemeChoice, string]> = [
	['system', 'System'],
	['light', 'Light'],
	['dark', 'Dark'],
];

function ThemeSwitch() {
	const [choice, setChoice] = useState<ThemeChoice>(readTheme);
	return (
		<fieldset className="theme-switch" aria-label="Theme switcher">
			{CHOICES.map(([value, label]) => (
				<label key={value} className="theme-switch__option" data-theme-value={value}>
					<input
						type="radio"
						name="theme"
						value={value}
						checked={choice === value}
						onChange={() => {
							applyTheme(value);
							setChoice(value);
						}}
					/>
					{ICONS[value]}
					<span>{label}</span>
				</label>
			))}
		</fieldset>
	);
}

// The gate is the FIRST thing an operator sees, before any screen loads, so it
// carries the same tokens as everything behind it — a login that looks unlike
// the product it guards is the one place a console cannot afford to look
// improvised. Fallbacks included for the same reason as the screens: these
// values must resolve even if the shell's <style> somehow did not apply.
const T = {
	text: 'var(--fonderie-text,#171717)',
	muted: 'var(--fonderie-text-muted,#5c5c5c)',
	surface: 'var(--fonderie-surface,#fff)',
	border: 'var(--fonderie-border,#e0e0e0)',
	danger: 'var(--fonderie-danger,#e00)',
	radius: 'var(--fonderie-radius,4px)',
	tracking: 'var(--fonderie-tracking-display,-0.05em)',
	shadow: 'var(--fonderie-shadow-card,0 2px 3px 0 rgba(0,0,0,.05))',
};

const styles: Record<string, React.CSSProperties> = {
	// No bottom margin: the switcher sits directly under the form, not 15vh below it.
	gate: { maxWidth: 420, margin: '15vh auto 0', padding: 24, color: T.text },
	h1: { fontSize: 20, fontWeight: 600, marginBottom: 4, letterSpacing: T.tracking },
	p: { color: T.muted, fontSize: 14, marginTop: 0 },
	input: {
		width: '100%',
		padding: '8px 10px',
		border: `1px solid ${T.border}`,
		borderRadius: T.radius,
		fontSize: 14,
		marginTop: 12,
		fontFamily: 'inherit',
		background: T.surface,
		color: T.text,
		boxSizing: 'border-box',
	},
	button: {
		marginTop: 12,
		padding: '8px 14px',
		border: `1px solid ${T.border}`,
		borderRadius: T.radius,
		background: T.surface,
		cursor: 'pointer',
		fontSize: 14,
		fontFamily: 'inherit',
		color: T.text,
		boxShadow: T.shadow,
	},
	err: { color: T.danger, fontSize: 14, marginTop: 12 },
	bar: {
		display: 'flex',
		justifyContent: 'flex-end',
		alignItems: 'center',
		gap: 12,
		padding: '6px 12px',
		borderBottom: `1px solid ${T.border}`,
		background: T.surface,
	},
	// The switcher sits outside the gate's <form>: its radios share the form's
	// namespace otherwise, and a theme choice has no business in a submit.
	gateFoot: { maxWidth: 420, margin: '0 auto', padding: '0 24px', textAlign: 'right' },
};

function Gate({ onToken, error }: { onToken: (t: string) => void; error: string | null }) {
	const [value, setValue] = useState('');
	return (
		<>
			<form
				style={styles.gate}
				onSubmit={(e) => {
					e.preventDefault();
					if (value.trim()) onToken(value.trim());
				}}
			>
				<h1 style={styles.h1}>Admin</h1>
				<p style={styles.p}>
					Paste an admin token. It is kept for this tab only and sent as a Bearer header — never
					stored on the server. A <code>read</code>-scoped token is enough to look around and cannot
					reveal secrets.
				</p>
				<input
					type="password"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder="admin token"
					style={styles.input}
					aria-label="Admin token"
				/>
				{error ? <p style={styles.err}>{error}</p> : null}
				<button type="submit" style={styles.button}>
					Open
				</button>
			</form>
			<div style={styles.gateFoot}>
				<ThemeSwitch />
			</div>
		</>
	);
}

function App() {
	const [token, setToken] = useState(read);
	const [manifest, setManifest] = useState<IAdminManifest | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!token) return;
		let live = true;
		const admin = new AdminClient({
			baseUrl: window.location.origin,
			adminToken: token,
			prefix: PREFIX,
		});
		admin
			.manifest()
			.then(({ result }) => {
				if (!live) return;
				write(token);
				setManifest(result);
				setError(null);
			})
			.catch((err: unknown) => {
				if (!live) return;
				write('');
				setToken('');
				setManifest(null);
				setError(
					err instanceof FonderieApiError && err.status === 401
						? 'That token was refused.'
						: `Could not reach the admin surface: ${err instanceof FonderieApiError ? err.explanation : String(err)}`,
				);
			});
		return () => {
			live = false;
		};
	}, [token]);

	if (!token || !manifest) return <Gate onToken={setToken} error={error} />;

	// Which pages to show is a question the manifest already answers: a brick
	// that mounted nothing has no route here, so its client is never built and
	// the shell hides the page.
	//
	// Probe a path the BRICK ALONE owns. `/config` looked like the obvious probe
	// for @fonderie/config and is exactly wrong: THIS module registers
	// `/_admin/config` itself (the declared-vs-held report), so the probe was
	// true on every deployment. The shell then built a ConfigAdminClient, showed
	// "Config & secrets", and listConfig() fetched /_admin/config successfully —
	// receiving admin's report OBJECT where it expected an ARRAY of entries.
	// `entries.map(...)` threw "a.map is not a function" and the page died,
	// while /_admin/secrets (which only the config brick serves) 404'd beside it.
	// A 200 with the wrong shape is worse than a 404: nothing reports it.
	//
	// So the config probe below is '/secrets', which ONLY @fonderie/config
	// serves. Any future probe needs the same test: does this module register
	// the path itself?
	const mounted = new Set(manifest.routes.map((r) => r.path));
	const has = (suffix: string) => mounted.has(`${PREFIX}${suffix}`);
	const opts = { baseUrl: window.location.origin, adminToken: token, prefix: PREFIX };

	return (
		<>
			<div style={styles.bar}>
				<button
					type="button"
					style={{ ...styles.button, marginTop: 0 }}
					onClick={() => {
						write('');
						setToken('');
						setManifest(null);
					}}
				>
					Forget token
				</button>
			</div>
			<AdminShell
				client={new AdminClient(opts)}
				{...(has('/secrets') ? { configClient: new ConfigAdminClient(opts) } : {})}
				{...(has('/templates') ? { courierClient: new CourierAdminClient(opts) } : {})}
				{...(has('/users') ? { authClient: new AuthAdminClient(opts) } : {})}
				{...(has('/catalog') ? { billingClient: new BillingAdminClient(opts) } : {})}
				{...(has('/audit') ? { auditClient: new AuditAdminClient(opts) } : {})}
			/>
		</>
	);
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
