import {
	ADMIN_LOCALES,
	type AdminLocale,
	type AdminT,
	AdminClient,
	AuditAdminClient,
	AuthAdminClient,
	BillingAdminClient,
	ConfigAdminClient,
	CourierAdminClient,
	FonderieApiError,
	adminLocaleNames,
	createAdminT,
	detectAdminLocale,
	isAdminLocale,
} from '@fonderie/client';
import type { IAdminEnrollment, IAdminManifest, IAdminSession } from '@fonderie/client';
import { useAdminSession } from '@fonderie/react-admin';
import { type AdminPage, AdminShell } from '@fonderie/react-admin-screens';
import qrcode from 'qrcode-generator';
import {
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
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

const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

// ── Console language ──────────────────────────────────────────────────────
// The OPERATOR's language for this console — independent of the locales the
// app serves its customers: someone in France can run the console in French
// while every customer email stays English. Browser language by default, then
// whatever they pick; localStorage because, like the theme, it is a display
// preference that should outlive the tab (and not a secret). Namespaced for
// the same reason as the theme key.
const LOCALE_KEY = 'fonderie.admin.locale';

const readLocale = (): AdminLocale => {
	try {
		const v = window.localStorage.getItem(LOCALE_KEY);
		if (isAdminLocale(v)) return v;
	} catch {
		/* private mode — fall through to the browser's language */
	}
	return detectAdminLocale(typeof navigator === 'undefined' ? [] : (navigator.languages ?? []));
};

const storeLocale = (locale: AdminLocale): void => {
	try {
		window.localStorage.setItem(LOCALE_KEY, locale);
	} catch {
		/* private mode — the choice holds for this page */
	}
};

interface II18n {
	locale: AdminLocale;
	setLocale: (l: AdminLocale) => void;
	t: AdminT;
}
const I18nContext = createContext<II18n>({
	locale: 'en',
	setLocale: () => undefined,
	t: createAdminT('en'),
});
const useI18n = () => useContext(I18nContext);

const GLOBE = (
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
		<circle cx="12" cy="12" r="10" />
		<path d="M2 12h20" />
		<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
	</svg>
);
const CHEVRON = (
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
		<path d="m6 9 6 6 6-6" />
	</svg>
);
const CHECK = (
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
		<path d="M20 6 9 17l-5-5" />
	</svg>
);

const themeLabel = (t: AdminT, c: ThemeChoice): string =>
	c === 'system'
		? t('common.themeSystem')
		: c === 'light'
			? t('common.themeLight')
			: t('common.themeDark');

/** Icon-only System / Light / Dark control. Same storage and CSS states as before. */
function ThemeSegment() {
	const { t } = useI18n();
	const [choice, setChoice] = useState<ThemeChoice>(readTheme);
	return (
		<fieldset
			aria-label={t('common.theme')}
			style={{
				display: 'inline-flex',
				margin: 0,
				minWidth: 0,
				padding: 3,
				gap: 2,
				borderRadius: 9999,
				border: '1px solid var(--fonderie-border,#e0e0e0)',
				background: 'var(--fonderie-bg,#fafafa)',
			}}
		>
			{THEME_CHOICES.map((c) => {
				const on = choice === c;
				return (
					<button
						key={c}
						type="button"
						aria-pressed={on}
						aria-label={themeLabel(t, c)}
						title={themeLabel(t, c)}
						onClick={() => {
							applyTheme(c);
							setChoice(c);
						}}
						style={{
							display: 'grid',
							placeItems: 'center',
							width: 30,
							height: 26,
							borderRadius: 9999,
							border: 'none',
							cursor: 'pointer',
							background: on ? 'var(--fonderie-surface,#fff)' : 'transparent',
							color: on ? 'var(--fonderie-text,#171717)' : 'var(--fonderie-text-muted,#5c5c5c)',
							boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
						}}
					>
						{ICONS[c]}
					</button>
				);
			})}
		</fieldset>
	);
}

/** EN ▾ — opens a menu of languages (upward), with a check on the current one. */
function LanguageButton() {
	const { locale, setLocale, t } = useI18n();
	const [open, setOpen] = useState(false);
	const wrap = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false);
		};
		const onDown = (e: MouseEvent) => {
			if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener('keydown', onKey);
		document.addEventListener('mousedown', onDown);
		return () => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('mousedown', onDown);
		};
	}, [open]);
	return (
		<div ref={wrap} style={{ position: 'relative' }}>
			<button
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={t('session.changeLanguage', { name: adminLocaleNames[locale] })}
				onClick={() => setOpen((o) => !o)}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 4,
					height: 28,
					padding: '0 6px 0 8px',
					border: 'none',
					borderRadius: 6,
					background: 'transparent',
					cursor: 'pointer',
					fontFamily: 'inherit',
					fontSize: 13,
					fontWeight: 600,
					color: 'var(--fonderie-text,#171717)',
				}}
			>
				{locale.toUpperCase()}
				{CHEVRON}
			</button>
			{open ? (
				<div
					role="menu"
					aria-label={t('common.language')}
					style={{
						position: 'absolute',
						bottom: 'calc(100% + 6px)',
						right: 0,
						zIndex: 60,
						minWidth: 170,
						padding: 6,
						background: 'var(--fonderie-surface,#fff)',
						border: '1px solid var(--fonderie-border,#e0e0e0)',
						borderRadius: 10,
						boxShadow: '0 12px 32px -12px rgba(0,0,0,.25), 0 1px 2px rgba(0,0,0,.06)',
					}}
				>
					{ADMIN_LOCALES.map((l) => {
						const on = l === locale;
						return (
							<button
								key={l}
								type="button"
								role="menuitemradio"
								aria-checked={on}
								lang={l}
								onClick={() => {
									setLocale(l);
									setOpen(false);
								}}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									width: '100%',
									padding: '8px 10px',
									border: 'none',
									borderRadius: 6,
									background: 'transparent',
									cursor: 'pointer',
									fontFamily: 'inherit',
									fontSize: 14,
									fontWeight: on ? 600 : 400,
									color: on ? 'var(--fonderie-text,#171717)' : 'var(--fonderie-text-muted,#5c5c5c)',
									textAlign: 'left',
								}}
							>
								{adminLocaleNames[l]}
								{on ? (
									<span style={{ color: 'var(--fonderie-accent-strong,#009767)' }}>{CHECK}</span>
								) : null}
							</button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

/** The sidebar-footer preference rows: Language · EN ▾ and Theme · [◐ ☀ ☾]. */
function PreferenceRows() {
	const { t } = useI18n();
	const row: React.CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
		minHeight: 32,
	};
	const label: React.CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		gap: 8,
		fontSize: 13,
		color: 'var(--fonderie-text-muted,#5c5c5c)',
	};
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
			<div style={row}>
				<span style={label}>
					{GLOBE}
					{t('common.language')}
				</span>
				<LanguageButton />
			</div>
			<div style={row}>
				<span style={label}>
					{ICONS.system}
					{t('common.theme')}
				</span>
				<ThemeSegment />
			</div>
		</div>
	);
}

/** Bottom-right on the sign-in and onboarding cards: language + theme. */
function PreferenceDock() {
	return (
		<div
			style={{
				...styles.themeDock,
				display: 'inline-flex',
				alignItems: 'center',
				gap: 6,
				padding: '3px 3px 3px 6px',
				background: 'var(--fonderie-surface,#fff)',
				border: '1px solid var(--fonderie-border,#e0e0e0)',
			}}
		>
			<LanguageButton />
			<ThemeSegment />
		</div>
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
	const { t } = useI18n();
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
				<h1 style={styles.h1}>{t('session.signInTitle')}</h1>
				<p style={styles.p}>{window.location.hostname}</p>
				<label htmlFor="admin-token" style={styles.label}>
					{t('session.adminToken')}
				</label>
				<input
					id="admin-token"
					type="password"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder={t('session.pasteToken')}
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
					{t('common.continue')}
				</button>
				<p style={styles.foot}>{t('session.tokenFoot')}</p>
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
	const { t } = useI18n();
	const [token, setToken] = useState(read);
	// Kept as a code, not a sentence, so switching language re-renders it.
	const [error, setError] = useState<{ refused: true } | { detail: string } | null>(null);
	const [manifest, setManifest] = useState<IAdminManifest | null>(null);

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
						? { refused: true }
						: { detail: err instanceof FonderieApiError ? err.explanation : String(err) },
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
				<Gate
					onToken={setToken}
					error={
						error === null
							? null
							: 'refused' in error
								? t('session.tokenRefused')
								: t('session.unreachable', { error: error.detail })
					}
				/>
				<PreferenceDock />
			</>
		);
	}
	return (
		<Dashboard
			token={token}
			manifest={manifest}
			footer={
				<>
					<PreferenceRows />
					<button type="button" style={styles.button} onClick={forget}>
						{LOGOUT}
						{t('session.forgetToken')}
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
	const { locale } = useI18n();
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
			locale={locale}
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

// The server's sign-in answers carry a stable reason code; show the operator's
// language for the ones this page knows, and the server's own words otherwise.
const KNOWN_REASONS = [
	'INVALID_CREDENTIALS',
	'INVALID_CODE',
	'RATE_LIMITED',
	'WEAK_PASSWORD',
	'INVALID_LINK',
	'ALREADY_OPERATOR',
	'ALREADY_CLAIMED',
	'CROSS_ORIGIN',
] as const;
const errText = (err: unknown, t: AdminT): string => {
	if (!(err instanceof FonderieApiError)) return t('session.genericError');
	if (err.reason === 'MISMATCH') return t('session.passwordsMismatch');
	if (err.reason === 'UNAUTHORIZED') return t('session.tokenRefused');
	if (err.reason === 'LOCKED') {
		const m = /(\d+)\s*minute/.exec(err.explanation);
		return m
			? t('session.errors.LOCKED', { minutes: m[1] ?? '' })
			: t('session.errors.LOCKED_GENERIC');
	}
	const known = KNOWN_REASONS.find((r) => r === err.reason);
	return known ? t(`session.errors.${known}`) : err.explanation;
};

type Steps = { labels: readonly StepId[]; at: number };

// First-time setup is an onboarding flow, not a login: a progress bar across
// the screens it spans (claim: token → account → authenticator → backup
// codes; invite and recovery: the last three).
function StepBar({ labels, at }: Steps) {
	const { t } = useI18n();
	return (
		<ol
			aria-label={t('session.stepOf', { n: at + 1, total: labels.length })}
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
						{t(`session.steps.${label}`)}
					</div>
				</li>
			))}
		</ol>
	);
}

