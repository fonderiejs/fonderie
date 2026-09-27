import type { CourierAdminClient, ITemplateEntry } from '@fonderie/client';
import { useTemplates } from '@fonderie/vue-courier-admin';
import type { CSSProperties, PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';

const builtIn: CSSProperties = {
	fontSize: '11px',
	fontWeight: 500,
	padding: '1px 7px',
	borderRadius: '999px',
	border: '1px solid var(--fonderie-border,#e0e0e0)',
	color: 'var(--fonderie-text-muted,#5c5c5c)',
};
const newButton: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	height: '32px',
	boxSizing: 'border-box',
	borderRadius: '6px',
	padding: '0 12px',
	fontSize: '13px',
	fontWeight: 500,
	fontFamily: 'inherit',
	cursor: 'pointer',
	backgroundColor: 'var(--fonderie-text,#171717)',
	color: 'var(--fonderie-surface,#fff)',
	border: '1px solid var(--fonderie-text,#171717)',
};

export const TemplateListScreen = defineComponent({
	name: 'FonderieTemplateListScreen',
	props: {
		client: { type: Object as PropType<CourierAdminClient>, required: true },
		/** Shows a "New template" button (emits create-template). */
		allowCreate: { type: Boolean, default: false },
	},
	emits: {
		/** The whole row — type AND locale, and whether it is built-in. */
		'select-template': (_template: ITemplateEntry) => true,
		/** Receives the locales in use, to suggest. */
		'create-template': (_context: { locales: string[] }) => true,
	},
	setup(props, { emit }) {
		const { templates, isLoading, error } = useTemplates(props.client);

		function renderRow(template: ITemplateEntry) {
			return h('li', { key: `${template.type}:${template.locale ?? 'base'}`, style: styles.row }, [
				h(
					'button',
					{
						type: 'button',
						style: styles.rowButton,
						onClick: () => emit('select-template', template),
					},
					[
						h('span', { style: styles.type }, template.type),
						h('span', { style: styles.locale }, template.locale ?? 'default locale'),
						template.system ? h('span', { style: builtIn }, 'built-in') : null,
						h('span', { style: template.active ? styles.active : styles.inactive }, [
							h('span', { style: styles.dot }),
							template.active ? 'active' : 'inactive',
						]),
					],
				),
			]);
		}

		return () =>
			h('div', { style: styles.listContainer }, [
				h(
					'div',
					{
						style: {
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: '16px',
						},
					},
					[
						h('h1', { style: styles.listTitle }, 'Templates'),
						props.allowCreate
							? h(
									'button',
									{
										type: 'button',
										style: newButton,
										onClick: () =>
											emit('create-template', {
												locales: [
													...new Set(
														templates.value.map((t) => t.locale).filter((l): l is string => !!l),
													),
												],
											}),
									},
									'New template',
								)
							: null,
					],
				),
				h(
					'p',
					{ style: styles.hint },
					'Every email the app sends. Open one to edit its copy and preview it live.',
				),
				isLoading.value
					? h('p', { style: styles.status }, 'Loading templates…')
					: error.value
						? h('p', { style: styles.error, role: 'alert' }, error.value.explanation)
						: h('ul', { style: styles.list }, templates.value.map(renderRow)),
			]);
	},
});
