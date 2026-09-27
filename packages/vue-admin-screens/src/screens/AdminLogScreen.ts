import {
	type AdminClient,
	type AdminLocale,
	createAdminT,
	formatAdminDate,
} from '@fonderie/client';
import { useAdminLog } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';
import { empty, methodChip, pageHeader, pill } from '../ui';
import { loadMoreButton, refreshButton, table, td } from './common';

// Who did what through the surface, newest first — refused requests included.
export const AdminLogScreen = defineComponent({
	name: 'FonderieAdminLogScreen',
	props: {
		client: { type: Object as PropType<AdminClient>, required: true },
		pageSize: { type: Number, default: 50 },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const { entries, hasMore, isLoading, error, refresh, loadMore } = useAdminLog(props.client, {
			limit: props.pageSize,
		});
		return () => {
			const t = createAdminT(props.locale);
			return h('div', { style: styles.container }, [
				pageHeader(t('log.title'), t('log.lead'), [
					refreshButton(
						t('common.refresh'),
						isLoading.value,
						() => void refresh(),
						t('common.working'),
					),
				]),
				error.value
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							error.value.status === 404 ? t('log.off') : error.value.explanation,
						)
					: entries.value.length === 0 && !isLoading.value
						? empty(t('log.empty'), undefined, 'log')
						: [
								table(
									[
										t('log.colWhen'),
										t('log.colActor'),
										t('log.colRequest'),
										t('log.colStatus'),
										t('log.colModule'),
									],
									entries.value.map((e) =>
										h('tr', { key: e.id }, [
											td(formatAdminDate(e.at, props.locale), {
												...styles.muted,
												whiteSpace: 'nowrap',
											}),
											td(e.actor),
											td([
												methodChip(e.method),
												' ',
												h('span', { style: { ...styles.mono, wordBreak: 'break-all' } }, e.path),
											]),
											td(
												[
													pill(
														e.status >= 500 ? 'bad' : e.status >= 400 ? 'warn' : 'ok',
														String(e.status),
													),
													' ',
													h('span', { style: styles.muted }, `${e.durationMs} ms`),
												],
												{ whiteSpace: 'nowrap' },
											),
											td(e.module, styles.muted),
										]),
									),
								),
								isLoading.value ? h('p', { style: styles.status }, t('common.loading')) : null,
								hasMore.value && !isLoading.value
									? loadMoreButton(() => void loadMore(), t('common.loadMore'))
									: null,
							],
			]);
		};
	},
});
