import type { FonderieApiError } from '@fonderie/client';
import type { CSSProperties, Ref, VNode, VNodeChild } from 'vue';
import { h } from 'vue';
import { styles } from '../styles';
import { icon, pageHeader } from '../ui';

// Shared frame: header (title, lead, actions on the right), then
// loading / error / content.
export function page(
	title: string,
	state: { isLoading: { readonly value: boolean }; error: Ref<FonderieApiError | null> },
	content: () => VNode | VNode[] | null,
	toolbar: (VNode | null)[] = [],
	options: {
		loadingText?: string;
		errorText?: (e: FonderieApiError) => string;
		lead?: VNodeChild;
	} = {},
): VNode {
	const body = state.isLoading.value
		? h('p', { style: styles.status }, options.loadingText ?? 'Loading…')
		: state.error.value
			? h(
					'p',
					{ style: styles.error, role: 'alert' },
					(options.errorText ?? ((e) => e.explanation))(state.error.value),
				)
			: content();
	return h('div', { style: styles.container }, [pageHeader(title, options.lead, toolbar), body]);
}

export function table(
	headers: (string | { label: string; style: CSSProperties })[],
	rows: VNode[],
): VNode {
	return h('table', { style: styles.table }, [
		h('thead', [
			h(
				'tr',
				headers.map((t) =>
					typeof t === 'string'
						? h('th', { style: styles.th }, t)
						: h('th', { style: { ...styles.th, ...t.style } }, t.label),
				),
			),
		]),
		h('tbody', rows),
	]);
}

export const td = (children: VNodeChild, extra: object = {}) =>
	h('td', { style: { ...styles.td, ...extra } }, children as never);

export const refreshButton = (label: string, disabled: boolean, onClick: () => void) =>
	h('button', { type: 'button', style: styles.button, disabled, onClick }, [
		icon('refresh', 14),
		disabled ? 'Working…' : label,
	]);

export const loadMoreButton = (onClick: () => void) =>
	h(
		'button',
		{ type: 'button', style: { ...styles.button, marginTop: '12px' }, onClick },
		'Load more',
	);

// A plain action button (no refresh glyph); `style` picks the variant.
export const actionButton = (
	label: VNodeChild,
	disabled: boolean,
	onClick: () => void,
	style: CSSProperties | undefined = styles.button,
) => h('button', { type: 'button', style, disabled, onClick }, label as never);