// Step ids, rendered through t('session.steps.<id>').
type StepId = 'adminToken' | 'account' | 'authenticator' | 'backupCodes' | 'newPassword';
const CLAIM_STEPS: readonly StepId[] = ['adminToken', 'account', 'authenticator', 'backupCodes'];
const INVITE_STEPS: readonly StepId[] = ['account', 'authenticator', 'backupCodes'];
const RECOVERY_STEPS: readonly StepId[] = ['newPassword', 'authenticator', 'backupCodes'];
type Flow = 'claim' | 'invite' | 'recovery';
const STEPS_OF: Record<Flow, readonly StepId[]> = {
	claim: CLAIM_STEPS,
	invite: INVITE_STEPS,
	recovery: RECOVERY_STEPS,
};
/** Where the authenticator and backup-code screens sit in a flow. */
const stepsFor = (flow: Flow | null, name: 'authenticator' | 'backupCodes'): Steps | undefined =>
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
	const { t } = useI18n();
	const [busy, setBusy] = useState(false);
	// The raw error, translated at render time so a language switch applies.
	const [failure, setFailure] = useState<unknown>(null);
	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		setFailure(null);
		try {
			await fn();
		} catch (err) {
			setFailure(err ?? new Error('failed'));
		} finally {
			setBusy(false);
		}
	};
	return { busy, error: failure === null ? null : errText(failure, t), run };
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
	const { t } = useI18n();
	const [token, setToken] = useState('');
	const [accepted, setAccepted] = useState<string | null>(null);
	const [f, setF] = useState({ email: '', name: '', password: '', confirm: '' });
	const { busy, error, run } = useSubmit();

	if (!accepted) {
		return (
			<AuthCard
				steps={{ labels: CLAIM_STEPS, at: 0 }}
				title={t('session.welcomeTitle')}
				subtitle={t('session.welcomeSubtitle', { host: window.location.hostname })}
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
									throw new FonderieApiError('UNAUTHORIZED', t('session.tokenRefused'), 401);
								}
								throw err;
							}
							setAccepted(token.trim());
						});
					}}
				>
					<Field
						id="fa-root"
						label={t('session.adminToken')}
						type="password"
						autoComplete="off"
						required
						autoFocus
						value={token}
						onChange={(e) => setToken(e.target.value)}
					/>
					<ErrorLine error={error} />
					<button type="submit" style={styles.primary} disabled={busy}>
						{busy ? t('session.checking') : t('common.continue')}
					</button>
				</form>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			steps={{ labels: CLAIM_STEPS, at: 1 }}
			title={t('session.createAccountTitle')}
			subtitle={t('session.createAccountSubtitle')}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (f.password !== f.confirm) {
						void run(async () =>
							Promise.reject(new FonderieApiError('MISMATCH', t('session.passwordsMismatch'), 422)),
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
					label={t('session.email')}
					type="email"
					autoComplete="username"
					required
					autoFocus
					value={f.email}
					onChange={(e) => setF({ ...f, email: e.target.value })}
				/>
				<Field
					id="fa-name"
					label={t('session.nameOptional')}
					autoComplete="name"
					value={f.name}
					onChange={(e) => setF({ ...f, name: e.target.value })}
				/>
				<Field
					id="fa-password"
					label={t('session.password')}
					type="password"
					autoComplete="new-password"
					required
					minLength={12}
					value={f.password}
					onChange={(e) => setF({ ...f, password: e.target.value })}
				/>
				<Field
					id="fa-confirm"
					label={t('session.confirmPassword')}
					type="password"
					autoComplete="new-password"
					required
					value={f.confirm}
					onChange={(e) => setF({ ...f, confirm: e.target.value })}
				/>
				<p style={styles.foot}>{t('session.passwordHintNext')}</p>
				<ErrorLine error={error} />
				<button type="submit" style={styles.primary} disabled={busy}>
					{busy ? t('session.creating') : t('session.createAccount')}
				</button>
			</form>
		</AuthCard>
	);
}

