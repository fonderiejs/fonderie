import type { Middleware } from './types';

// Minimal, dependency-free metrics (SOC 2 CC7.2). Counts HTTP requests by
// status class and exposes them in Prometheus text format at /metrics (opt-in
// via config.metrics). Apps can also record custom counters. Not a full metrics
// system — enough to alert on error rate and traffic without pulling a client.

export class MetricsRegistry {
	private counters = new Map<string, number>();

	inc(name: string, labels: Record<string, string> = {}, by = 1): void {
		const key = seriesKey(name, labels);
		this.counters.set(key, (this.counters.get(key) ?? 0) + by);
	}

	// Prometheus text exposition format.
	render(): string {
		const lines: string[] = [];
		for (const [key, value] of this.counters) lines.push(`${key} ${value}`);
		return lines.join('\n') + (lines.length ? '\n' : '');
	}
}

function seriesKey(name: string, labels: Record<string, string>): string {
	const parts = Object.entries(labels).map(([k, v]) => `${k}="${String(v).replace(/"/g, '')}"`);
	return parts.length ? `${name}{${parts.join(',')}}` : name;
}

// Middleware that records one `http_requests_total{status_class}` per response.
export function withMetrics(registry: MetricsRegistry): Middleware {
	return async (ctx, next) => {
		const response = await next();
		const cls = `${Math.floor(response.status / 100)}xx`;
		registry.inc('http_requests_total', { status_class: cls });
		return response;
	};
}
