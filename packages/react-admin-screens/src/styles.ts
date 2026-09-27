import type { CSSProperties } from 'react';

// One palette for every admin page; the same values as the config and courier
// admin screens so the shell reads as one surface.
//
// Colours, type and radii come from `var(--fonderie-*)`, the organisation's
// design tokens, declared once in the served shell (@fonderie/admin's
// ui/html.ts). Inline styles take CSS variables, so this needs no stylesheet,
// no build step and no class plumbing — and light/dark follow the tokens
// without a single conditional here.
//
// Every var carries a FALLBACK. These screens are published packages: a
// consumer importing them into their own app has no Fonderie shell and
// therefore none of these variables, and `color: var(--fonderie-text)` with
// nothing behind it resolves to nothing — black text on black, or invisible
// borders. The fallbacks are the light palette, so an embedded screen still
// renders correctly and simply is not themed.
//
// Tints (pill backgrounds) use color-mix() over the same tokens, so a status
// colour and its background can never drift apart and dark mode needs no
// second palette. Where color-mix is unsupported the background is simply
// dropped and the coloured text still carries the meaning.
export const t = {
	text: 'var(--fonderie-text,#171717)',
	muted: 'var(--fonderie-text-muted,#5c5c5c)',
	bg: 'var(--fonderie-bg,#fafafa)',
	surface: 'var(--fonderie-surface,#fff)',
	surfaceAlt: 'var(--fonderie-surface-alt,#fafafa)',
	border: 'var(--fonderie-border,#e0e0e0)',
	borderLight: 'var(--fonderie-border-light,#f5f5f5)',
	accent: 'var(--fonderie-accent,#00d294)',
	accentStrong: 'var(--fonderie-accent-strong,#009767)',
	warning: 'var(--fonderie-warning,#f5a623)',
	danger: 'var(--fonderie-danger,#e00)',
	font: 'var(--fonderie-font,Inter,"Inter Fallback",-apple-system,BlinkMacSystemFont,"Helvetica Neue",system-ui,sans-serif)',
	mono: 'var(--fonderie-mono,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace)',
	radius: 'var(--fonderie-radius,4px)',
	radiusLg: 'var(--fonderie-radius-lg,8px)',
	trackingDisplay: 'var(--fonderie-tracking-display,-0.05em)',
	shadowCard: 'var(--fonderie-shadow-card,0 2px 3px 0 rgba(0,0,0,.05))',
} as const;

/** A token mixed into transparency — for tinted backgrounds that follow the theme. */
export const tint = (token: string, pct: number): string =>
	`color-mix(in srgb, ${token} ${pct}%, transparent)`;

export type Tone = 'ok' | 'bad' | 'warn' | 'neutral' | 'info';
export const toneColor: Record<Tone, string> = {
	ok: t.accentStrong,
	bad: t.danger,
	// Amber on white fails contrast; mixing in the text colour darkens it in
	// light mode and lightens it in dark, from the same two tokens.
	warn: `color-mix(in srgb, ${t.warning} 70%, ${t.text})`,
	neutral: t.muted,
	info: t.text,
};

const control: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: 6,
	height: 32,
	boxSizing: 'border-box',
	borderRadius: 6,
	padding: '0 12px',
	fontSize: 13,
	fontWeight: 500,
	fontFamily: 'inherit',
	lineHeight: 1,
	whiteSpace: 'nowrap',
};

