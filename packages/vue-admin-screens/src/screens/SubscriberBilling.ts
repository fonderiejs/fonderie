import {
	type AdminLocale,
	type BillingAdminClient,
	createAdminT,
	formatAdminDate,
	type SubscriberType,
} from '@fonderie/client';
import { useAdminSubscriber } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { computed, defineComponent, h, ref } from 'vue';
import { intervalLabel, periodEnd, statusLabel, statusTone } from '../billing';
import { styles } from '../styles';
import { empty, icon, pill } from '../ui';
import { loadMoreButton, table, td } from './common';

const LEDGER_KINDS = ['purchase', 'grant', 'usage', 'refund', 'adjustment', 'expiry'] as const;

// One subscriber's money: plan, wallet, the one write (a grant,
// idempotency-keyed) and what moved. Used on a user's page and for workspace
// subscribers. A subscription is NOT required: everyone has a wallet, and a
// user with no subscription is on the free tier.
const SubscriberBillingInner = defineComponent({
	name: 'FonderieSubscriberBillingInner',
	props: {
		client: { type: Object as PropType<BillingAdminClient>, required: true },
		subscriberType: { type: String as PropType<SubscriberType>, required: true },
		subscriberId: { type: String, required: true },
		currency: { type: String, default: '' },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	emits: { 'change-currency': (_currency: string) => true },
	setup(props, { emit }) {
		const subscriber = computed(() => ({ type: props.subscriberType, id: props.subscriberId }));
		const { subscription, wallet, ledger, hasMoreLedger, isLoading, error, loadMoreLedger, grant } =
			useAdminSubscriber(props.client, subscriber, {
				limit: 20,
				...(props.currency ? { currency: props.currency } : {}),
			});
		const currencyDraft = ref(props.currency);
		const amount = ref('');
		const note = ref('');
		const granted = ref<string | null>(null);

		return () => {
			const t = createAdminT(props.locale);
			const ledgerKind = (kind: string) =>
				(LEDGER_KINDS as readonly string[]).includes(kind)
					? t(`billing.ledgerKind.${kind as (typeof LEDGER_KINDS)[number]}`)
					: kind;
			const s = subscription.value;
			const w = wallet.value;
			if (isLoading.value && !w && !s)
				return h('p', { style: styles.status }, t('billing.loading'));
			const end = s ? periodEnd(s, props.locale) : null;
			return h('div', [
				error.value
					? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
					: null,
				h('div', { style: { ...styles.grid, marginBottom: '16px' } }, [
					h('div', { style: styles.card }, [
						h('div', { style: styles.statLabel }, t('billing.plan')),
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
								h('strong', { style: { fontSize: '18px' } }, s ? s.plan : t('billing.free')),
								...(s
									? [
											h('span', { style: styles.muted }, `· ${intervalLabel(t, s.interval)}`),
											pill(statusTone(s.status), statusLabel(t, s.status)),
										]
									: [h('span', { style: styles.muted }, t('billing.noSubscription'))]),
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
						h(
							'div',
							{
								style: {
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									gap: '8px',
								},
							},
							[
								h('div', { style: styles.statLabel }, t('billing.credits')),
								h(
									'form',
									{
										style: { display: 'flex', gap: '4px' },
										onSubmit: (e: Event) => {
											e.preventDefault();
											emit('change-currency', currencyDraft.value.trim().toUpperCase());
										},
									},
									[
										h('input', {
											value: currencyDraft.value,
											onInput: (e: Event) => {
												currencyDraft.value = (e.target as HTMLInputElement).value;
											},
											placeholder: w?.currency ?? t('billing.currencyPlaceholder'),
											maxlength: 8,
											style: { ...styles.input, height: '26px', width: '84px', fontSize: '12px' },
											'aria-label': t('billing.currencyLabel'),
											title: t('billing.currencyTitle'),
										}),
									],
								),
							],
						),
						...(w
							? [
									h('div', { style: styles.statValue }, [
										`${w.balance} `,
										h('span', { style: { fontSize: '14px', fontWeight: 500 } }, w.currency),
									]),
									h(
										'div',
										{ style: styles.statHint },
										`${t('billing.breakdown', { permanent: w.purchased ?? '0', allowance: w.granted ?? '0' })}${
											w.grantedExpiresAt
												? t('billing.expires', {
														date: formatAdminDate(w.grantedExpiresAt, props.locale, 'date'),
													})
												: ''
										}`,
									),
								]
							: [h('div', { style: styles.statHint }, t('billing.noWallet'))]),
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
											granted.value = t('billing.granted', { amount: a, currency: w.currency });
											amount.value = '';
											note.value = '';
										})
										.catch(() => {});
								},
							},
							[
								h(
									'strong',
									{ style: { fontSize: '13.5px', marginRight: '4px' } },
									t('billing.grantCredits'),
								),
								h('input', {
									value: amount.value,
									onInput: (e: Event) => (amount.value = (e.target as HTMLInputElement).value),
									placeholder: t('billing.amountPlaceholder', { currency: w.currency }),
									inputmode: 'numeric',
									style: { ...styles.input, width: '150px' },
									'aria-label': t('billing.amountLabel'),
								}),
								h('input', {
									value: note.value,
									onInput: (e: Event) => (note.value = (e.target as HTMLInputElement).value),
									placeholder: t('billing.reasonPlaceholder'),
									style: { ...styles.input, flex: 1, minWidth: '180px' },
									'aria-label': t('billing.reasonLabel'),
								}),
								h(
									'button',
									{
										type: 'submit',
										style: styles.buttonPrimary,
										disabled: !/^\d+$/.test(amount.value.trim()),
									},
									[icon('plus', 14), t('billing.grant')],
								),
								granted.value ? h('span', { style: styles.ok }, granted.value) : null,
							],
						)
					: null,
				w
					? ledger.value.length === 0
						? empty(t('billing.noMovements'), undefined, 'subscriber')
						: h('div', [
								table(
									[
										t('billing.col.when'),
										t('billing.col.kind'),
										t('billing.col.amount'),
										t('billing.col.note'),
									],
									ledger.value.map((tx) =>
										h('tr', { key: tx.id }, [
											td(formatAdminDate(tx.createdAt, props.locale), {
												...styles.muted,
												whiteSpace: 'nowrap',
											}),
											td(ledgerKind(tx.type)),
											td(tx.amount, styles.mono),
											td(tx.description ?? '', styles.muted),
										]),
									),
								),
								hasMoreLedger.value
									? loadMoreButton(() => void loadMoreLedger(), t('common.loadMore'))
									: null,
							])
					: null,
			]);
		};
	},
});

// A wallet exists per currency. Empty ⇒ the billing default; submitting another
// (e.g. EUR) reads that wallet instead — same as the CLI's --currency. The
// composable reads its options once, so a currency change remounts the inner view.
export const SubscriberBilling = defineComponent({
	name: 'FonderieSubscriberBilling',
	props: {
		client: { type: Object as PropType<BillingAdminClient>, required: true },
		subscriberType: { type: String as PropType<SubscriberType>, required: true },
		subscriberId: { type: String, required: true },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const currency = ref('');
		return () =>
			h(SubscriberBillingInner, {
				key: `${props.subscriberType}:${props.subscriberId}:${currency.value}`,
				client: props.client,
				subscriberType: props.subscriberType,
				subscriberId: props.subscriberId,
				currency: currency.value,
				...(props.locale ? { locale: props.locale } : {}),
				'onChange-currency': (c: string) => {
					currency.value = c;
				},
			});
	},
});
