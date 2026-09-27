import type { CSSProperties, ReactNode } from 'react';
import { ICONS, type IconName } from './icons';
import { styles, type Tone, tint, toneColor } from './styles';

// Small building blocks every screen composes, so a header, a status or an
// empty page looks the same everywhere instead of being re-invented per screen.

export function Icon({
	name,
	size = 16,
	style,
}: {
	name: IconName;
	size?: number;
	style?: CSSProperties | undefined;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			style={{ flexShrink: 0, ...style }}
		>
			{ICONS[name].map((d) => (
				<path key={d} d={d} />
			))}
		</svg>
	);
}

/** Title, one line saying what the page answers, and its actions on the right. */
export function PageHeader({
	title,
	lead,
	actions,
}: {
	title: ReactNode;
	lead?: ReactNode | undefined;
	actions?: ReactNode | undefined;
}) {
	return (
		<div style={styles.header}>
			<div style={{ minWidth: 0 }}>
				<h1 style={styles.title}>{title}</h1>
				{lead ? <p style={styles.lead}>{lead}</p> : null}
			</div>
			{actions ? <div style={styles.actions}>{actions}</div> : null}
		</div>
	);
}

/** A status: coloured text on a tint of the same colour, with a dot. */
export function Pill({
	tone,
	children,
	dot = true,
}: {
	tone: Tone;
	children: ReactNode;
	dot?: boolean;
}) {
	const color = toneColor[tone];
	return (
		<span style={{ ...styles.pill, color, background: tint(color, tone === 'neutral' ? 10 : 13) }}>
			{dot ? <span style={styles.dot} /> : null}
			{children}
		</span>
	);
}

export function Stat({
	label,
	value,
	hint,
	tone,
}: {
	label: ReactNode;
	value: ReactNode;
	hint?: ReactNode | undefined;
	tone?: Tone | undefined;
}) {
	return (
		<div style={styles.card}>
			<div style={styles.statLabel}>{label}</div>
			<div style={{ ...styles.statValue, ...(tone ? { color: toneColor[tone] } : {}) }}>
				{value}
			</div>
			{hint ? <div style={styles.statHint}>{hint}</div> : null}
		</div>
	);
}

export function Empty({
	icon = 'check',
	title,
	children,
}: {
	icon?: IconName;
	title: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div style={styles.empty}>
			<Icon name={icon} size={22} />
			<div style={styles.emptyTitle}>{title}</div>
			{children ? <div>{children}</div> : null}
		</div>
	);
}

export function RefreshButton({
	onClick,
	busy,
	label = 'Refresh',
}: {
	onClick: () => void;
	busy?: boolean;
	label?: string;
}) {
	return (
		<button type="button" style={styles.button} onClick={onClick} disabled={busy}>
			<Icon name="refresh" size={14} />
			{busy ? 'Working…' : label}
		</button>
	);
}

/** Colour for an HTTP method chip. */
export function MethodChip({ method }: { method: string }) {
	const tone: Tone =
		method === 'GET' ? 'ok' : method === 'DELETE' ? 'bad' : method === 'POST' ? 'info' : 'warn';
	const color = toneColor[tone];
	return (
		<span
			style={{
				...styles.mono,
				fontSize: 11,
				fontWeight: 700,
				color,
				background: tint(color, 12),
				borderRadius: 4,
				padding: '2px 6px',
				display: 'inline-block',
				minWidth: 44,
				textAlign: 'center',
			}}
		>
			{method}
		</span>
	);
}
