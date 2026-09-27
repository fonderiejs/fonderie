import {
	type AdminLocale,
	type AuthAdminClient,
	type BillingAdminClient,
	createAdminT,
	describeLocation,
	formatAdminDate,
} from '@fonderie/client';
import {
	useAdminLoginHistory,
	useAdminUser,
	useAdminUserSessions,
	useAdminUsers,
} from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { computed, defineComponent, h, ref } from 'vue';
import { statusLabel, statusTone, useSubscriptionIndex } from '../billing';
import { styles } from '../styles';
import { empty, icon, pageHeader, pill } from '../ui';
import { actionButton, loadMoreButton, refreshButton, table, td } from './common';
import { SubscriberBilling } from './SubscriberBilling';

// Who is signed up, and why can't this one log in. Lists on arrival — an
// operator who must know an address before they can see anything cannot find
// the account they are being asked about. Picking a row, or an exact email,
// opens the account: live sessions, recent sign-ins, suspend and sign-out.
export const UsersScreen = defineComponent({
	name: 'FonderieUsersScreen',
	props: {
		client: { type: Object as PropType<AuthAdminClient>, required: true },
		pageSize: { type: Number, default: 50 },
		// Given ⇒ a Plan column, and each user's plan, credits and grant form on
		// their page. Everyone has a wallet; no subscription means the free tier.
		billingClient: { type: Object as PropType<BillingAdminClient>, default: undefined },
		// Open this user on arrival (e.g. from the Subscriptions list).
		openUserId: { type: String, default: undefined },
		locale: { type: String as PropType<AdminLocale>, default: undefined },
	},
	setup(props) {
		const input = ref('');
		const email = ref('');
		const selectedId = ref(props.openUserId ?? '');
		const plans = useSubscriptionIndex(props.billingClient);
		// Soft-deleted accounts are their own view: they cannot sign in and are
		// erased by the retention purge, but until then an operator can see them.
		// One list per mode — the composable reads its query once, at setup.
		const showDeleted = ref(false);
		const activeList = useAdminUsers(props.client, { limit: props.pageSize });
		const deletedList = useAdminUsers(props.client, { limit: props.pageSize, deleted: true });
		const { user, isLoading, error, suspend, unsuspend, revokeSessions } = useAdminUser(
			props.client,
			{ email, id: selectedId },
		);
		const userId = computed(() => user.value?.id ?? null);
		const sessions = useAdminUserSessions(props.client, userId);
		const history = useAdminLoginHistory(props.client, userId, { limit: 20 });
		const showList = computed(() => !email.value && !selectedId.value);
		const tr = computed(() => createAdminT(props.locale));
		const yesNo = (v: boolean) =>
			v ? pill('ok', tr.value('common.yes')) : pill('neutral', tr.value('common.no'));
		const row = (k: string, v: unknown) => h('tr', [td(k), td(v as never)]);
		const planCell = (id: string) => {
			if (!plans.value) return h('span', { style: styles.muted }, '…');
			const sub = plans.value.get(`user/${id}`);
			if (!sub || sub.status === 'canceled')
				return h('span', { style: styles.muted }, tr.value('common.status.free'));
			return [
				h('strong', sub.plan),
				' ',
				sub.status !== 'active'
					? pill(statusTone(sub.status), statusLabel(tr.value, sub.status))
					: null,
			];
		};
		const clear = () => {
			email.value = '';
			selectedId.value = '';
			input.value = '';
		};

		return () => {
			const t = tr.value;
			const loc = props.locale;
			const u = user.value;
			const list = showDeleted.value ? deletedList : activeList;
			return h('div', { style: styles.container }, [
				pageHeader(t('users.title'), t('users.lead')),
				h(
					'form',
					{
						style: styles.toolbar,
						onSubmit: (e: Event) => {
							e.preventDefault();
							selectedId.value = '';
							email.value = input.value.trim();
						},
					},
					[
						h('input', {
							type: 'email',
							value: input.value,
							onInput: (e: Event) => (input.value = (e.target as HTMLInputElement).value),
							placeholder: t('users.emailPlaceholder'),
							style: { ...styles.input, minWidth: '280px' },
							'aria-label': t('users.emailLabel'),
						}),
						h(
							'button',
							{ type: 'submit', style: styles.buttonPrimary, disabled: isLoading.value },
							[icon('search', 14), t('common.lookUp')],
						),
						showList.value
							? refreshButton(
									t('common.refresh'),
									list.isLoading.value,
									() => void list.refresh(),
									t('common.working'),
								)
							: actionButton(
									[icon('back', 14), t('users.allUsers')],
									false,
									clear,
									styles.buttonGhost,
								),
						showList.value
							? h(
									'fieldset',
									{
										style: {
											display: 'flex',
											gap: '6px',
											border: 'none',
											margin: '0 0 0 auto',
											padding: '0',
											minWidth: '0',
										},
										'aria-label': t('users.whichAccounts'),
									},
									[false, true].map((d) =>
										h(
											'button',
											{
												key: String(d),
												type: 'button',
												'aria-pressed': showDeleted.value === d,
												onClick: () => (showDeleted.value = d),
												style: {
													...(showDeleted.value === d ? styles.buttonPrimary : styles.button),
													height: '28px',
												},
											},
											d ? t('users.deletedAccounts') : t('users.activeAccounts'),
										),
									),
								)
							: null,
					],
				),
				showList.value
					? h('div', [
							list.error.value
								? h('p', { style: styles.error, role: 'alert' }, list.error.value.explanation)
								: null,
							list.users.value.length === 0 && !list.isLoading.value
								? empty(t('users.emptyTitle'), t('users.emptyBody'), 'users')
								: table(
										props.billingClient
											? [
													t('users.col.email'),
													t('users.col.name'),
													t('users.col.plan'),
													t('users.col.created'),
													t('users.col.status'),
												]
											: [
													t('users.col.email'),
													t('users.col.name'),
													t('users.col.created'),
													t('users.col.status'),
												],
										list.users.value.map((u) =>
											h('tr', { key: u.id }, [
												td(
													h(
														'button',
														{
															type: 'button',
															style: styles.link,
															onClick: () => (selectedId.value = u.id),
														},
														u.email,
													),
												),
												td(
													`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() ||
														h('span', { style: styles.muted }, '—'),
												),
												props.billingClient ? td(planCell(u.id)) : null,
												td(formatAdminDate(u.createdAt, loc, 'date')),
												td(
													u.suspended
														? pill('warn', t('common.status.suspended'))
														: u.deletedAt
															? pill('neutral', t('common.status.deleted'))
															: pill('ok', t('common.status.active')),
												),
											]),
										),
									),
							list.isLoading.value ? h('p', { style: styles.status }, t('common.loading')) : null,
							list.hasMore.value && !list.isLoading.value
								? loadMoreButton(() => void list.loadMore(), t('common.loadMore'))
								: null,
						])
					: null,
				error.value && !(error.value.status === 404 && selectedId.value)
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							error.value.status === 404 ? t('users.noUserWithEmail') : error.value.explanation,
						)
					: null,
				// Opened by id (e.g. from Subscriptions) and the account is gone —
				// deleted or purged — while its billing rows remain. Say so, and
				// still show the money.
				error.value?.status === 404 && selectedId.value
					? [
							h('div', { style: styles.notice, role: 'status' }, [
								h('strong', `${t('users.missingIdPrefix')} `),
								h('code', { style: styles.code }, selectedId.value),
								h('strong', '.'),
								` ${t('users.missingIdBody')}`,
							]),
							props.billingClient
								? h('h2', { style: styles.subtitle }, t('users.planCredits'))
								: null,
							props.billingClient
								? h(SubscriberBilling, {
										key: `missing-${selectedId.value}`,
										client: props.billingClient,
										subscriberType: 'user',
										subscriberId: selectedId.value,
										...(loc ? { locale: loc } : {}),
									})
								: null,
						]
					: null,
				u
					? [
							h('h2', { style: styles.subtitle }, [
								u.firstName || u.lastName ? `${u.firstName} ${u.lastName}`.trim() : u.email,
								' ',
								u.suspended ? pill('warn', t('common.status.suspended')) : null,
								u.deletedAt ? pill('neutral', t('common.status.deleted')) : null,
							]),
							h('table', { style: styles.table }, [
								h('tbody', [
									row(t('users.field.id'), h('span', { style: styles.mono }, u.id)),
									row(t('users.field.email'), [
										u.email,
										` · ${t('users.field.verified')} `,
										yesNo(u.isEmailVerified),
									]),
									row(t('users.field.mfa'), yesNo(u.mfaEnabled)),
									row(
										t('users.field.provider'),
										`${u.provider || t('users.passwordProvider')}${u.hasPassword ? '' : ` · ${t('users.noPasswordSet')}`}`,
									),
									row(
										t('users.field.lastLogin'),
										u.lastLogin
											? formatAdminDate(u.lastLogin, loc)
											: h('span', { style: styles.muted }, t('common.never')),
									),
									row(t('users.field.created'), formatAdminDate(u.createdAt, loc)),
								]),
							]),
							u.deletedAt
								? h('div', { style: { ...styles.notice, marginTop: '12px' }, role: 'status' }, [
										h('strong', t('users.deletedOn', { date: formatAdminDate(u.deletedAt, loc) })),
										` ${t('users.deletedBody')}`,
									])
								: h('div', { style: { ...styles.toolbar, marginTop: '12px' } }, [
										u.suspended
											? actionButton(t('users.unsuspend'), isLoading.value, () => void unsuspend())
											: actionButton(
													t('users.suspend'),
													isLoading.value,
													() => void suspend(),
													styles.buttonDanger,
												),
										actionButton(
											t('users.signOutEverywhere'),
											isLoading.value,
											() => void revokeSessions().then(() => sessions.refresh()),
										),
									]),
							props.billingClient
								? h('h2', { style: styles.subtitle }, t('users.planCredits'))
								: null,
							props.billingClient
								? h(SubscriberBilling, {
										key: u.id,
										client: props.billingClient,
										subscriberType: 'user',
										subscriberId: u.id,
										...(loc ? { locale: loc } : {}),
									})
								: null,
							u.deletedAt
								? null
								: [
										h('h2', { style: styles.subtitle }, t('users.liveSessions')),
										sessions.sessions.value.length === 0
											? h('p', { style: styles.muted }, t('common.none'))
											: h(
													'ul',
													{ style: styles.list },
													sessions.sessions.value.map((s) =>
														h('li', { key: s.id, style: styles.row }, [
															h('span', { style: styles.mono }, s.ipAddress ?? '—'),
															' ',
															h(
																'span',
																{ style: styles.muted },
																describeLocation(s.location) ?? '',
															),
															' ',
															h('span', { style: styles.muted }, s.userAgent ?? ''),
															' ',
															h(
																'span',
																{ style: styles.muted },
																t('users.since', { date: formatAdminDate(s.createdAt, loc) }),
															),
														]),
													),
												),
										h('h2', { style: styles.subtitle }, t('users.recentSignIns')),
										history.events.value.length === 0 && !history.isLoading.value
											? h('p', { style: styles.muted }, t('users.noneRecorded'))
											: h(
													'ul',
													{ style: styles.list },
													history.events.value.map((e) =>
														h('li', { key: e.id, style: styles.row }, [
															pill(
																e.outcome === 'success' ? 'ok' : 'bad',
																e.outcome === 'success'
																	? t('users.outcome.success')
																	: e.outcome === 'failure'
																		? t('users.outcome.failure')
																		: e.outcome,
															),
															' ',
															h('span', { style: styles.muted }, e.method),
															' ',
															h('span', { style: styles.mono }, e.ipAddress ?? '—'),
															' ',
															h(
																'span',
																{ style: styles.muted },
																describeLocation(e.location) ?? '',
															),
															e.location?.proxy || e.location?.hosting
																? [
																		' ',
																		pill(
																			'warn',
																			e.location.proxy ? t('users.proxyVpn') : t('users.hosting'),
																		),
																	]
																: '',
															' ',
															h('span', { style: styles.muted }, formatAdminDate(e.createdAt, loc)),
														]),
													),
												),
										history.hasMore.value && !history.isLoading.value
											? loadMoreButton(() => void history.loadMore(), t('common.loadMore'))
											: null,
									],
						]
					: null,
			]);
		};
	},
});
