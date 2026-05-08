export interface ISqlQuery {
	text:   string;
	params: unknown[];
}

// Tagged template literal for safe parameterized queries.
// Never concatenates user input — always uses $N placeholders.
//
// Usage:
//   const { text, params } = sql`SELECT * FROM users WHERE id = ${userId}`
//   const rows = await store.query<User>(text, params)

export function sql(strings: TemplateStringsArray, ...values: unknown[]): ISqlQuery {
	let text = '';
	const params: unknown[] = [];

	strings.forEach((str, i) => {
		text += str;
		if (i < values.length) {
			params.push(values[i]);
			text += `$${params.length}`;
		}
	});

	return { text, params }
}
