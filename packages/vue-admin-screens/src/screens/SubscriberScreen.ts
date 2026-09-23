import type { BillingAdminClient, SubscriberType } from '@fonderie/client';
import { useAdminSubscriber, useAdminSubscribers } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { table, td } from './common';

// Who is subscribed, and then: what is this one on, what does their wallet
// hold, what moved — and the one write, a manual grant, idempotency-keyed.
// Lists on arrival; typing a type and an id was only possible if you already
// knew both, which is not how anyone arrives at this page.
export const SubscriberScreen = defineComponent({
	name: 'FonderieSubscriberScreen',
	props: {
		client: { type: Object as PropType<BillingAdminClient>, required: true },
		pageSize: { type: Number, default: 50 },
	},
	setup(props) {
		const type = ref<SubscriberType>('user');
		const idInput = ref('');
		const subscriber = ref<{ type: SubscriberType; id: string } | null>(null);
		const list = useAdminSubscribers(props.client, { limit: props.pageSize });
		const { subscription, wallet, ledger, hasMoreLedger, isLoading, error, loadMoreLedger, grant } =
			useAdminSubscriber(props.client, subscriber, { limit: 20 });
		const open = (t: SubscriberType, id: string) => {
			granted.value = null;
			type.value = t;
			idInput.value = id;
			subscriber.value = { type: t, id };
		};
		const amount = ref('');
		const note = ref('');
		const granted = ref<string | null>(null);
		const input = (model: { value: string }, placeholder: string, extra: object = {}) =>
			h('input', {
				value: model.value,
				onInput: (e: Event) => (model.value = (e.target as HTMLInputElement).value),
				placeholder,
				style: { ...styles.button, cursor: 'text', ...extra },
				'aria-label': placeholder,
			});

		return () => {
			const s = subscription.value;
			const w = wallet.value;
			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Subscriber'),
				h(
					'form',
					{
						style: styles.toolbar,
						onSubmit: (e: Event) => {
							e.preventDefault();
							granted.value = null;
							subscriber.value = idInput.value.trim()
								? { type: type.value, id: idInput.value.trim() }
								: null;
						},
					},
					[
						h(
							'select',
							{
								value: type.value,
								onChange: (e: Event) =>
									(type.value = (e.target as HTMLSelectElement).value as SubscriberType),
								style: styles.button,
								'aria-label': 'Type',
							},
							[
								h('option', { value: 'user' }, 'user'),
								h('option', { value: 'workspace' }, 'workspace'),
							],
						),
						input(idInput, 'subscriber id', { minWidth: '280px' }),
						h(
							'button',
							{ type: 'submit', style: styles.button, disabled: isLoading.value },
							'Look up',
						),
						subscriber.value
							? h(
									'button',
									{
										type: 'button',
										style: styles.button,
										onClick: () => {
											subscriber.value = null;
											idInput.value = '';
											granted.value = null;
										},
									},
									'← All subscribers',
								)
							: h(
									'button',
									{
										type: 'button',
										style: styles.button,
										disabled: list.isLoading.value,
										onClick: () => void list.refresh(),
									},
									'Refresh',
								),
					],
				),
				!subscriber.value
					? h('div', [
							list.error.value
								? h('p', { style: styles.error, role: 'alert' }, list.error.value.explanation)
								: null,
							list.subscriptions.value.length === 0 && !list.isLoading.value
								? h('p', { style: styles.muted }, 'No subscribers yet.')
								: table(
										['Subscriber', 'Plan', 'Status', 'Renews'],
										list.subscriptions.value.map((sub) =>
											h('tr', { key: sub.id }, [
												td(
													h(
														'button',
														{
															type: 'button',
															style: { ...styles.navItem, padding: 0, ...styles.mono },
															onClick: () => open(sub.subscriberType, sub.subscriberId),
														},
														`${sub.subscriberType}/${sub.subscriberId}`,
													),
												),
												td(`${sub.plan} · ${sub.interval}`),
												td(
													sub.cancelAtPeriodEnd
														? [sub.status, ' ', h('span', { style: styles.badge }, 'cancels')]
														: sub.status,
												),
												td(
													sub.currentPeriodEnd
														? new Date(sub.currentPeriodEnd).toLocaleDateString()
														: h('span', { style: styles.muted }, '—'),
												),
											]),
										),
									),
							list.isLoading.value ? h('p', { style: styles.status }, 'Loading…') : null,
							list.hasMore.value && !list.isLoading.value
								? h(
										'button',
										{
											type: 'button',
											style: { ...styles.button, marginTop: '8px' },
											onClick: () => void list.loadMore(),
										},
										'Load more',
									)
								: null,
						])
					: null,
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				subscriber.value && !isLoading.value
					? [
							h('h2', { style: styles.subtitle }, 'Subscription'),
							s
								? h('table', { style: styles.table }, [
										h('tbody', [
											h('tr', [td('plan'), td([h('strong', s.plan), ` · ${s.interval}`])]),
											h('tr', [
												td('status'),
												td(`${s.status}${s.cancelAtPeriodEnd ? ' · cancels at period end' : ''}`),
											]),
											h('tr', [
												td('period'),
												td(
													`${s.currentPeriodStart ? new Date(s.currentPeriodStart).toLocaleDateString() : '—'} → ${s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—'}`,
												),
											]),
											h('tr', [td('provider'), td(s.providerSubscriptionId ?? '—', styles.mono)]),
										]),
									])
								: h('p', { style: styles.muted }, 'No subscription.'),
							h('h2', { style: styles.subtitle }, 'Wallet'),
							w
								? [
										h('p', [
											h('strong', w.balance),
											` ${w.currency} `,
											h(
												'span',
												{ style: styles.muted },
												`(granted ${w.granted ?? '0'} · purchased ${w.purchased ?? '0'}) · minor units, precision ${w.precision}`,
											),
										]),
										h(
											'form',
											{
												style: styles.toolbar,
												onSubmit: (e: Event) => {
													e.preventDefault();
													const sub = subscriber.value;
													if (!sub) return;
													const key = `admin-grant-${sub.type}-${sub.id}-${Date.now()}`;
													const amt = amount.value.trim();
													void grant({
														amount: amt,
														...(note.value ? { description: note.value } : {}),
														idempotencyKey: key,
													})
														.then(() => {
															granted.value = `Granted ${amt} ${w.currency}.`;
															amount.value = '';
															note.value = '';
														})
														.catch(() => {});
												},
											},
											[
												input(amount, 'amount (minor units)'),
												input(note, 'reason (optional)', { minWidth: '220px' }),
												h(
													'button',
													{
														type: 'submit',
														style: styles.button,
														disabled: !/^\d+$/.test(amount.value.trim()),
													},
													'Grant',
												),
												granted.value ? h('span', { style: styles.ok }, granted.value) : null,
											],
										),
										h('h2', { style: styles.subtitle }, 'Ledger'),
										ledger.value.length === 0
											? h('p', { style: styles.muted }, 'Nothing moved yet.')
											: table(
													['When', 'Kind', 'Amount', 'Note'],
													ledger.value.map((t) =>
														h('tr', { key: t.id }, [
															td(new Date(t.createdAt).toLocaleString(), styles.muted),
															td(t.type),
															td(t.amount, styles.mono),
															td(t.description ?? '', styles.muted),
														]),
													),
												),
										hasMoreLedger.value
											? h(
													'button',
													{
														type: 'button',
														style: { ...styles.button, marginTop: '8px' },
														onClick: () => void loadMoreLedger(),
													},
													'Load more',
												)
											: null,
									]
								: h(
										'p',
										{ style: styles.muted },
										'No wallet — billing has no wallet configuration.',
									),
						]
					: null,
			]);
		};
	},
});