function LoginForm({ onDone }: { onDone: (s: IAdminSession) => void }) {
	const { t } = useI18n();
	const [f, setF] = useState({ email: '', password: '' });
	const { busy, error, run } = useSubmit();
	return (
		<AuthCard title={t('session.signInTitle')} subtitle={window.location.hostname}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					void run(async () => onDone((await cookieClient.login(f)).result));
				}}
			>
				<Field
					id="fa-email"
					label={t('session.email')}
					type="email"
					autoComplete="username"
					required
					autoFocus
					value={f.email}
					onChange={(e) => setF({ ...f, email: e.target.value })}
				/>
				<Field
					id="fa-password"
					label={t('session.password')}
					type="password"
					autoComplete="current-password"
					required
					value={f.password}
					onChange={(e) => setF({ ...f, password: e.target.value })}
				/>
				<ErrorLine error={error} />
				<button type="submit" style={styles.primary} disabled={busy}>
					{busy ? t('session.checking') : t('common.continue')}
				</button>
				<p style={styles.foot}>{t('session.loginFoot')}</p>
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
	const { t } = useI18n();
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
					label={backup ? t('session.backupCode') : t('session.authenticatorCode')}
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
					{busy ? t('session.checking') : submitLabel}
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
						{backup ? t('session.useApp') : t('session.useBackup')}
					</button>
					{onCancel ? (
						<>
							{' · '}
							<button type="button" style={styles.link} onClick={onCancel}>
								{t('common.cancel')}
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
	const { t } = useI18n();
	const [enrollment, setEnrollment] = useState<IAdminEnrollment | null>(null);
	const [failure, setFailure] = useState<unknown>(null);
	const error = failure === null ? null : errText(failure, t);
	const [showKey, setShowKey] = useState(false);
	useEffect(() => {
		cookieClient
			.enrollment()
			.then(({ result }) => setEnrollment(result))
			.catch((err) => setFailure(err ?? new Error('failed')));
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
			title={t('session.enrollTitle')}
			subtitle={t('session.enrollSubtitle')}
		>
			{error ? <ErrorLine error={error} /> : null}
			{enrollment && qr ? (
				<>
					<ol style={{ ...styles.p, paddingLeft: 18, margin: '16px 0 0' }}>
						<li>{t('session.enrollScan')}</li>
						<li>{t('session.enrollEnter')}</li>
					</ol>
					<div style={{ display: 'grid', placeItems: 'center', margin: '16px 0 8px' }}>
						<img
							src={qr}
							alt={t('session.qrAlt')}
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
								{t('session.cantScan')}
							</button>
						)}
					</p>
					<ConfirmCode onDone={onDone} />
				</>
			) : !error ? (
				<p style={styles.p}>{t('session.preparing')}</p>
			) : null}
			<p style={styles.foot}>
				<button type="button" style={styles.link} onClick={onCancel}>
					{t('session.cancelSignOut')}
				</button>
			</p>
		</AuthCard>
	);
}

