import {
	type AdminLocale,
	type AuditAdminClient,
	createAdminT,
	formatAdminDate,
	type IAdminAuditQuery,
} from '@fonderie/client';
import { useAdminAudit } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { empty, icon, pageHeader } from '../ui';
import { loadMoreButton, refreshButton, table, td } from './common';

// What happened — every workspace unless one is named. The chain's integrity
// verdict is on the Doctor page (events.integrity).
export const AuditScreen = defineComponent({
	name: 'FonderieAuditScreen',
	props: {
		client: { type: Object as PropType<AuditAdminClient>, required: true },
		pageSize: { type: Number, default: 50 },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const draft = ref({ workspaceId: '', type: '', actorId: '', from: '', to: '' });
		const query = ref<Omit<IAdminAuditQuery, 'cursor'>>({ limit: props.pageSize });
		const { events, hasMore, isLoading, error, refresh, loadMore } = useAdminAudit(
			props.client,
			query,
		);
		const field = (key: 'workspaceId' | 'type' | 'actorId', placeholder: string) =>
			h('input', {
				value: draft.value[key],
				onInput: (e: Event) =>
					(draft.value = { ...draft.value, [key]: (e.target as HTMLInputElement).value }),
				placeholder,
				style: styles.input,
				'aria-label': placeholder,
			});
		return () => {
			const t = createAdminT(props.locale);
			return h('div', { style: styles.container }, [
				pageHeader(t('audit.title'), t('audit.lead')),
				h(
					'form',
					{
						style: styles.toolbar,
						onSubmit: (e: Event) => {
							e.preventDefault();
							const d = draft.value;
							query.value = {
								limit: props.pageSize,
								...(d.workspaceId.trim() ? { workspaceId: d.workspaceId.trim() } : {}),
								...(d.type.trim() ? { type: d.type.trim() } : {}),
								...(d.actorId.trim() ? { actorId: d.actorId.trim() } : {}),
								// Dates are whole days in the operator's time zone: "to" includes that day.
								...(d.from ? { from: new Date(`${d.from}T00:00:00`) } : {}),
								...(d.to ? { to: new Date(`${d.to}T23:59:59.999`) } : {}),
							};
						},
					},
					[
						field('workspaceId', t('audit.workspacePlaceholder')),
						field('type', t('audit.typePlaceholder')),
						field('actorId', t('audit.actorPlaceholder')),
						...(['from', 'to'] as const).map((k) =>
							h('input', {
								type: 'date',
								value: draft.value[k],
								onInput: (e: Event) =>
									(draft.value = { ...draft.value, [k]: (e.target as HTMLInputElement).value }),
								style: styles.input,
								'aria-label': k === 'from' ? t('audit.fromLabel') : t('audit.toLabel'),
								title: k === 'from' ? t('audit.fromTitle') : t('audit.toTitle'),
							}),
						),
						h(
							'button',
							{ type: 'submit', style: styles.buttonPrimary, disabled: isLoading.value },
							[icon('search', 14), t('common.filter')],
						),
						refreshButton(
							t('common.refresh'),
							isLoading.value,
							() => void refresh(),
							t('common.working'),
						),
					],
				),
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				events.value.length === 0 && !isLoading.value
					? empty(t('audit.empty'), undefined, 'audit')
					: table(
							[
								t('audit.col.when'),
								t('audit.col.type'),
								t('audit.col.workspace'),
								t('audit.col.actor'),
								t('audit.col.request'),
							],
							events.value.map((e) =>
								h('tr', { key: e.id }, [
									td(formatAdminDate(e.createdAt, props.locale), styles.muted),
									td(e.type, styles.mono),
									td(String(e.payload['workspaceId'] ?? '—'), styles.mono),
									td(e.actorId ?? '—', styles.mono),
									td(e.requestId ?? '', styles.muted),
								]),
							),
						),
				isLoading.value ? h('p', { style: styles.status }, t('common.loading')) : null,
				hasMore.value && !isLoading.value
					? loadMoreButton(() => void loadMore(), t('common.loadMore'))
					: null,
			]);
		};
	},
});
