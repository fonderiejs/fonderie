import {
	AdminClient,
	AuditAdminClient,
	AuthAdminClient,
	BillingAdminClient,
	ConfigAdminClient,
	CourierAdminClient,
	FonderieApiError,
} from '@fonderie/client';
import type { IAdminEnrollment, IAdminManifest, IAdminSession } from '@fonderie/client';
import { useAdminSession } from '@fonderie/react-admin';
import { type AdminPage, AdminShell } from '@fonderie/react-admin-screens';
import qrcode from 'qrcode-generator';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
	link: {
		background: 'none',
		border: 'none',
		padding: 0,
		color: T.text,
		textDecoration: 'underline',
		cursor: 'pointer',
		fontSize: 12,
		fontFamily: 'inherit',
	},
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
	'operators',
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

function TokenApp() {
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
	return (
		<Dashboard
			token={token}
			manifest={manifest}
			footer={
				<>
					<ThemeSwitch />
					<button type="button" style={styles.button} onClick={forget}>
						{LOGOUT}
						Forget token
					</button>
				</>
			}
		/>
	);
}

function Dashboard({
	token,
	manifest,
	footer,
	operators = false,
	me,
}: {
	// Empty in operator mode: the session cookie authenticates every request.
	token: string;
	manifest: IAdminManifest;
	footer: ReactNode;
	operators?: boolean;
	me?: string | undefined;
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
	// The app's public config route, taken from the route table so it is right
	// under any basePath: frontends' view of config, shown on the Config page.
	const publicConfigPath = manifest.routes.find(
		(r) => r.method === 'GET' && r.path.endsWith('/config/public'),
	)?.path;
	const has = (suffix: string) => mounted.has(`${PREFIX}${suffix}`);
	const opts = { baseUrl: window.location.origin, adminToken: token, prefix: PREFIX };

	return (
		<AdminShell
			client={new AdminClient(opts)}
			page={page}
			onNavigate={setPage}
			appName={window.location.hostname || 'Admin'}
			envLabel={manifest.env}
			{...(publicConfigPath
				? { publicConfigUrl: `${window.location.origin}${publicConfigPath}` }
				: {})}
			operators={operators}
			{...(me ? { currentOperator: me } : {})}
			footer={footer}
			{...(has('/secrets') ? { configClient: new ConfigAdminClient(opts) } : {})}
			{...(has('/templates') ? { courierClient: new CourierAdminClient(opts) } : {})}
			{...(has('/users') ? { authClient: new AuthAdminClient(opts) } : {})}
			{...(has('/catalog') ? { billingClient: new BillingAdminClient(opts) } : {})}
			{...(has('/audit') ? { auditClient: new AuditAdminClient(opts) } : {})}
		/>
	);
}

// ═══ Operator mode ═══════════════════════════════════════════════════════
// People sign in with email, password and an authenticator app. The session
// is an HttpOnly cookie: nothing on this page can read it, and nothing here
// stores a credential. A deployment without operators (no store) keeps the
// token gate above.

const cookieClient = new AdminClient({ baseUrl: window.location.origin, prefix: PREFIX });

// ── the step-up prompt ───────────────────────────────────────────────────
// Any request the server refuses with STEP_UP_REQUIRED (revealing a secret,
// minting a token or link, applying a migration, deleting) pauses here: the
// prompt asks for a fresh code, and on success the ORIGINAL request is sent
// again. Screens need no idea this exists. A 401 on a guarded route means the
// session ended (idle or revoked), so the page drops back to sign-in.
let askForCode: (() => Promise<boolean>) | null = null;
let onSessionEnded: (() => void) | null = null;
const rawFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
	const res = await rawFetch(input, init);
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
	if (!url.includes(PREFIX) || url.includes(`${PREFIX}/session`)) return res;
	if (res.status === 401 && onSessionEnded) {
		onSessionEnded();
		return res;
	}
	if (res.status !== 403 || !askForCode) return res;
	const body = (await res
		.clone()
		.json()
		.catch(() => null)) as { reason?: string } | null;
	if (body?.reason !== 'STEP_UP_REQUIRED') return res;
	return (await askForCode()) ? rawFetch(input, init) : res;
};

