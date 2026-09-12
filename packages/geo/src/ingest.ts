// Load MaxMind GeoLite2 City CSVs (the same files the prior arbinuity importer
// used) into geo_blocks + geo_names. Hurricane Electric / other sources work
// too as long as rows map to {network, geoname_id, lat, lng, accuracy} and
// {geoname_id, country, subdivision, city}.
import { readFileSync } from 'node:fs';
import type { Queryable } from './types.js';

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

/** RFC4180-ish single-line parser: handles quoted fields, embedded commas, and
 * "" escaped quotes (MaxMind city names like "Washington, D.C." need this). */
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

/** Parse a GeoLite2-City-Blocks-IPv4/IPv6 CSV (header row skipped). Columns:
 * network, geoname_id, registered_country_geoname_id, represented_country_geoname_id,
 * is_anonymous_proxy, is_satellite_provider, postal_code, latitude, longitude, accuracy_radius. */
export function parseBlocksCsv(text: string): BlockRow[] {
	const rows: BlockRow[] = [];
	const lines = text.split(/\r?\n/);
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const c = parseCsvLine(line);
		if (!c[0]) continue;
		rows.push({
			network: c[0],
			geonameId: num(c[1]),
			latitude: num(c[7]),
			longitude: num(c[8]),
			accuracyRadius: num(c[9]),
		});
	}
	return rows;
}

/** Parse a GeoLite2-City-Locations-<locale> CSV (header row skipped). Columns:
 * geoname_id, locale_code, continent_code, continent_name, country_iso_code,
 * country_name, subdivision_1_iso_code, subdivision_1_name, subdivision_2_iso_code,
 * subdivision_2_name, city_name, metro_code, time_zone, is_in_european_union. */
export function parseLocationsCsv(text: string): NameRow[] {
	const rows: NameRow[] = [];
	const lines = text.split(/\r?\n/);
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const c = parseCsvLine(line);
		const id = num(c[0]);
		if (id == null) continue;
		rows.push({
			geonameId: id,
			continentCode: str(c[2]),
			countryIso: str(c[4]),
			countryName: str(c[5]),
			subdivisionIso: str(c[6]),
			subdivisionName: str(c[7]),
			cityName: str(c[10]),
			timeZone: str(c[12]),
		});
	}
	return rows;
}

const CHUNK = 500;

async function insertChunked<T>(
	store: Queryable,
	rows: T[],
	cols: number,
	sqlHead: string,
	toParams: (r: T) => unknown[],
): Promise<number> {
	let n = 0;
	for (let i = 0; i < rows.length; i += CHUNK) {
		const batch = rows.slice(i, i + CHUNK);
		const values = batch
			.map((_, b) => `(${Array.from({ length: cols }, (_, k) => `$${b * cols + k + 1}`).join(', ')})`)
			.join(', ');
		const params = batch.flatMap(toParams);
		await store.query(`${sqlHead} VALUES ${values}`, params);
		n += batch.length;
	}
	return n;
}

export async function ingestNames(store: Queryable, rows: NameRow[]): Promise<number> {
	return insertChunked(
		store,
		rows,
		8,
		`INSERT INTO geo_names (geoname_id, continent_code, country_iso, country_name, subdivision_iso, subdivision_name, city_name, time_zone)`,
		(r) => [r.geonameId, r.continentCode, r.countryIso, r.countryName, r.subdivisionIso, r.subdivisionName, r.cityName, r.timeZone],
	).then(async (c) => {
		// geo_names is a PK table; a re-run would conflict. Caller truncates first
		// for a full reload; this keeps ingest itself simple and idempotent-free.
		return c;
	});
}

export async function ingestBlocks(store: Queryable, rows: BlockRow[]): Promise<number> {
	return insertChunked(
		store,
		rows,
		5,
		`INSERT INTO geo_blocks (network, geoname_id, latitude, longitude, accuracy_radius)`,
		(r) => [r.network, r.geonameId, r.latitude, r.longitude, r.accuracyRadius],
	);
}

/** Full load from MaxMind City CSV files. Truncates first so a reload is a
 * clean replace (the dataset is a full snapshot, not a delta). */
export async function loadMaxMindCity(
	store: Queryable,
	files: { locationsPath: string; blocksV4Path?: string; blocksV6Path?: string },
): Promise<{ names: number; blocks: number }> {
	await store.query('TRUNCATE geo_blocks');
	await store.query('TRUNCATE geo_names');
	const names = await ingestNames(store, parseLocationsCsv(readFileSync(files.locationsPath, 'utf8')));
	let blocks = 0;
	for (const p of [files.blocksV4Path, files.blocksV6Path]) {
		if (p) blocks += await ingestBlocks(store, parseBlocksCsv(readFileSync(p, 'utf8')));
	}
	return { names, blocks };
}
