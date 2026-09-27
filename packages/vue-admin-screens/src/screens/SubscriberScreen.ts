import {
	type AdminLocale,
	type BillingAdminClient,
	createAdminT,
	type SubscriberType,
} from '@fonderie/client';
import { useAdminSubscribers } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { intervalLabel, periodEnd, statusLabel, statusTone } from '../billing';
import { styles } from '../styles';
import { empty, icon, pageHeader, pill, refreshButton } from '../ui';
import { loadMoreButton, table, td } from './common';
import { SubscriberBilling } from './SubscriberBilling';

type FilterId = 'all' | 'active' | 'trialing' | 'pastDue' | 'canceled';
const FILTERS: Array<{ id: FilterId; match: (status: string) => boolean }> = [
	{ id: 'all', match: () => true },
	{ id: 'active', match: (s) => s === 'active' },
	{ id: 'trialing', match: (s) => s === 'trialing' },
	{ id: 'pastDue', match: (s) => s === 'past_due' || s === 'unpaid' },
	{ id: 'canceled', match: (s) => s === 'canceled' },
];

// Who pays, and who is behind. A money list: plans and statuses across users
// and workspaces. A user's own billing (plan, credits, grants) is on their
// page under Users; free users have no subscription and appear only there.
export const SubscriberScreen = defineComponent({
	name: 'FonderieSubscriberScreen',
	props: {
		client: { type: Object as PropType<BillingAdminClient>, required: true },
		pageSize: { type: Number, default: 50 },
		/**
		 * A user subscriber opens on the Users page, where their plan and credits
		 * live beside their account. Omit to open everything here.
		 */
		onOpenUser: { type: Function as PropType<(userId: string) => void>, default: undefined },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const list = useAdminSubscribers(props.client, { limit: props.pageSize });
		const filter = ref<FilterId>('all');
		const open = ref<{ type: SubscriberType; id: string } | null>(null);
		const type = ref<SubscriberType>('workspace');
		const idInput = ref('');
		const openRow = (t: SubscriberType, id: string) => {
			if (t === 'user' && props.onOpenUser) props.onOpenUser(id);
			else open.value = { type: t, id };
		};

		return () => {
			const t = createAdminT(props.locale);
			const loc = props.locale ? { locale: props.locale } : {};
			const o = open.value;
			if (o) {
				return h('div', { style: styles.container }, [
					pageHeader(`${o.type}/${o.id}`, t('billing.subscriptions.detailLead'), [
						h(
							'button',
							{ type: 'button', style: styles.buttonGhost, onClick: () => (open.value = null) },
							[icon('back', 14), t('billing.subscriptions.back')],
						),
					]),
					h(SubscriberBilling, {
						key: `${o.type}/${o.id}`,
						client: props.client,
						subscriberType: o.type,
						subscriberId: o.id,
						...loc,
					}),
				]);
			}
			const match = FILTERS.find((f) => f.id === filter.value)?.match ?? (() => true);
			const rows = list.subscriptions.value.filter((s) => match(s.status));
			return h('div', { style: styles.container }, [
				pageHeader(t('billing.subscriptions.title'), t('billing.subscriptions.lead'), [
					refreshButton(
						() => void list.refresh(),
						list.isLoading.value,
						t('common.refresh'),
						t('common.working'),
					),
				]),
				h('div', { style: { ...styles.toolbar, justifyContent: 'space-between' } }, [
					h(
						'fieldset',
						{
							style: {
								display: 'flex',
								gap: '6px',
								flexWrap: 'wrap',
								border: 'none',
								margin: 0,
								padding: 0,
								minWidth: 0,
							},
							'aria-label': t('billing.subscriptions.filterLabel'),
						},
						FILTERS.map((f) => {
							const n = list.subscriptions.value.filter((s) => f.match(s.status)).length;
							const on = filter.value === f.id;
							return h(
								'button',
								{
									key: f.id,
									type: 'button',
									'aria-pressed': on,
									onClick: () => (filter.value = f.id),
									style: { ...(on ? styles.buttonPrimary : styles.button), height: '28px' },
								},
								[
									t(`billing.subscriptions.filter.${f.id}`),
									h('span', { style: { opacity: 0.7 } }, String(n)),
								],
							);
						}),
					),
					h(
						'form',
						{
							style: { display: 'flex', gap: '6px' },
							onSubmit: (e: Event) => {
								e.preventDefault();
								if (idInput.value.trim()) openRow(type.value, idInput.value.trim());
							},
						},
						[
							h(
								'select',
								{
									value: type.value,
									onChange: (e: Event) =>
										(type.value = (e.target as HTMLSelectElement).value as SubscriberType),
									style: styles.input,
									'aria-label': t('billing.subscriptions.typeLabel'),
								},
								[
									h('option', { value: 'workspace' }, t('billing.subscriptions.typeWorkspace')),
									h('option', { value: 'user' }, t('billing.subscriptions.typeUser')),
								],
							),
							h('input', {
								value: idInput.value,
								onInput: (e: Event) => (idInput.value = (e.target as HTMLInputElement).value),
								placeholder: t('billing.subscriptions.idPlaceholder'),
								style: { ...styles.input, width: '220px' },
								'aria-label': t('billing.subscriptions.idLabel'),
							}),
							h(
								'button',
								{ type: 'submit', style: styles.button, disabled: !idInput.value.trim() },
								[icon('search', 14), t('common.open')],
							),
						],
					),
				]),
				list.error.value
					? h('p', { style: styles.error, role: 'alert' }, list.error.value.explanation)
					: null,
				rows.length === 0 && !list.isLoading.value
					? empty(
							t(`billing.subscriptions.empty.${filter.value}`),
							t('billing.subscriptions.emptyHint'),
							'subscriber',
						)
					: table(
							[
								t('billing.subscriptions.col.subscriber'),
								t('billing.subscriptions.col.plan'),
								t('billing.subscriptions.col.status'),
								t('billing.subscriptions.col.renewsEnds'),
							],
							rows.map((s) => {
								const end = periodEnd(s, props.locale);
								return h('tr', { key: s.id }, [
									td(
										h(
											'button',
											{
												type: 'button',
												style: { ...styles.link, ...styles.mono },
												onClick: () => openRow(s.subscriberType, s.subscriberId),
											},
											`${s.subscriberType}/${s.subscriberId}`,
										),
									),
									td([
										h('strong', s.plan),
										' ',
										h('span', { style: styles.muted }, `· ${intervalLabel(t, s.interval)}`),
									]),
									td([
										pill(statusTone(s.status), statusLabel(t, s.status)),
										s.cancelAtPeriodEnd && s.status !== 'canceled'
											? h('span', [' ', pill('warn', t('billing.subscriptions.cancels'), false)])
											: null,
									]),
									td(
										end
											? [h('span', { style: styles.muted }, end.label), ` ${end.date}`]
											: h('span', { style: styles.muted }, '—'),
										{ whiteSpace: 'nowrap' },
									),
								]);
							}),
						),
				list.isLoading.value ? h('p', { style: styles.status }, t('common.loading')) : null,
				list.hasMore.value && !list.isLoading.value
					? loadMoreButton(() => void list.loadMore(), t('common.loadMore'))
					: null,
			]);
		};
	},
});