const errText = (err: unknown): string =>
	err instanceof FonderieApiError ? err.explanation : 'Something went wrong. Try again.';

type Steps = { labels: readonly string[]; at: number };

// First-time setup is an onboarding flow, not a login: a progress bar across
// the screens it spans (claim: token → account → authenticator → backup
// codes; invite and recovery: the last three).
function StepBar({ labels, at }: Steps) {
	return (
		<ol
			aria-label={`Step ${at + 1} of ${labels.length}`}
			style={{ display: 'flex', gap: 6, listStyle: 'none', padding: 0, margin: '0 0 22px' }}
		>
			{labels.map((label, i) => (
				<li
					key={label}
					style={{ flex: 1, minWidth: 0 }}
					aria-current={i === at ? 'step' : undefined}
				>
					<div style={{ height: 3, borderRadius: 2, background: i <= at ? T.text : T.border }} />
					<div
						style={{
							fontSize: 11,
							marginTop: 6,
							color: i === at ? T.text : T.muted,
							fontWeight: i === at ? 600 : 400,
							whiteSpace: 'nowrap',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
						}}
					>
						{label}
					</div>
				</li>
			))}
		</ol>
	);
}

const CLAIM_STEPS = ['Admin token', 'Your account', 'Authenticator', 'Backup codes'] as const;
const INVITE_STEPS = ['Your account', 'Authenticator', 'Backup codes'] as const;
const RECOVERY_STEPS = ['New password', 'Authenticator', 'Backup codes'] as const;
type Flow = 'claim' | 'invite' | 'recovery';
const STEPS_OF: Record<Flow, readonly string[]> = {
	claim: CLAIM_STEPS,
	invite: INVITE_STEPS,
	recovery: RECOVERY_STEPS,
};
/** Where the authenticator and backup-code screens sit in a flow. */
const stepsFor = (flow: Flow | null, name: 'Authenticator' | 'Backup codes'): Steps | undefined =>
	flow ? { labels: STEPS_OF[flow], at: STEPS_OF[flow].indexOf(name) } : undefined;

function AuthCard({
	icon,
	title,
	subtitle,
	steps,
	children,
}: {
	icon?: ReactNode;
	title: string;
	subtitle?: ReactNode;
	steps?: Steps | undefined;
	children: ReactNode;
}) {
	return (
		<div style={styles.page}>
			<div style={styles.gate}>
				{steps ? <StepBar {...steps} /> : null}
				<div style={styles.mark}>{icon ?? LOCK}</div>
				<h1 style={styles.h1}>{title}</h1>
				{subtitle ? <p style={styles.p}>{subtitle}</p> : null}
				{children}
			</div>
		</div>
	);
}

const LOCK = (
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
);
const SHIELD = (
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
		<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
		<path d="m9 12 2 2 4-4" />
	</svg>
);

function Field({
	label,
	id,
	...rest
}: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
	return (
		<>
			<label htmlFor={id} style={styles.label}>
				{label}
			</label>
			<input id={id} style={styles.input} {...rest} />
		</>
	);
}

function useSubmit() {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		setError(null);
		try {
			await fn();
		} catch (err) {
			setError(errText(err));
		} finally {
			setBusy(false);
		}
	};
	return { busy, error, run };
}

const ErrorLine = ({ error }: { error: string | null }) =>
	error ? (
		<p style={styles.err} role="alert">
			{error}
		</p>
	) : null;

