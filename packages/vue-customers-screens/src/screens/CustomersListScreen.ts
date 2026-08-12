import type { CustomersClient, ICustomerDTO, IListCustomersInput } from '@fonderie/client';
import { useCustomers } from '@fonderie/vue-customers';
import type { PropType } from 'vue';
import { defineComponent, h, ref } from 'vue';
import { styles } from '../styles';

export const CustomersListScreen = defineComponent({
	name: 'FonderieCustomersListScreen',
	props: {
		client: { type: Object as PropType<CustomersClient>, required: true },
	},
	emits: {
		'select-customer': (_customerId: string) => true,
	},
	setup(props, { emit }) {
		const search = ref('');
		const firstName = ref('');
		const lastName = ref('');
		const companyName = ref('');

		// Mutated in place (not reassigned) so refresh() — which closes over
		// this same object — picks up the latest search value; matches the
		// "read params once, expose refresh()" convention used by every other
		// list composable in this SDK.
		const params: IListCustomersInput = {};
		const bound = useCustomers(props.client, params);

		function handleSearch() {
			if (search.value) params.search = search.value;
			else delete params.search;
			void bound.refresh();
		}

		async function handleCreate(event: Event) {
			event.preventDefault();
			try {
				const input: Parameters<typeof bound.createCustomer>[0] = {};
				if (firstName.value) input.firstName = firstName.value;
				if (lastName.value) input.lastName = lastName.value;
				if (companyName.value) input.companyName = companyName.value;
				await bound.createCustomer(input);
				firstName.value = '';
				lastName.value = '';
				companyName.value = '';
			} catch {
				// Surfaced via error.
			}
		}

		function displayName(c: ICustomerDTO) {
			return c.companyName || [c.firstName, c.lastName].filter(Boolean).join(' ') || c.id;
		}

		function renderCustomer(customer: ICustomerDTO) {
			return h('li', { key: customer.id, style: styles.row }, [
				h(
					'button',
					{
						type: 'button',
						style: styles.rowButton,
						onClick: () => emit('select-customer', customer.id),
					},
					[
						h('span', { style: styles.name }, displayName(customer)),
						customer.blacklisted.status
							? h('span', { style: styles.blacklisted }, 'Blacklisted')
							: null,
					],
				),
			]);
		}

		return () =>
			h('div', { style: styles.container }, [
				h('h1', { style: styles.title }, 'Customers'),
				h('input', {
					style: styles.searchInput,
					placeholder: 'Search customers…',
					value: search.value,
					onInput: (e: Event) => {
						search.value = (e.target as HTMLInputElement).value;
					},
					onKeydown: (e: KeyboardEvent) => {
						if (e.key === 'Enter') handleSearch();
					},
				}),
				h('form', { style: styles.form, onSubmit: handleCreate }, [
					h('input', {
						style: styles.input,
						placeholder: 'First name',
						value: firstName.value,
						onInput: (e: Event) => {
							firstName.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('input', {
						style: styles.input,
						placeholder: 'Last name',
						value: lastName.value,
						onInput: (e: Event) => {
							lastName.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('input', {
						style: styles.input,
						placeholder: 'Company (optional)',
						value: companyName.value,
						onInput: (e: Event) => {
							companyName.value = (e.target as HTMLInputElement).value;
						},
					}),
					h('button', { type: 'submit', style: styles.createButton }, 'Add customer'),
				]),
				bound.error.value
					? h('p', { style: styles.error, role: 'alert' }, bound.error.value.explanation)
					: null,
				bound.isLoading.value
					? h('p', { style: styles.status }, 'Loading…')
					: h('ul', { style: styles.list }, bound.customers.value.map(renderCustomer)),
			]);
	},
});
