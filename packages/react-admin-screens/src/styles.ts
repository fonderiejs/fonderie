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
const t = {
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

export const styles: Record<string, CSSProperties> = {
	shell: {
		display: 'flex',
		minHeight: '100vh',
		fontFamily: t.font,
		color: t.text,
		background: t.bg,
	},
	// The sidebar sits on the raised surface against the page canvas, which is
	// what separates the two without a heavy rule between them.
	nav: {
		width: 220,
		borderRight: `1px solid ${t.border}`,
		padding: 16,
		flexShrink: 0,
		background: t.surface,
	},
	navGroup: {
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
		color: t.muted,
		margin: '16px 0 6px',
		fontWeight: 600,
	},
	navItem: {
		display: 'block',
		width: '100%',
		textAlign: 'left',
		background: 'none',
		border: 'none',
		borderRadius: t.radius,
		padding: '6px 8px',
		cursor: 'pointer',
		fontSize: 14,
		color: t.text,
		fontFamily: 'inherit',
	},
	navItemActive: { background: t.surfaceAlt, fontWeight: 600, color: t.accentStrong },
	main: { flex: 1, padding: 24, maxWidth: 960 },
	container: { padding: 24, maxWidth: 960 },
	title: {
		fontSize: 20,
		fontWeight: 600,
		marginTop: 0,
		marginBottom: 12,
		letterSpacing: t.trackingDisplay,
	},
	subtitle: {
		fontSize: 15,
		fontWeight: 600,
		marginTop: 24,
		marginBottom: 8,
		letterSpacing: t.trackingDisplay,
	},
	status: { padding: 12, color: t.muted },
	error: { color: t.danger, marginBottom: 12, fontSize: 14 },
	ok: { color: t.accentStrong, fontWeight: 600 },
	bad: { color: t.danger, fontWeight: 600 },
	advice: { color: t.warning },
	muted: { color: t.muted, fontSize: 13 },
	mono: { fontFamily: t.mono, fontSize: 13 },
	table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
	th: {
		textAlign: 'left',
		borderBottom: `1px solid ${t.border}`,
		padding: '6px 8px',
		fontWeight: 600,
		color: t.muted,
	},
	td: { borderBottom: `1px solid ${t.borderLight}`, padding: '6px 8px', verticalAlign: 'top' },
	list: { listStyle: 'none', padding: 0, margin: 0 },
	row: { borderBottom: `1px solid ${t.borderLight}`, padding: '8px 0' },
	badge: {
		display: 'inline-block',
		borderRadius: 999,
		padding: '1px 8px',
		fontSize: 12,
		background: t.surfaceAlt,
		border: `1px solid ${t.border}`,
		color: t.muted,
	},
	button: {
		background: t.surface,
		border: `1px solid ${t.border}`,
		borderRadius: t.radius,
		padding: '4px 10px',
		cursor: 'pointer',
		fontSize: 13,
		color: t.text,
		fontFamily: 'inherit',
		boxShadow: t.shadowCard,
	},
	toolbar: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 },
	// Surfaces the screens compose themselves, kept here so a card looks the
	// same on every page rather than being re-invented per screen.
	card: {
		background: t.surface,
		border: `1px solid ${t.border}`,
		borderRadius: t.radiusLg,
		padding: 16,
		boxShadow: t.shadowCard,
	},
	accent: { color: t.accent },
};