function ConfirmCode({ onDone }: { onDone: (s: IAdminSession) => void }) {
	const { t } = useI18n();
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
				label={t('session.codeFromApp')}
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
				{busy ? t('session.checking') : t('session.verifyContinue')}
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
	const { t } = useI18n();
	const [saved, setSaved] = useState(false);
	const text = `${t('session.backupFileHeader', { host: window.location.hostname })}\n${codes.join('\n')}\n`;
	return (
		<AuthCard
			icon={SHIELD}
			steps={steps}
			title={t('session.backupTitle')}
			subtitle={t('session.backupSubtitle')}
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
					{t('common.copy')}
				</button>
				<a
					href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
					download={`admin-backup-codes-${window.location.hostname}.txt`}
					style={{ ...styles.button, textDecoration: 'none' }}
				>
					{t('session.download')}
				</a>
			</div>
			<label style={{ ...styles.p, display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
				<input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
				{t('session.savedCheckbox')}
			</label>
			<button type="button" style={styles.primary} disabled={!saved} onClick={onDone}>
				{t('session.openConsole')}
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
	const { t } = useI18n();
	const [link, setLink] = useState<{ kind: 'invite' | 'recovery'; email: string } | null>(null);
	const [badErr, setBadErr] = useState<unknown>(null);
	const bad = badErr === null ? null : errText(badErr, t);
	const [f, setF] = useState({ name: '', password: '', confirm: '' });
	const { busy, error, run } = useSubmit();
	useEffect(() => {
		cookieClient
			.inspectLink(token)
			.then(({ result }) => {
				setLink(result);
				onKind(result.kind);
			})
			.catch((err) => setBadErr(err ?? new Error('failed')));
	}, [token, onKind]);
	if (bad)
		return (
			<AuthCard title={t('session.linkInvalidTitle')} subtitle={bad}>
				{null}
			</AuthCard>
		);
	if (!link) return <AuthCard title={t('session.checkingLink')}>{null}</AuthCard>;
	const invite = link.kind === 'invite';
	return (
		<AuthCard
			steps={{ labels: invite ? INVITE_STEPS : RECOVERY_STEPS, at: 0 }}
			title={invite ? t('session.joinTitle') : t('session.recoverTitle')}
			subtitle={
				invite
					? t('session.joinSubtitle', { email: link.email })
					: t('session.recoverSubtitle', { email: link.email })
			}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (f.password !== f.confirm)
						return void run(async () =>
							Promise.reject(new FonderieApiError('MISMATCH', t('session.passwordsMismatch'), 422)),
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
						label={t('session.yourNameOptional')}
						autoComplete="name"
						value={f.name}
						onChange={(e) => setF({ ...f, name: e.target.value })}
					/>
				) : null}
				<Field
					id="fa-password"
					label={t('session.newPassword')}
					type="password"
					autoComplete="new-password"
					required
					minLength={12}
					value={f.password}
					onChange={(e) => setF({ ...f, password: e.target.value })}
				/>
				<Field
					id="fa-confirm"
					label={t('session.confirmPassword')}
					type="password"
					autoComplete="new-password"
					required
					value={f.confirm}
					onChange={(e) => setF({ ...f, confirm: e.target.value })}
				/>
				<p style={styles.foot}>{t('session.passwordHint')}</p>
				<ErrorLine error={error} />
				<button type="submit" style={styles.primary} disabled={busy}>
					{busy ? t('common.saving') : t('common.continue')}
				</button>
			</form>
		</AuthCard>
	);
}

function StepUpPrompt() {
	const { t } = useI18n();
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
			aria-label={t('session.stepUpTitle')}
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
					title={t('session.stepUpTitle')}
					subtitle={t('session.stepUpSubtitle')}
					submitLabel={t('common.confirm')}
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
	const { t } = useI18n();
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

	const dock = <PreferenceDock />;
	if (!current) return dock;

	let screen: ReactNode;
	if (codes)
		screen = (
			<BackupCodes
				codes={codes}
				steps={stepsFor(flow, 'backupCodes')}
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
							<PreferenceRows />
							<button type="button" style={styles.button} onClick={() => void signOut()}>
								{LOGOUT}
								{t('session.signOut')}
							</button>
						</>
					}
				/>
			</>
		);
	} else if (current.state === 'needs-2fa')
		screen = (
			<CodeForm
				title={t('session.twoStepTitle')}
				subtitle={t('session.twoStepSubtitle')}
				submitLabel={t('session.verify')}
				onSubmit={async (factor) => next((await cookieClient.verify(factor)).result)}
				onCancel={() => void signOut()}
			/>
		);
	else if (current.state === 'needs-enrollment')
		screen = (
			<EnrollForm
				steps={stepsFor(flow, 'authenticator')}
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
	const [locale, setLocaleState] = useState<AdminLocale>(readLocale);
	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);
	const i18n = useMemo<II18n>(
		() => ({
			locale,
			setLocale: (l) => {
				storeLocale(l);
				setLocaleState(l);
			},
			t: createAdminT(locale),
		}),
		[locale],
	);
	useEffect(() => {
		cookieClient
			.session()
			.then(() => setMode('operators'))
			.catch((err: unknown) =>
				setMode(err instanceof FonderieApiError && err.status === 404 ? 'token' : 'operators'),
			);
	}, []);
	if (mode === 'loading') return null;
	return (
		<I18nContext.Provider value={i18n}>
			{mode === 'operators' ? <OperatorApp /> : <TokenApp />}
		</I18nContext.Provider>
	);
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
