import type { BillingAdminClient, SubscriberType } from '@fonderie/client';
import { useAdminSubscriber } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { computed, defineComponent, h, ref } from 'vue';
import { periodEnd, statusTone } from '../billing';
import { styles } from '../styles';
import { empty, icon, pill } from '../ui';
import { loadMoreButton, table, td } from './common';

// One subscriber's money: plan, wallet, the one write (a grant,
// idempotency-keyed) and what moved. Used on a user's page and for workspace
// subscribers. A subscription is NOT required: everyone has a wallet, and a
// user with no subscription is on the free tier.
export const SubscriberBilling = defineComponent({
	name: 'FonderieSubscriberBilling',
	props: {
		client: { type: Object as PropType<BillingAdminClient>, required: true },
		subscriberType: { type: String as PropType<SubscriberType>, required: true },
		subscriberId: { type: String, required: true },
	},
	setup(props) {
		const subscriber = computed(() => ({ type: props.subscriberType, id: props.subscriberId }));
		const { subscription, wallet, ledger, hasMoreLedger, isLoading, error, loadMoreLedger, grant } =
			useAdminSubscriber(props.client, subscriber, { limit: 20 });
		const amount = ref('');
		const note = ref('');
		const granted = ref<string | null>(null);

		return () => {
			const s = subscription.value;
			const w = wallet.value;
			if (isLoading.value && !w && !s) return h('p', { style: styles.status }, 'Loading billing…');
			const end = s ? periodEnd(s) : null;
			return h('div', [
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				h('div', { style: { ...styles.grid, marginBottom: '16px' } }, [
					h('div', { style: styles.card }, [
						h('div', { style: styles.statLabel }, 'Plan'),
						h(
							'div',
							{
								style: {
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
									marginTop: '6px',
									flexWrap: 'wrap',
								},
							},
							[
								h('strong', { style: { fontSize: '18px' } }, s ? s.plan : 'Free'),
								...(s
									? [
											h('span', { style: styles.muted }, `· ${s.interval}`),
											pill(statusTone(s.status), s.status),
										]
									: [h('span', { style: styles.muted }, 'no subscription')]),
							],
						),
						end ? h('div', { style: styles.statHint }, `${end.label} ${end.date}`) : null,
						s?.providerSubscriptionId
							? h(
									'div',
									{ style: { ...styles.statHint, fontFamily: 'var(--fonderie-mono,monospace)' } },
									s.providerSubscriptionId,
								)
							: null,
					]),
					h('div', { style: styles.card }, [
						h('div', { style: styles.statLabel }, 'Credits'),
						...(w
							? [
									h('div', { style: styles.statValue }, [
										`${w.balance} `,
										h('span', { style: { fontSize: '14px', fontWeight: 500 } }, w.currency),
									]),
									h(
										'div',
										{ style: styles.statHint },
										`${w.purchased ?? '0'} permanent · ${w.granted ?? '0'} plan allowance${w.grantedExpiresAt ? ` (expires ${new Date(w.grantedExpiresAt).toLocaleDateString()})` : ''}`,
									),
								]
							: [
									h(
										'div',
										{ style: styles.statHint },
										'No wallet — billing has no wallet configuration.',
									),
								]),
					]),
				]),
				w
					? h(
							'form',
							{
								style: {
									...styles.card,
									display: 'flex',
									gap: '8px',
									alignItems: 'center',
									flexWrap: 'wrap',
									marginBottom: '16px',
								},
								onSubmit: (e: Event) => {
									e.preventDefault();
									const key = `admin-grant-${props.subscriberType}-${props.subscriberId}-${Date.now()}`;
									const a = amount.value.trim();
									void grant({
										amount: a,
										...(note.value ? { description: note.value } : {}),
										idempotencyKey: key,
									})
										.then(() => {
											granted.value = `Granted ${a} ${w.currency}.`;
											amount.value = '';
											note.value = '';
										})
										.catch(() => {});
								},
							},
							[
								h('strong', { style: { fontSize: '13.5px', marginRight: '4px' } }, 'Grant credits'),
								h('input', {
									value: amount.value,
									onInput: (e: Event) => (amount.value = (e.target as HTMLInputElement).value),
									placeholder: `amount (${w.currency})`,
									inputmode: 'numeric',
									style: { ...styles.input, width: '150px' },
									'aria-label': 'Amount',
								}),
								h('input', {
									value: note.value,
									onInput: (e: Event) => (note.value = (e.target as HTMLInputElement).value),
									placeholder: 'reason (optional)',
									style: { ...styles.input, flex: 1, minWidth: '180px' },
									'aria-label': 'Reason',
								}),
								h(
									'button',
									{
										type: 'submit',
										style: styles.buttonPrimary,
										disabled: !/^\d+$/.test(amount.value.trim()),
									},
									[icon('plus', 14), 'Grant'],
								),
								granted.value ? h('span', { style: styles.ok }, granted.value) : null,
							],
						)
					: null,
				w
					? ledger.value.length === 0
						? empty('No credit movements yet', undefined, 'subscriber')
						: h('div', [
								table(
									['When', 'Kind', 'Amount', 'Note'],
									ledger.value.map((t) =>
										h('tr', { key: t.id }, [
											td(new Date(t.createdAt).toLocaleString(), {
												...styles.muted,
												whiteSpace: 'nowrap',
											}),
											td(t.type),
											td(t.amount, styles.mono),
											td(t.description ?? '', styles.muted),
										]),
									),
								),
								hasMoreLedger.value ? loadMoreButton(() => void loadMoreLedger()) : null,
							])
					: null,
			]);
		};
	},
});