// First sign-in: the admin token from the deployment's configuration, alone —
// the credential the operator already has. Only once it is accepted does the
// page ask for the account it creates. Checked against the server first, so a
// mistyped token fails on the token screen, not after filling in a form.
function ClaimForm({ onDone }: { onDone: (s: IAdminSession) => void }) {
	const [token, setToken] = useState('');
	const [accepted, setAccepted] = useState<string | null>(null);
	const [f, setF] = useState({ email: '', name: '', password: '', confirm: '' });
	const { busy, error, run } = useSubmit();

	if (!accepted) {
		return (
			<AuthCard
				steps={{ labels: CLAIM_STEPS, at: 0 }}
				title="Welcome — let's set up your console"
				subtitle={`This is the first sign-in on ${window.location.hostname}. Paste the admin token from your deployment's configuration to begin. It is needed only this once.`}
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void run(async () => {
							const root = new AdminClient({
								baseUrl: window.location.origin,
								prefix: PREFIX,
								adminToken: token.trim(),
							});
							try {
								await root.manifest();
							} catch (err) {
								if (err instanceof FonderieApiError && err.status === 401) {
									throw new FonderieApiError('UNAUTHORIZED', 'That token was refused.', 401);
								}
								throw err;
							}
							setAccepted(token.trim());
						});
					}}
				>
					<Field
						id="fa-root"
						label="Admin token"
						type="password"
						autoComplete="off"
						required
						autoFocus
						value={token}
						onChange={(e) => setToken(e.target.value)}
					/>
					<ErrorLine error={error} />
					<button type="submit" style={styles.primary} disabled={busy}>
						{busy ? 'Checking…' : 'Continue'}
					</button>
				</form>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			steps={{ labels: CLAIM_STEPS, at: 1 }}
			title="Create your account"
			subtitle="From now on you sign in with this email and password, plus an authenticator app. The admin token stays for scripts and emergencies."
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (f.password !== f.confirm) {
						void run(async () =>
							Promise.reject(
								new FonderieApiError('MISMATCH', 'The two passwords do not match.', 422),
							),
						);
						return;
					}
					void run(async () => {
						const root = new AdminClient({
							baseUrl: window.location.origin,
							prefix: PREFIX,
							adminToken: accepted,
						});
						const { result } = await root.claim({
							email: f.email,
							password: f.password,
							...(f.name ? { name: f.name } : {}),
						});
						onDone(result);
					});
				}}
			>
				<Field
					id="fa-email"
					label="Email"
					type="email"
					autoComplete="username"
					required
					autoFocus
					value={f.email}
					onChange={(e) => setF({ ...f, email: e.target.value })}
				/>
				<Field
					id="fa-name"
					label="Name (optional)"
					autoComplete="name"
					value={f.name}
					onChange={(e) => setF({ ...f, name: e.target.value })}
				/>
				<Field
					id="fa-password"
					label="Password"
					type="password"
					autoComplete="new-password"
					required
					minLength={12}
					value={f.password}
					onChange={(e) => setF({ ...f, password: e.target.value })}
				/>
				<Field
					id="fa-confirm"
					label="Confirm password"
					type="password"
					autoComplete="new-password"
					required
					value={f.confirm}
					onChange={(e) => setF({ ...f, confirm: e.target.value })}
				/>
				<p style={styles.foot}>
					At least 12 characters. You will set up an authenticator app next.
				</p>
				<ErrorLine error={error} />
				<button type="submit" style={styles.primary} disabled={busy}>
					{busy ? 'Creating…' : 'Create account'}
				</button>
			</form>
		</AuthCard>
	);
}

