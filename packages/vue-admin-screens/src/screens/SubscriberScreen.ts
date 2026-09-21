import type { BillingAdminClient, SubscriberType } from '@fonderie/client';
import { useAdminSubscriber } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { table, td } from './common';

// What is this subscriber on, what does their wallet hold, what moved — and
// the one write: a manual grant, idempotency-keyed.
export const SubscriberScreen = defineComponent({
	name: 'FonderieSubscriberScreen',
	props: { client: { type: Object as PropType<BillingAdminClient>, required: true } },
	setup(props) {
		const type = ref<SubscriberType>('user');
		const idInput = ref('');
		const subscriber = ref<{ type: SubscriberType; id: string } | null>(null);
		const { subscription, wallet, ledger, hasMoreLedger, isLoading, error, loadMoreLedger, grant } =
			useAdminSubscriber(props.client, subscriber, { limit: 20 });
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
					],
				),
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
