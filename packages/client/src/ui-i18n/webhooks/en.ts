// The prebuilt webhooks screens' words (React, React Native and Vue share them).
// English is canonical: the other languages are typed against this shape, so
// a missing or extra key is a compile error. `{name}` placeholders are
// interpolated; a11y.* are screen-reader labels and hints (React Native).
// URLs, event type identifiers and HTTP codes are shown as-is.
const webhooks = {
	loading: 'Loading…',
	enabled: 'Enabled',
	disabled: 'Disabled',
	// A delivery's status, as the server reports it; an unknown one is shown raw.
	status: {
		pending: 'pending',
		delivered: 'delivered',
		failed: 'failed',
	},
	list: {
		title: 'Webhooks',
		// Followed by the secret itself.
		newSecret: 'New endpoint secret (shown once):',
		urlPlaceholder: 'https://example.com/webhook',
		eventsPlaceholder: 'event.type, event.other (optional)',
		add: 'Add endpoint',
		test: 'Test',
		delete: 'Delete',
		testOk: '{endpoint}: OK',
		testFailed: '{endpoint}: failed ({reason})',
		a11y: {
			url: 'Endpoint URL input',
			urlHint: 'The URL that will receive the events',
			events: 'Event types input',
			eventsHint: 'Comma-separated event types; leave empty for all events',
			add: 'Add endpoint button',
			open: 'Open endpoint {url}',
			test: 'Send a test event to {url}',
			delete: 'Delete endpoint {url}',
		},
	},
	detail: {
		title: 'Webhook endpoint',
		url: 'URL',
		events: 'Events (comma-separated)',
		save: 'Save',
		deliveries: 'Deliveries',
		attemptsOne: '{count} attempt',
		attemptsOther: '{count} attempts',
		back: 'Back to webhooks',
		a11y: {
			url: 'Endpoint URL input',
			events: 'Event types input',
			enabled: 'Endpoint enabled',
			save: 'Save button',
		},
	},
};

export default webhooks;
