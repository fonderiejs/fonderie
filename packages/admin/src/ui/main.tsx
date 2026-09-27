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
import { type AdminPage, AdminShell } from '@fonderie/react-admin-screens';
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
	radiusLg: 'var(--fonderie-radius-lg,8px)',
	tracking: 'var(--fonderie-tracking-display,-0.05em)',
	shadow: 'var(--fonderie-shadow-card,0 2px 3px 0 rgba(0,0,0,.05))',
};

const styles: Record<string, React.CSSProperties> = {
	page: {
		minHeight: '100vh',
		display: 'grid',
		placeItems: 'center',
		padding: 16,
		boxSizing: 'border-box',
	},
	gate: {
		width: '100%',
		maxWidth: 400,
		boxSizing: 'border-box',
		padding: 28,
		color: T.text,
		background: T.surface,
		border: `1px solid ${T.border}`,
		borderRadius: 12,
		boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 12px 32px -12px rgba(0,0,0,.12)',
	},
	mark: {
		width: 36,
		height: 36,
		borderRadius: 9,
		background: T.text,
		color: T.surface,
		display: 'grid',
		placeItems: 'center',
		marginBottom: 18,
	},
	h1: {
		fontSize: 20,
		fontWeight: 600,
		margin: '0 0 6px',
		letterSpacing: T.tracking,
		lineHeight: 1.25,
	},
	p: { color: T.muted, fontSize: 13.5, margin: 0, lineHeight: 1.55 },
	label: { display: 'block', fontSize: 13, fontWeight: 500, margin: '20px 0 6px' },
	input: {
		width: '100%',
		height: 38,
		padding: '0 12px',
		border: `1px solid ${T.border}`,
		borderRadius: 8,
		fontSize: 14,
		fontFamily: 'inherit',
		background: T.surface,
		color: T.text,
		boxSizing: 'border-box',
	},
	primary: {
		width: '100%',
		height: 38,
		marginTop: 12,
		border: `1px solid ${T.text}`,
		borderRadius: 8,
		background: T.text,
		color: T.surface,
		cursor: 'pointer',
		fontSize: 14,
		fontWeight: 600,
		fontFamily: 'inherit',
	},
	button: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		width: '100%',
		height: 32,
		border: `1px solid ${T.border}`,
		borderRadius: 6,
		background: T.surface,
		cursor: 'pointer',
		fontSize: 13,
		fontWeight: 500,
		fontFamily: 'inherit',
		color: T.text,
	},
	err: {
		color: T.danger,
		fontSize: 13,
		marginTop: 10,
		padding: '8px 10px',
		borderRadius: 6,
		background: 'color-mix(in srgb, var(--fonderie-danger,#e00) 8%, transparent)',
	},
	foot: { color: T.muted, fontSize: 12, marginTop: 16, lineHeight: 1.5 },
	// Bottom-right, fixed, over the gate only. On the dashboard the switcher
	// lives in the sidebar footer with the sign-out: both are session settings,
	// not navigation, and docking them there removes two floating controls
	// that sat over the content.
	themeDock: {
		position: 'fixed',
		right: 16,
		bottom: 16,
		zIndex: 10,
		borderRadius: 9999,
		boxShadow: T.shadow,
	},
};

const LOGOUT = (
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<path d="m16 17 5-5-5-5" />
		<path d="M21 12H9" />
	</svg>
);

function Gate({ onToken, error }: { onToken: (t: string) => void; error: string | null }) {
	const [value, setValue] = useState('');
	return (
		<div style={styles.page}>
			<form
				style={styles.gate}
				onSubmit={(e) => {
					e.preventDefault();
					if (value.trim()) onToken(value.trim());
				}}
			>
				<div style={styles.mark}>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" />
						<path d="M7 11V7a5 5 0 0 1 10 0v4" />
					</svg>
				</div>
				<h1 style={styles.h1}>Sign in to Admin</h1>
				<p style={styles.p}>{window.location.hostname}</p>
				<label htmlFor="admin-token" style={styles.label}>
					Admin token
				</label>
				<input
					id="admin-token"
					type="password"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder="Paste your token"
					style={styles.input}
					autoComplete="off"
					// biome-ignore lint/a11y/noAutofocus: the gate has one field; focusing it is the whole task.
					autoFocus
				/>
				{error ? (
					<p style={styles.err} role="alert">
						{error}
					</p>
				) : null}
				<button type="submit" style={styles.primary}>
					Continue
				</button>
				<p style={styles.foot}>
					Kept for this tab only and sent as a Bearer header — never stored on the server. A{' '}
					<code>read</code>-scoped token is enough to look around and cannot reveal secrets.
				</p>
			</form>
		</div>
	);
}

