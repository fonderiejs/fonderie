import type { CourierAdminClient, ITemplateEntry } from '@fonderie/client';
import { useTemplates } from '@fonderie/vue-courier-admin';
import type { PropType } from 'vue';
import { defineComponent, h } from 'vue';
import { styles } from '../styles';

export const TemplateListScreen = defineComponent({
	name: 'FonderieTemplateListScreen',
	props: {
		client: { type: Object as PropType<CourierAdminClient>, required: true },
	},
	emits: {
		'select-template': (_template: ITemplateEntry) => true,
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
						h('span', { style: styles.locale }, template.locale ?? 'base'),
						h(
							'span',
							{ style: template.active ? styles.active : styles.inactive },
							template.active ? 'Active' : 'Inactive',
						),
					],
				),
			]);
		}

		return () => {
			if (isLoading.value) return h('p', { style: styles.status }, 'Loading templates…');
			if (error.value)
				return h('p', { style: styles.error, role: 'alert' }, error.value.explanation);

			return h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Templates'),
				h('ul', { style: styles.list }, templates.value.map(renderRow)),
			]);
		};
	},
});
