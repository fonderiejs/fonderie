// The prebuilt audit screens' words (React, React Native and Vue share them).
// English is canonical: the other languages are typed against this shape, so
// a missing or extra key is a compile error. `{name}` placeholders are
// interpolated; a11y.* are screen-reader labels and hints (React Native).
// Event types and actor ids come from the server and are shown as-is.
const audit = {
	log: {
		title: 'Audit log',
		eventType: 'Event type',
		actorId: 'Actor ID',
		filter: 'Filter',
		loading: 'Loading…',
		loadMore: 'Load more',
		// Shown in place of an actor id when the event had no human actor.
		system: 'system',
		a11y: {
			eventType: 'Event type filter',
			eventTypeHint: 'Show only events of this type',
			actorId: 'Actor ID filter',
			actorIdHint: 'Show only events by this actor',
			filter: 'Apply filters',
			event: '{type} by {actor}, {date}',
			eventHint: 'Shows or hides the event details',
			loadMore: 'Load more events',
			loadingMore: 'Loading more events',
		},
	},
};

export default audit;
