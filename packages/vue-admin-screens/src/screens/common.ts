import type { FonderieApiError } from '@fonderie/client';
import type { Ref, VNode } from 'vue';
import { h } from 'vue';
import { styles } from '../styles';

// Shared frame: title (+ toolbar), then loading / error / content.
export function page(
	title: string,
	state: { isLoading: Ref<boolean>; error: Ref<FonderieApiError | null> },
	content: () => VNode | VNode[] | null,
	toolbar: VNode[] = [],
	options: { loadingText?: string; errorText?: (e: FonderieApiError) => string } = {},
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
	return h('div', { style: styles.container }, [
		h('div', { style: styles.toolbar }, [
			h('h1', { style: { ...styles.title, marginBottom: 0 } }, title),
			...toolbar,
		]),
		body,
	]);
}

export function table(headers: string[], rows: VNode[]): VNode {
	return h('table', { style: styles.table }, [
		h('thead', [
			h(
				'tr',
				headers.map((t) => h('th', { style: styles.th }, t)),
			),
		]),
		h('tbody', rows),
	]);
}

export const td = (children: VNode | string | (VNode | string)[], extra: object = {}) =>
	h('td', { style: { ...styles.td, ...extra } }, children);

export const refreshButton = (label: string, disabled: boolean, onClick: () => void) =>
	h('button', { type: 'button', style: styles.button, disabled, onClick }, label);