export const styles: Record<string, CSSProperties> = {
	shell: {
		display: 'flex',
		minHeight: '100vh',
		fontFamily: t.font,
		color: t.text,
		background: t.bg,
	},
	// Sticky, full height, scrolls on its own: the nav never scrolls away with
	// a long table, and the footer (session controls) stays in reach.
	nav: {
		width: 248,
		flexShrink: 0,
		boxSizing: 'border-box',
		borderRight: `1px solid ${t.border}`,
		background: t.surface,
		position: 'sticky',
		top: 0,
		height: '100vh',
		display: 'flex',
		flexDirection: 'column',
	},
	navBrand: {
		display: 'flex',
		alignItems: 'center',
		gap: 10,
		padding: '18px 16px 14px',
		borderBottom: `1px solid ${t.borderLight}`,
	},
	navMark: {
		width: 28,
		height: 28,
		borderRadius: 7,
		background: t.text,
		color: t.surface,
		display: 'grid',
		placeItems: 'center',
		flexShrink: 0,
	},
	navBrandTitle: {
		fontSize: 14,
		fontWeight: 600,
		letterSpacing: t.trackingDisplay,
		lineHeight: 1.2,
		overflow: 'hidden',
		textOverflow: 'ellipsis',
		whiteSpace: 'nowrap',
	},
	navScroll: { flex: 1, overflowY: 'auto', padding: '8px 10px 16px' },
	navGroup: {
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
		color: t.muted,
		margin: '16px 8px 4px',
		fontWeight: 600,
	},
	navItem: {
		display: 'flex',
		alignItems: 'center',
		gap: 10,
		width: '100%',
		textAlign: 'left',
		background: 'none',
		border: 'none',
		borderRadius: 6,
		padding: '7px 8px',
		cursor: 'pointer',
		fontSize: 13.5,
		fontWeight: 500,
		color: t.muted,
		fontFamily: 'inherit',
		position: 'relative',
	},
	navItemActive: { background: tint(t.accent, 12), color: t.text, fontWeight: 600 },
	navIconActive: { color: t.accentStrong },
	navFooter: {
		borderTop: `1px solid ${t.borderLight}`,
		padding: 12,
		display: 'flex',
		flexDirection: 'column',
		gap: 10,
	},
	// Phone layout: a top bar with the menu button replaces the sidebar, which
	// opens as a drawer over the content.
	topbar: {
		position: 'sticky',
		top: 0,
		zIndex: 20,
		display: 'flex',
		alignItems: 'center',
		gap: 10,
		padding: '10px 16px',
		background: t.surface,
		borderBottom: `1px solid ${t.border}`,
	},
	drawer: {
		position: 'fixed',
		inset: 0,
		zIndex: 30,
		display: 'flex',
	},
	scrim: { flex: 1, background: 'rgba(0,0,0,.35)' },
	main: { flex: 1, minWidth: 0 },
	container: { padding: '32px 40px 64px', maxWidth: 1160, boxSizing: 'border-box' },

	// ── page header ──
	header: {
		display: 'flex',
		alignItems: 'flex-start',
		justifyContent: 'space-between',
		gap: 16,
		marginBottom: 24,
		flexWrap: 'wrap',
	},
	title: {
		fontSize: 22,
		fontWeight: 600,
		margin: 0,
		letterSpacing: t.trackingDisplay,
		lineHeight: 1.25,
	},
	lead: { color: t.muted, fontSize: 13.5, margin: '4px 0 0', lineHeight: 1.5 },
	actions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
	subtitle: {
		fontSize: 15,
		fontWeight: 600,
		marginTop: 32,
		marginBottom: 10,
		letterSpacing: t.trackingDisplay,
		display: 'flex',
		alignItems: 'center',
		gap: 8,
	},

	// ── feedback ──
	status: { padding: '24px 0', color: t.muted, fontSize: 13.5 },
	error: {
		color: t.danger,
		background: tint(t.danger, 8),
		border: `1px solid ${tint(t.danger, 25)}`,
		borderRadius: t.radiusLg,
		padding: '10px 14px',
		marginBottom: 16,
		fontSize: 13.5,
	},
	notice: {
		color: t.text,
		background: tint(t.warning, 10),
		border: `1px solid ${tint(t.warning, 35)}`,
		borderRadius: t.radiusLg,
		padding: '10px 14px',
		marginBottom: 16,
		fontSize: 13.5,
	},
	ok: { color: t.accentStrong, fontWeight: 600 },
	bad: { color: t.danger, fontWeight: 600 },
	advice: { color: t.warning },
	muted: { color: t.muted, fontSize: 13 },
	mono: { fontFamily: t.mono, fontSize: 12.5 },
	code: {
		fontFamily: t.mono,
		fontSize: 12,
		background: t.surfaceAlt,
		border: `1px solid ${t.borderLight}`,
		borderRadius: 4,
		padding: '1px 5px',
	},

	// ── surfaces ──
	// Tables and lists are cards themselves, so every screen gets the framed,
	// rounded look without wrapping each one. The last row's rule is removed in
	// the shell stylesheet (a pseudo-selector); embedded without the shell it
	// simply doubles against the frame.
	table: {
		width: '100%',
		borderCollapse: 'separate',
		borderSpacing: 0,
		fontSize: 13.5,
		background: t.surface,
		border: `1px solid ${t.border}`,
		borderRadius: t.radiusLg,
		overflow: 'hidden',
		boxShadow: t.shadowCard,
	},
	th: {
		textAlign: 'left',
		borderBottom: `1px solid ${t.border}`,
		padding: '9px 14px',
		fontWeight: 600,
		fontSize: 11.5,
		textTransform: 'uppercase',
		letterSpacing: 0.4,
		color: t.muted,
		background: t.surfaceAlt,
		whiteSpace: 'nowrap',
	},
	td: {
		borderBottom: `1px solid ${t.borderLight}`,
		padding: '11px 14px',
		verticalAlign: 'top',
	},
	list: {
		listStyle: 'none',
		padding: 0,
		margin: 0,
		background: t.surface,
		border: `1px solid ${t.border}`,
		borderRadius: t.radiusLg,
		overflow: 'hidden',
		boxShadow: t.shadowCard,
	},
	row: { borderBottom: `1px solid ${t.borderLight}`, padding: '12px 16px' },
	card: {
		background: t.surface,
		border: `1px solid ${t.border}`,
		borderRadius: t.radiusLg,
		padding: 16,
		boxShadow: t.shadowCard,
	},
	grid: {
		display: 'grid',
		gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
		gap: 12,
		marginBottom: 24,
	},
	statLabel: { fontSize: 12, color: t.muted, fontWeight: 500 },
	statValue: {
		fontSize: 26,
		fontWeight: 600,
		letterSpacing: t.trackingDisplay,
		lineHeight: 1.2,
		marginTop: 6,
	},
	statHint: { fontSize: 12, color: t.muted, marginTop: 2 },
	empty: {
		background: t.surface,
		border: `1px dashed ${t.border}`,
		borderRadius: t.radiusLg,
		padding: '40px 24px',
		textAlign: 'center',
		color: t.muted,
		fontSize: 13.5,
	},
	emptyTitle: { color: t.text, fontWeight: 600, fontSize: 14.5, margin: '10px 0 4px' },
	dl: { display: 'grid', gridTemplateColumns: '160px 1fr', margin: 0 },
	dt: {
		color: t.muted,
		fontSize: 13,
		padding: '10px 16px',
		borderBottom: `1px solid ${t.borderLight}`,
	},
	dd: {
		margin: 0,
		padding: '10px 16px',
		borderBottom: `1px solid ${t.borderLight}`,
		fontSize: 13.5,
		minWidth: 0,
	},

	badge: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: 5,
		borderRadius: 999,
		padding: '2px 8px',
		fontSize: 11.5,
		fontWeight: 500,
		lineHeight: 1.5,
		background: t.surfaceAlt,
		border: `1px solid ${t.border}`,
		color: t.muted,
		whiteSpace: 'nowrap',
	},
	pill: {
		display: 'inline-flex',
		alignItems: 'center',
		gap: 6,
		borderRadius: 999,
		padding: '2px 9px 2px 8px',
		fontSize: 12,
		fontWeight: 600,
		lineHeight: 1.5,
		whiteSpace: 'nowrap',
		verticalAlign: 'baseline',
	},
	dot: { width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: 'currentColor' },

	// ── controls ──
	button: {
		...control,
		background: t.surface,
		border: `1px solid ${t.border}`,
		color: t.text,
		cursor: 'pointer',
		boxShadow: t.shadowCard,
	},
	buttonPrimary: {
		...control,
		background: t.text,
		border: `1px solid ${t.text}`,
		color: t.surface,
		cursor: 'pointer',
	},
	buttonDanger: {
		...control,
		background: t.surface,
		border: `1px solid ${tint(t.danger, 40)}`,
		color: t.danger,
		cursor: 'pointer',
	},
	buttonGhost: {
		...control,
		background: 'none',
		border: '1px solid transparent',
		color: t.muted,
		cursor: 'pointer',
		padding: '0 8px',
	},
	link: {
		background: 'none',
		border: 'none',
		padding: 0,
		color: t.text,
		fontFamily: 'inherit',
		fontSize: 'inherit',
		fontWeight: 500,
		cursor: 'pointer',
		textAlign: 'left',
	},
	input: {
		height: 32,
		boxSizing: 'border-box',
		border: `1px solid ${t.border}`,
		borderRadius: 6,
		padding: '0 10px',
		fontSize: 13.5,
		fontFamily: 'inherit',
		background: t.surface,
		color: t.text,
		minWidth: 0,
	},
	toolbar: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
	accent: { color: t.accent },
};