function LoginForm({ onDone }: { onDone: (s: IAdminSession) => void }) {
	const [f, setF] = useState({ email: '', password: '' });
	const { busy, error, run } = useSubmit();
	return (
		<AuthCard title="Sign in to Admin" subtitle={window.location.hostname}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void run(async () => onDone((await cookieClient.login(f)).result));
				}}
			>
				<Field
					id="fa-email"
					label="Email"
					type="email"
					autoComplete="username"
					required
					autoFocus
					value={f.email}
					onChange={(e) => setF({ ...f, email: e.target.value })}
				/>
				<Field
					id="fa-password"
					label="Password"
					type="password"
					autoComplete="current-password"
					required
					value={f.password}
					onChange={(e) => setF({ ...f, password: e.target.value })}
				/>
				<ErrorLine error={error} />
				<button type="submit" style={styles.primary} disabled={busy}>
					{busy ? 'Checking…' : 'Continue'}
				</button>
				<p style={styles.foot}>
					There is no sign-up. Operators are invited by another operator. Locked out? Ask another
					operator for a recovery link.
				</p>
			</form>
		</AuthCard>
	);
}

/** Six digits, or a backup code when the phone is not at hand. */
function CodeForm({
	title,
	subtitle,
	submitLabel,
	onSubmit,
	onCancel,
}: {
	title: string;
	subtitle: ReactNode;
	submitLabel: string;
	onSubmit: (factor: { code: string } | { backupCode: string }) => Promise<unknown>;
	onCancel?: () => void;
}) {
	const [backup, setBackup] = useState(false);
	const [value, setValue] = useState('');
	const { busy, error, run } = useSubmit();
	return (
		<AuthCard icon={SHIELD} title={title} subtitle={subtitle}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void run(() =>
						onSubmit(backup ? { backupCode: value } : { code: value.replace(/\s/g, '') }),
					);
				}}
			>
				<Field
					id="fa-code"
					label={backup ? 'Backup code' : 'Authenticator code'}
					inputMode={backup ? 'text' : 'numeric'}
					autoComplete="one-time-code"
					placeholder={backup ? 'ABCDE-FGHIJ' : '123 456'}
					required
					autoFocus
					value={value}
					onChange={(e) => setValue(e.target.value)}
					style={{
						...styles.input,
						fontFamily: 'var(--fonderie-mono,monospace)',
						letterSpacing: backup ? 1 : 4,
						fontSize: 18,
					}}
				/>
				<ErrorLine error={error} />
				<button type="submit" style={styles.primary} disabled={busy}>
					{busy ? 'Checking…' : submitLabel}
				</button>
				<p style={styles.foot}>
					<button
						type="button"
						style={styles.link}
						onClick={() => {
							setBackup(!backup);
							setValue('');
						}}
					>
						{backup ? 'Use the authenticator app instead' : 'Use a backup code instead'}
					</button>
					{onCancel ? (
						<>
							{' · '}
							<button type="button" style={styles.link} onClick={onCancel}>
								Cancel
							</button>
						</>
					) : null}
				</p>
			</form>
		</AuthCard>
	);
}

function EnrollForm({
	onDone,
	onCancel,
	steps,
}: {
	onDone: (s: IAdminSession) => void;
	onCancel: () => void;
	steps?: Steps | undefined;
}) {
	const [enrollment, setEnrollment] = useState<IAdminEnrollment | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showKey, setShowKey] = useState(false);
	useEffect(() => {
		cookieClient
			.enrollment()
			.then(({ result }) => setEnrollment(result))
			.catch((err) => setError(errText(err)));
	}, []);
	const qr = useMemo(() => {
		if (!enrollment) return null;
		const q = qrcode(0, 'M');
		q.addData(enrollment.uri);
		q.make();
		return q.createDataURL(5, 4);
	}, [enrollment]);
	return (
		<AuthCard
			icon={SHIELD}
			steps={steps}
			title="Set up your authenticator"
			subtitle="Every sign-in to this console needs a code from an authenticator app — 1Password, Google Authenticator, Authy, or any TOTP app."
		>
			{error ? <ErrorLine error={error} /> : null}
			{enrollment && qr ? (
				<>
					<ol style={{ ...styles.p, paddingLeft: 18, margin: '16px 0 0' }}>
						<li>Open your authenticator app and scan this code.</li>
						<li>Enter the six digits it shows.</li>
					</ol>
					<div style={{ display: 'grid', placeItems: 'center', margin: '16px 0 8px' }}>
						<img
							src={qr}
							alt="QR code for your authenticator app"
							width={200}
							height={200}
							style={{
								imageRendering: 'pixelated',
								borderRadius: 8,
								background: '#fff',
								padding: 6,
								border: `1px solid ${T.border}`,
							}}
						/>
					</div>
					<p style={{ ...styles.foot, textAlign: 'center', marginTop: 4 }}>
						{showKey ? (
							<code style={{ wordBreak: 'break-all', fontSize: 13 }}>
								{enrollment.secret.replace(/(.{4})/g, '$1 ').trim()}
							</code>
						) : (
							<button type="button" style={styles.link} onClick={() => setShowKey(true)}>
								Can't scan? Enter a setup key instead
							</button>
						)}
					</p>
					<ConfirmCode onDone={onDone} />
				</>
			) : !error ? (
				<p style={styles.p}>Preparing…</p>
			) : null}
			<p style={styles.foot}>
				<button type="button" style={styles.link} onClick={onCancel}>
					Cancel and sign out
				</button>
			</p>
		</AuthCard>
	);
}

