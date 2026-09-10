// Minimal declaration for the test-only react-dom/server import — the hoisted
// @types/react is pinned by react-native's peer range, so @types/react-dom
// cannot be installed without a conflict.
declare module 'react-dom/server' {
	import type { ReactElement } from 'react';
	export function renderToString(element: ReactElement): string;
}
