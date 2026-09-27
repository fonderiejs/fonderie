import type { BillingAdminClient, SubscriberType } from '@fonderie/client';
import { useAdminSubscribers } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { periodEnd, statusTone } from '../billing';
import { styles } from '../styles';
import { empty, icon, pageHeader, pill, refreshButton } from '../ui';
import { loadMoreButton, table, td } from './common';
import { SubscriberBilling } from './SubscriberBilling';

const FILTERS: Array<{ label: string; match: (status: string) => boolean }> = [
	{ label: 'All', match: () => true },
	{ label: 'Active', match: (s) => s === 'active' },
	{ label: 'Trialing', match: (s) => s === 'trialing' },
	{ label: 'Past due', match: (s) => s === 'past_due' || s === 'unpaid' },
	{ label: 'Canceled', match: (s) => s === 'canceled' },
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
	},
	setup(props) {
		const list = useAdminSubscribers(props.client, { limit: props.pageSize });
		const filter = ref('All');
		const open = ref<{ type: SubscriberType; id: string } | null>(null);
		const type = ref<SubscriberType>('workspace');
		const idInput = ref('');
		const openRow = (t: SubscriberType, id: string) => {
			if (t === 'user' && props.onOpenUser) props.onOpenUser(id);
			else open.value = { type: t, id };
		};

		return () => {
			const o = open.value;
			if (o) {
				return h('div', { style: styles.container }, [
					pageHeader(`${o.type}/${o.id}`, 'Plan, credits and what moved.', [
						h(
							'button',
							{ type: 'button', style: styles.buttonGhost, onClick: () => (open.value = null) },
							[icon('back', 14), 'All subscriptions'],
						),
					]),
					h(SubscriberBilling, {
						key: `${o.type}/${o.id}`,
						client: props.client,
						subscriberType: o.type,
						subscriberId: o.id,
					}),
				]);
			}
			const match = FILTERS.find((f) => f.label === filter.value)?.match ?? (() => true);
			const rows = list.subscriptions.value.filter((s) => match(s.status));
			return h('div', { style: styles.container }, [
				pageHeader(
					'Subscriptions',
					"Who pays, and who is behind. A user's plan and credits are also on their page under Users — free users appear only there.",
					[refreshButton(() => void list.refresh(), list.isLoading.value)],
				),
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
							'aria-label': 'Filter by status',
						},
						FILTERS.map((f) => {
							const n = list.subscriptions.value.filter((s) => f.match(s.status)).length;
							const on = filter.value === f.label;
							return h(
								'button',
								{
									key: f.label,
									type: 'button',
									'aria-pressed': on,
									onClick: () => (filter.value = f.label),
									style: { ...(on ? styles.buttonPrimary : styles.button), height: '28px' },
								},
								[f.label, h('span', { style: { opacity: 0.7 } }, String(n))],
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
									'aria-label': 'Type',
								},
								[
									h('option', { value: 'workspace' }, 'workspace'),
									h('option', { value: 'user' }, 'user'),
								],
							),
							h('input', {
								value: idInput.value,
								onInput: (e: Event) => (idInput.value = (e.target as HTMLInputElement).value),
								placeholder: 'subscriber id',
								style: { ...styles.input, width: '220px' },
								'aria-label': 'Subscriber id',
							}),
							h(
								'button',
								{ type: 'submit', style: styles.button, disabled: !idInput.value.trim() },
								[icon('search', 14), 'Open'],
							),
						],
					),
				]),
				list.error.value
					? h('p', { style: styles.error, role: 'alert' }, list.error.value.explanation)
					: null,
				rows.length === 0 && !list.isLoading.value
					? empty(
							filter.value === 'All'
								? 'No subscriptions yet'
								: `No ${filter.value.toLowerCase()} subscriptions`,
							'Subscriptions appear here once someone checks out.',
							'subscriber',
						)
					: table(
							['Subscriber', 'Plan', 'Status', 'Renews / ends'],
							rows.map((s) => {
								const end = periodEnd(s);
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
										h('span', { style: styles.muted }, `· ${s.interval}`),
									]),
									td([
										pill(statusTone(s.status), s.status),
										s.cancelAtPeriodEnd && s.status !== 'canceled'
											? h('span', [' ', pill('warn', 'cancels', false)])
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
				list.isLoading.value ? h('p', { style: styles.status }, 'Loading…') : null,
				list.hasMore.value && !list.isLoading.value
					? loadMoreButton(() => void list.loadMore())
					: null,
			]);
		};
	},
});