function ConfirmCode({ onDone }: { onDone: (s: IAdminSession) => void }) {
	const [code, setCode] = useState('');
	const { busy, error, run } = useSubmit();
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				void run(async () =>
					onDone((await cookieClient.confirmEnrollment(code.replace(/\s/g, ''))).result),
				);
			}}
		>
			<Field
				id="fa-code"
				label="Code from the app"
				inputMode="numeric"
				autoComplete="one-time-code"
				placeholder="123 456"
				required
				value={code}
				onChange={(e) => setCode(e.target.value)}
				style={{
					...styles.input,
					fontFamily: 'var(--fonderie-mono,monospace)',
					letterSpacing: 4,
					fontSize: 18,
				}}
			/>
			<ErrorLine error={error} />
			<button type="submit" style={styles.primary} disabled={busy}>
				{busy ? 'Checking…' : 'Verify and continue'}
			</button>
		</form>
	);
}

function BackupCodes({
	codes,
	onDone,
	steps,
}: {
	codes: string[];
	onDone: () => void;
	steps?: Steps | undefined;
}) {
	const [saved, setSaved] = useState(false);
	const text = `Backup codes for ${window.location.hostname} admin\n${codes.join('\n')}\n`;
	return (
		<AuthCard
			icon={SHIELD}
			steps={steps}
			title="Save your backup codes"
			subtitle="If you lose your phone, each of these signs you in once. They are shown only now."
		>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gap: '6px 16px',
					margin: '16px 0',
					padding: 14,
					borderRadius: 8,
					border: `1px solid ${T.border}`,
					fontFamily: 'var(--fonderie-mono,monospace)',
					fontSize: 14,
					letterSpacing: 0.5,
				}}
			>
				{codes.map((c) => (
					<span key={c}>{c}</span>
				))}
			</div>
			<div style={{ display: 'flex', gap: 8 }}>
				<button
					type="button"
					style={styles.button}
					onClick={() => void navigator.clipboard?.writeText(text)}
				>
					Copy
				</button>
				<a
					href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
					download={`admin-backup-codes-${window.location.hostname}.txt`}
					style={{ ...styles.button, textDecoration: 'none' }}
				>
					Download
				</a>
			</div>
			<label style={{ ...styles.p, display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
				<input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I have
				saved these codes somewhere safe
			</label>
			<button type="button" style={styles.primary} disabled={!saved} onClick={onDone}>
				Open the console
			</button>
		</AuthCard>
	);
}

