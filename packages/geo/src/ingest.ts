// Load MaxMind GeoLite2 City CSVs (the same files the prior arbinuity importer
// used) into geo_blocks + geo_names. Hurricane Electric / other sources work
// too as long as rows map to {network, geoname_id, lat, lng, accuracy} and
// {geoname_id, country, subdivision, city}.
//
// NOTE: parsing is line-oriented (split on newlines, then parse quotes per
// line). MaxMind City fields never contain newlines, so this is safe for that
// data; a source with RFC4180 newlines *inside* quoted fields is not supported.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Queryable } from './types.js';

/** A store that can open a single-connection transaction — required for an
 * atomic reload (truncate + insert must not half-apply). */
export interface TxStore extends Queryable {
	transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

export interface BlockRow {
	network: string;
	geonameId: number | null;
	latitude: number | null;
	longitude: number | null;
	accuracyRadius: number | null;
}

export interface NameRow {
	geonameId: number;
	continentCode: string | null;
	countryIso: string | null;
	countryName: string | null;
	subdivisionIso: string | null;
	subdivisionName: string | null;
	cityName: string | null;
	timeZone: string | null;
}

/** RFC4180-ish single-line parser: quoted fields, embedded commas, "" escapes. */
export function parseCsvLine(line: string): string[] {
	const out: string[] = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (inQuotes) {
			if (c === '"') {
				if (line[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
			} else field += c;
		} else if (c === '"') inQuotes = true;
		else if (c === ',') { out.push(field); field = ''; }
		else field += c;
	}
	out.push(field);
	return out;
}

const num = (s: string | undefined): number | null => {
	if (s == null || s === '') return null;
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
};
const str = (s: string | undefined): string | null => (s == null || s === '' ? null : s);

// Blocks columns: network, geoname_id, registered_country_geoname_id,
// represented_country_geoname_id, is_anonymous_proxy, is_satellite_provider,
// postal_code, latitude, longitude, accuracy_radius.
export function blockRowFromLine(line: string): BlockRow | null {
	const c = parseCsvLine(line);
	if (!c[0]) return null;
	return {
		network: c[0],
		// Fall back to the registered-country geoname when the block has no
		// city-level geoname (MaxMind's documented behavior) — otherwise a large
		// slice of the address space loses all country resolution.
		geonameId: num(c[1]) ?? num(c[2]),
		latitude: num(c[7]),
		longitude: num(c[8]),
		accuracyRadius: num(c[9]),
	};
}

// Locations columns: geoname_id, locale_code, continent_code, continent_name,
// country_iso_code, country_name, subdivision_1_iso_code, subdivision_1_name,
// subdivision_2_iso_code, subdivision_2_name, city_name, metro_code, time_zone,
// is_in_european_union.
export function nameRowFromLine(line: string): NameRow | null {
	const c = parseCsvLine(line);
	const id = num(c[0]);
	if (id == null) return null;
	return {
		geonameId: id,
		continentCode: str(c[2]),
		countryIso: str(c[4]),
		countryName: str(c[5]),
		subdivisionIso: str(c[6]),
		subdivisionName: str(c[7]),
		cityName: str(c[10]),
		timeZone: str(c[12]),
	};
}

/** Parse a whole Blocks CSV string (header skipped). For tests / small inputs;
 * loadMaxMindCity streams the real multi-hundred-MB files instead. */
export function parseBlocksCsv(text: string): BlockRow[] {
	return text.split(/\r?\n/).slice(1).map(blockRowFromLine).filter((r): r is BlockRow => r !== null);
}

export function parseLocationsCsv(text: string): NameRow[] {
	return text.split(/\r?\n/).slice(1).map(nameRowFromLine).filter((r): r is NameRow => r !== null);
}

const CHUNK = 500;

async function insertChunked<T>(
	store: Queryable,
	rows: T[],
	cols: number,
	sqlHead: string,
	onConflict: string,
	toParams: (r: T) => unknown[],
): Promise<number> {
	let n = 0;
	for (let i = 0; i < rows.length; i += CHUNK) {
		const batch = rows.slice(i, i + CHUNK);
		const values = batch
			.map((_, b) => `(${Array.from({ length: cols }, (_, k) => `$${b * cols + k + 1}`).join(', ')})`)
			.join(', ');
		await store.query(`${sqlHead} VALUES ${values} ${onConflict}`, batch.flatMap(toParams));
		n += batch.length;
	}
	return n;
}

const NAMES_HEAD =
	'INSERT INTO geo_names (geoname_id, continent_code, country_iso, country_name, subdivision_iso, subdivision_name, city_name, time_zone)';
const NAMES_CONFLICT =
	'ON CONFLICT (geoname_id) DO UPDATE SET continent_code = EXCLUDED.continent_code, country_iso = EXCLUDED.country_iso, country_name = EXCLUDED.country_name, subdivision_iso = EXCLUDED.subdivision_iso, subdivision_name = EXCLUDED.subdivision_name, city_name = EXCLUDED.city_name, time_zone = EXCLUDED.time_zone';
const nameParams = (r: NameRow) => [r.geonameId, r.continentCode, r.countryIso, r.countryName, r.subdivisionIso, r.subdivisionName, r.cityName, r.timeZone];

const BLOCKS_HEAD = 'INSERT INTO geo_blocks (network, geoname_id, latitude, longitude, accuracy_radius)';
const BLOCKS_CONFLICT =
	'ON CONFLICT (network) DO UPDATE SET geoname_id = EXCLUDED.geoname_id, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, accuracy_radius = EXCLUDED.accuracy_radius';
const blockParams = (r: BlockRow) => [r.network, r.geonameId, r.latitude, r.longitude, r.accuracyRadius];

/** Upsert name rows (idempotent — safe to call without a prior truncate). */
export function ingestNames(store: Queryable, rows: NameRow[]): Promise<number> {
	return insertChunked(store, rows, 8, NAMES_HEAD, NAMES_CONFLICT, nameParams);
}

/** Upsert block rows (idempotent on `network`). */
export function ingestBlocks(store: Queryable, rows: BlockRow[]): Promise<number> {
	return insertChunked(store, rows, 5, BLOCKS_HEAD, BLOCKS_CONFLICT, blockParams);
}

/** Stream a CSV file line-by-line (header skipped), batching mapped rows — so a
 * multi-hundred-MB MaxMind file never lands in memory as one string. */
async function streamInto<T>(path: string, map: (line: string) => T | null, sink: (batch: T[]) => Promise<unknown>): Promise<number> {
	const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
	let total = 0;
	let batch: T[] = [];
	let first = true;
	for await (const line of rl) {
		if (first) { first = false; continue; } // header
		if (!line) continue;
		const row = map(line);
		if (!row) continue;
		batch.push(row);
		if (batch.length >= CHUNK) { await sink(batch); total += batch.length; batch = []; }
	}
	if (batch.length) { await sink(batch); total += batch.length; }
	return total;
}

/**
 * Full reload from MaxMind City CSV files — ATOMIC (truncate + all inserts in
 * one transaction, so a mid-load failure rolls back instead of leaving the geo
 * tables empty/partial) and STREAMED (bounded memory on the large Blocks file).
 */
export async function loadMaxMindCity(
	store: TxStore,
	files: { locationsPath: string; blocksV4Path?: string; blocksV6Path?: string },
): Promise<{ names: number; blocks: number }> {
	return store.transaction(async (tx) => {
		await tx.query('TRUNCATE geo_blocks');
		await tx.query('TRUNCATE geo_names');
		const names = await streamInto(files.locationsPath, nameRowFromLine, (b) => ingestNames(tx, b));
		let blocks = 0;
		for (const p of [files.blocksV4Path, files.blocksV6Path]) {
			if (p) blocks += await streamInto(p, blockRowFromLine, (b) => ingestBlocks(tx, b));
		}
		return { names, blocks };
	});
}
