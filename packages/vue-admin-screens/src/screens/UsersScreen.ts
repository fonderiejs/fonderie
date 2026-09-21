import type { AuthAdminClient } from '@fonderie/client';
import { useAdminLoginHistory, useAdminUser, useAdminUserSessions } from '@fonderie/vue-admin';
import type { PropType } from 'vue';
import { computed, defineComponent, h, ref } from 'vue';
import { styles } from '../styles';
import { refreshButton, td } from './common';

// Why can't this person log in. Look up by email, see the account, its live
// sessions and recent sign-ins; suspend, unsuspend, or sign them out everywhere.
export const UsersScreen = defineComponent({
	name: 'FonderieUsersScreen',
	props: { client: { type: Object as PropType<AuthAdminClient>, required: true } },
	setup(props) {
		const input = ref('');
		const email = ref('');
		const { user, isLoading, error, suspend, unsuspend, revokeSessions } = useAdminUser(
			props.client,
			{ email },
		);
		const userId = computed(() => user.value?.id ?? null);
		const sessions = useAdminUserSessions(props.client, userId);
		const history = useAdminLoginHistory(props.client, userId, { limit: 20 });
		const yesNo = (v: boolean) =>
			h('span', { style: v ? styles.ok : styles.muted }, v ? 'yes' : 'no');
		const row = (k: string, v: unknown) => h('tr', [td(k), td(v as never)]);

		return () => {
			const u = user.value;
			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Users'),
				h(
					'form',
					{
						style: styles.toolbar,
						onSubmit: (e: Event) => {
							e.preventDefault();
							email.value = input.value.trim();
						},
					},
					[
						h('input', {
							type: 'email',
							value: input.value,
							onInput: (e: Event) => (input.value = (e.target as HTMLInputElement).value),
							placeholder: 'email address',
							style: { ...styles.button, cursor: 'text', minWidth: '280px' },
							'aria-label': 'Email',
						}),
						h(
							'button',
							{ type: 'submit', style: styles.button, disabled: isLoading.value },
							'Look up',
						),
					],
				),
				error.value
					? h(
							'p',
							{ style: styles.error, role: 'alert' },
							error.value.status === 404 ? 'No user with that email.' : error.value.explanation,
						)
					: null,
				u
					? [
							h('h2', { style: styles.subtitle }, [
								u.firstName || u.lastName ? `${u.firstName} ${u.lastName}`.trim() : u.email,
								' ',
								u.suspended ? h('span', { style: styles.badge }, 'suspended') : null,
								u.deletedAt ? h('span', { style: styles.badge }, 'deleted') : null,
							]),
							h('table', { style: styles.table }, [
								h('tbody', [
									row('id', h('span', { style: styles.mono }, u.id)),
									row('email', [u.email, ' · verified ', yesNo(u.isEmailVerified)]),
									row('MFA', yesNo(u.mfaEnabled)),
									row(
										'provider',
										`${u.provider || 'password'}${u.hasPassword ? '' : ' · no password set'}`,
									),
									row(
										'last login',
										u.lastLogin
											? new Date(u.lastLogin).toLocaleString()
											: h('span', { style: styles.muted }, 'never'),
									),
									row('created', new Date(u.createdAt).toLocaleString()),
								]),
							]),
							h('div', { style: { ...styles.toolbar, marginTop: '12px' } }, [
								u.suspended
									? refreshButton('Unsuspend', isLoading.value, () => void unsuspend())
									: refreshButton('Suspend', isLoading.value, () => void suspend()),
								refreshButton(
									'Sign out everywhere',
									isLoading.value,
									() => void revokeSessions().then(() => sessions.refresh()),
								),
							]),
							h('h2', { style: styles.subtitle }, 'Live sessions'),
							sessions.sessions.value.length === 0
								? h('p', { style: styles.muted }, 'None.')
								: h(
										'ul',
										{ style: styles.list },
										sessions.sessions.value.map((s) =>
											h('li', { key: s.id, style: styles.row }, [
												h('span', { style: styles.mono }, s.ipAddress ?? '—'),
												' ',
												h('span', { style: styles.muted }, s.userAgent ?? ''),
												' ',
												h(
													'span',
													{ style: styles.muted },
													`since ${new Date(s.createdAt).toLocaleString()}`,
												),
											]),
										),
									),
							h('h2', { style: styles.subtitle }, 'Recent sign-ins'),
							history.events.value.length === 0 && !history.isLoading.value
								? h('p', { style: styles.muted }, 'None recorded.')
								: h(
										'ul',
										{ style: styles.list },
										history.events.value.map((e) =>
											h('li', { key: e.id, style: styles.row }, [
												h(
													'span',
													{ style: e.outcome === 'success' ? styles.ok : styles.bad },
													e.outcome,
												),
												' ',
												h('span', { style: styles.muted }, e.method),
												' ',
												h('span', { style: styles.muted }, new Date(e.createdAt).toLocaleString()),
											]),
										),
									),
							history.hasMore.value && !history.isLoading.value
								? h(
										'button',
										{
											type: 'button',
											style: { ...styles.button, marginTop: '8px' },
											onClick: () => void history.loadMore(),
										},
										'Load more',
									)
								: null,
						]
					: null,
			]);
		};
	},
});