function LinkForm({
	token,
	onDone,
	onKind,
}: {
	token: string;
	onDone: (s: IAdminSession) => void;
	onKind: (kind: Flow) => void;
}) {
	const [link, setLink] = useState<{ kind: 'invite' | 'recovery'; email: string } | null>(null);
	const [bad, setBad] = useState<string | null>(null);
	const [f, setF] = useState({ name: '', password: '', confirm: '' });
	const { busy, error, run } = useSubmit();
	useEffect(() => {
		cookieClient
			.inspectLink(token)
			.then(({ result }) => {
				setLink(result);
				onKind(result.kind);
			})
			.catch((err) => setBad(errText(err)));
	}, [token, onKind]);
	if (bad)
		return (
			<AuthCard title="This link cannot be used" subtitle={bad}>
				{null}
			</AuthCard>
		);
	if (!link) return <AuthCard title="Checking your link…">{null}</AuthCard>;
	const invite = link.kind === 'invite';
	return (
		<AuthCard
			steps={{ labels: invite ? INVITE_STEPS : RECOVERY_STEPS, at: 0 }}
			title={invite ? 'Join the admin console' : 'Recover your account'}
			subtitle={
				invite
					? `You were invited as ${link.email}. Choose a password, then set up an authenticator app.`
					: `Set a new password for ${link.email}. You will set up your authenticator again.`
			}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (f.password !== f.confirm)
						return void run(async () =>
							Promise.reject(
								new FonderieApiError('MISMATCH', 'The two passwords do not match.', 422),
							),
						);
					void run(async () => {
						const { result } = await cookieClient.redeemLink({
							token,
							password: f.password,
							...(invite && f.name ? { name: f.name } : {}),
						});
						window.history.replaceState(null, '', window.location.pathname);
						onDone(result);
					});
				}}
			>
				<input type="email" autoComplete="username" value={link.email} readOnly hidden />
				{invite ? (
					<Field
						id="fa-name"
						label="Your name (optional)"
						autoComplete="name"
						value={f.name}
						onChange={(e) => setF({ ...f, name: e.target.value })}
					/>
				) : null}
				<Field
					id="fa-password"
					label="New password"
					type="password"
					autoComplete="new-password"
					required
					minLength={12}
					value={f.password}
					onChange={(e) => setF({ ...f, password: e.target.value })}
				/>
				<Field
					id="fa-confirm"
					label="Confirm password"
					type="password"
					autoComplete="new-password"
					required
					value={f.confirm}
					onChange={(e) => setF({ ...f, confirm: e.target.value })}
				/>
				<p style={styles.foot}>At least 12 characters.</p>
				<ErrorLine error={error} />
				<button type="submit" style={styles.primary} disabled={busy}>
					{busy ? 'Saving…' : 'Continue'}
				</button>
			</form>
		</AuthCard>
	);
}

function StepUpPrompt() {
	const [open, setOpen] = useState(false);
	const resolver = useRef<((ok: boolean) => void) | null>(null);
	useEffect(() => {
		askForCode = () =>
			new Promise<boolean>((resolve) => {
				resolver.current = resolve;
				setOpen(true);
			});
		return () => {
			askForCode = null;
		};
	}, []);
	const finish = (ok: boolean) => {
		setOpen(false);
		resolver.current?.(ok);
		resolver.current = null;
	};
	if (!open) return null;
	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Confirm it's you"
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 50,
				background: 'rgba(0,0,0,.45)',
				display: 'grid',
				placeItems: 'center',
			}}
		>
			<div style={{ width: '100%', maxWidth: 440 }}>
				<CodeForm
					title="Confirm it's you"
					subtitle="This action needs a fresh code. It covers the next five minutes."
					submitLabel="Confirm"
					onSubmit={async (factor) => {
						await cookieClient.stepUp(factor);
						finish(true);
					}}
					onCancel={() => finish(false)}
				/>
			</div>
		</div>
	);
}

