import type { CSSProperties, VNode, VNodeChild } from 'vue';
import { h } from 'vue';
import { ICONS, type IconName } from './icons';
import { styles, type Tone, tint, toneColor } from './styles';

// Small building blocks every screen composes, so a header, a status or an
// empty page looks the same everywhere instead of being re-invented per
// screen. Render helpers (not components), matching ./screens/common.ts;
// the React screens ship the same blocks as components in ui.tsx.

export function icon(name: IconName, size = 16, style?: CSSProperties): VNode {
	return h(
		'svg',
		{
			width: size,
			height: size,
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': 2,
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			'aria-hidden': 'true',
			style: { flexShrink: 0, ...style },
		},
		ICONS[name].map((d) => h('path', { key: d, d })),
	);
}

/** Title, one line saying what the page answers, and its actions on the right. */
export function pageHeader(title: VNodeChild, lead?: VNodeChild, actions?: VNodeChild[]): VNode {
	return h('div', { style: styles.header }, [
		h('div', { style: { minWidth: 0 } }, [
			h('h1', { style: styles.title }, title as never),
			lead ? h('p', { style: styles.lead }, lead as never) : null,
		]),
		actions?.filter(Boolean).length ? h('div', { style: styles.actions }, actions as never) : null,
	]);
}

/** A status: coloured text on a tint of the same colour, with a dot. */
export function pill(tone: Tone, text: VNodeChild, dot = true): VNode {
	const color = toneColor[tone];
	return h(
		'span',
		{ style: { ...styles.pill, color, background: tint(color, tone === 'neutral' ? 10 : 13) } },
		[dot ? h('span', { style: styles.dot }) : null, text as never],
	);
}

export function stat(label: VNodeChild, value: VNodeChild, hint?: VNodeChild, tone?: Tone): VNode {
	return h('div', { style: styles.card }, [
		h('div', { style: styles.statLabel }, label as never),
		h(
			'div',
			{ style: { ...styles.statValue, ...(tone ? { color: toneColor[tone] } : {}) } },
			value as never,
		),
		hint ? h('div', { style: styles.statHint }, hint as never) : null,
	]);
}

export function empty(title: VNodeChild, body?: VNodeChild, iconName: IconName = 'check'): VNode {
	return h('div', { style: styles.empty }, [
		icon(iconName, 22),
		h('div', { style: styles.emptyTitle }, title as never),
		body ? h('div', body as never) : null,
	]);
}

export function refreshButton(
	onClick: () => void,
	busy: boolean,
	label = 'Refresh',
	busyLabel = 'Working…',
): VNode {
	return h('button', { type: 'button', style: styles.button, onClick, disabled: busy }, [
		icon('refresh', 14),
		busy ? busyLabel : label,
	]);
}

/** Colour for an HTTP method chip. */
export function methodChip(method: string): VNode {
	const tone: Tone =
		method === 'GET' ? 'ok' : method === 'DELETE' ? 'bad' : method === 'POST' ? 'info' : 'warn';
	const color = toneColor[tone];
	return h(
		'span',
		{
			style: {
				...styles.mono,
				fontSize: '11px',
				fontWeight: 700,
				color,
				background: tint(color, 12),
				borderRadius: '4px',
				padding: '2px 6px',
				display: 'inline-block',
				minWidth: '44px',
				textAlign: 'center',
			},
		},
		method,
	);
}