// Page ↔ URL hash, so a reload, a bookmark or the back button lands where the
// operator was. A hash (not a path) because the surface is served from one
// route under any prefix — a path would need the server to know every page.
const PAGES: ReadonlySet<string> = new Set([
	'attention',
	'modules',
	'environment',
	'doctor',
	'routes',
	'users',
	'catalog',
	'subscriber',
	'settings',
	'templates',
	'audit',
	'log',
	'tokens',
	'migrations',
]);
const pageFromHash = (): AdminPage => {
	const h = window.location.hash.replace(/^#\/?/, '');
	return (PAGES.has(h) ? h : 'attention') as AdminPage;
};

function useHashPage(): [AdminPage, (p: AdminPage) => void] {
	const [page, setPage] = useState<AdminPage>(pageFromHash);
	useEffect(() => {
		const on = () => setPage(pageFromHash());
		window.addEventListener('hashchange', on);
		return () => window.removeEventListener('hashchange', on);
	}, []);
	return [
		page,
		(p) => {
			if (p !== pageFromHash()) window.location.hash = `/${p}`;
			setPage(p);
		},
	];
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

	const forget = () => {
		write('');
		setToken('');
		setManifest(null);
	};

	if (!token || !manifest) {
		// The switcher is present on the gate too: it is the one screen an
		// operator sees before they can do anything else.
		return (
			<>
				<Gate onToken={setToken} error={error} />
				<div style={styles.themeDock}>
					<ThemeSwitch />
				</div>
			</>
		);
	}
	return <Dashboard token={token} manifest={manifest} onForget={forget} />;
}

function Dashboard({
	token,
	manifest,
	onForget,
}: {
	token: string;
	manifest: IAdminManifest;
	onForget: () => void;
}) {
	const [page, setPage] = useHashPage();
	// Which pages to show is a question the manifest already answers: a brick
	// that mounted nothing has no route here, so its client is never built and
	// the shell hides the page.
	//
	// Probe a path the BRICK ALONE owns.
	//
	// `/config` was the obvious probe for @fonderie/config and was exactly wrong:
	// this module used to register `/_admin/config` itself, as the declared-vs-held
	// report. The probe was therefore true on EVERY deployment. The shell built a
	// ConfigAdminClient, showed "Config & secrets", and listConfig() fetched
	// /_admin/config successfully — receiving admin's report OBJECT where it
	// expected an ARRAY of entries. `entries.map(...)` threw "a.map is not a
	// function" and the page died, while /_admin/secrets 404'd beside it. A 200
	// with the wrong shape is worse than a 404: nothing reports it.
	//
	// That report now lives at `/_admin/environment`, which is what it always
	// was, so `/config` is no longer ambiguous. `/secrets` is kept as the probe
	// anyway: it is the narrower claim, and a probe should not depend on a route
	// this module could plausibly want back one day.
	const mounted = new Set(manifest.routes.map((r) => r.path));
	const has = (suffix: string) => mounted.has(`${PREFIX}${suffix}`);
	const opts = { baseUrl: window.location.origin, adminToken: token, prefix: PREFIX };

	return (
		<AdminShell
			client={new AdminClient(opts)}
			page={page}
			onNavigate={setPage}
			appName={window.location.hostname || 'Admin'}
			envLabel={manifest.env}
			footer={
				<>
					<ThemeSwitch />
					<button type="button" style={styles.button} onClick={onForget}>
						{LOGOUT}
						Forget token
					</button>
				</>
			}
			{...(has('/secrets') ? { configClient: new ConfigAdminClient(opts) } : {})}
			{...(has('/templates') ? { courierClient: new CourierAdminClient(opts) } : {})}
			{...(has('/users') ? { authClient: new AuthAdminClient(opts) } : {})}
			{...(has('/catalog') ? { billingClient: new BillingAdminClient(opts) } : {})}
			{...(has('/audit') ? { auditClient: new AuditAdminClient(opts) } : {})}
		/>
	);
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