function OperatorApp() {
	const { session, refresh, logout } = useAdminSession(cookieClient);
	const [override, setOverride] = useState<IAdminSession | null>(null);
	const [codes, setCodes] = useState<string[] | null>(null);
	// The onboarding flow the person is in, so the authenticator and backup-code
	// screens keep showing where they are. null for an ordinary sign-in.
	const [flow, setFlow] = useState<Flow | null>(null);
	const [manifest, setManifest] = useState<IAdminManifest | null>(null);
	const current = override ?? session;
	const linkToken = /^#\/link\/(.+)$/.exec(window.location.hash)?.[1] ?? null;

	const next = (s: IAdminSession) => {
		if (s.backupCodes?.length) setCodes(s.backupCodes);
		setOverride(s);
	};
	const signOut = async () => {
		await logout().catch(() => undefined);
		setOverride({ state: 'signed-out', operator: null, claimable: false });
		setManifest(null);
	};

	useEffect(() => {
		onSessionEnded = () => {
			setOverride(null);
			setManifest(null);
			void refresh();
		};
		return () => {
			onSessionEnded = null;
		};
	}, [refresh]);

	useEffect(() => {
		if (current?.state !== 'signed-in' || codes) return;
		cookieClient
			.manifest()
			.then(({ result }) => setManifest(result))
			.catch(() => undefined);
	}, [current?.state, codes]);

	const dock = (
		<div style={styles.themeDock}>
			<ThemeSwitch />
		</div>
	);
	if (!current) return dock;

	let screen: ReactNode;
	if (codes)
		screen = (
			<BackupCodes
				codes={codes}
				steps={stepsFor(flow, 'Backup codes')}
				onDone={() => {
					setCodes(null);
					setFlow(null);
				}}
			/>
		);
	else if (current.state === 'signed-in') {
		if (!manifest) return dock;
		const op = current.operator;
		return (
			<>
				<StepUpPrompt />
				<Dashboard
					token=""
					manifest={manifest}
					operators
					me={op?.email}
					footer={
						<>
							{op ? (
								<div style={{ fontSize: 12.5, lineHeight: 1.35, minWidth: 0 }}>
									<div
										style={{
											fontWeight: 600,
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{op.name || op.email}
									</div>
									{op.name ? (
										<div
											style={{
												color: T.muted,
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												whiteSpace: 'nowrap',
											}}
										>
											{op.email}
										</div>
									) : null}
								</div>
							) : null}
							<ThemeSwitch />
							<button type="button" style={styles.button} onClick={() => void signOut()}>
								{LOGOUT}
								Sign out
							</button>
						</>
					}
				/>
			</>
		);
	} else if (current.state === 'needs-2fa')
		screen = (
			<CodeForm
				title="Two-step verification"
				subtitle="Enter the code from your authenticator app."
				submitLabel="Verify"
				onSubmit={async (factor) => next((await cookieClient.verify(factor)).result)}
				onCancel={() => void signOut()}
			/>
		);
	else if (current.state === 'needs-enrollment')
		screen = (
			<EnrollForm
				steps={stepsFor(flow, 'Authenticator')}
				onDone={next}
				onCancel={() => void signOut()}
			/>
		);
	else if (linkToken) screen = <LinkForm token={linkToken} onDone={next} onKind={setFlow} />;
	else if (current.claimable)
		screen = (
			<ClaimForm
				onDone={(s) => {
					setFlow('claim');
					next(s);
				}}
			/>
		);
	else screen = <LoginForm onDone={next} />;
	return (
		<>
			{screen}
			{dock}
		</>
	);
}

// Operators when the deployment offers them (GET <prefix>/session answers);
// the token gate when it does not (no store, or operators: false).
function App() {
	const [mode, setMode] = useState<'loading' | 'operators' | 'token'>('loading');
	useEffect(() => {
		cookieClient
			.session()
			.then(() => setMode('operators'))
			.catch((err: unknown) =>
				setMode(err instanceof FonderieApiError && err.status === 404 ? 'token' : 'operators'),
			);
	}, []);
	if (mode === 'loading') return null;
	return mode === 'operators' ? <OperatorApp /> : <TokenApp />;
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
