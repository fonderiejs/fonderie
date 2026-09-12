-- ----------------------------------------------------------------------------
-- 001_geo
-- ----------------------------------------------------------------------------
-- Self-hosted IP → location. Two tables, loaded from MaxMind GeoLite2 (or
-- Hurricane Electric) City CSVs by the ingest command:
--
--   geo_blocks — one row per CIDR block (`network`), pointing at a geoname_id,
--                with the block's own lat/lng/accuracy.
--   geo_names  — the human-readable location for a geoname_id (country,
--                subdivision, city), denormalized for a single-join lookup.
--
-- Stored as native `cidr`, so ONE table holds IPv4 AND IPv6 and the lookup is
-- a range-contains — `WHERE network >>= $ip::inet ORDER BY masklen(network)
-- DESC LIMIT 1` (the most-specific block wins). The GiST `inet_ops` index makes
-- that containment fast; it ships in core Postgres (>= 9.4), no extension.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS geo_names (
	geoname_id        BIGINT PRIMARY KEY,
	continent_code    TEXT,
	country_iso       TEXT,          -- ISO-3166-1 alpha-2
	country_name      TEXT,
	subdivision_iso   TEXT,          -- ISO-3166-2 (state/region), if any
	subdivision_name  TEXT,
	city_name         TEXT,
	time_zone         TEXT
);

CREATE TABLE IF NOT EXISTS geo_blocks (
	network           CIDR   NOT NULL,  -- IPv4 or IPv6 block
	geoname_id        BIGINT,           -- FK-by-value into geo_names (nullable: MaxMind has blocks with no city)
	latitude          DOUBLE PRECISION,
	longitude         DOUBLE PRECISION,
	accuracy_radius   INTEGER
);

-- Containment lookup: which block(s) contain this address? inet_ops GiST
-- supports the >>= operator; masklen() then picks the most specific.
CREATE INDEX IF NOT EXISTS idx_geo_blocks_network ON geo_blocks USING gist (network inet_ops);
CREATE INDEX IF NOT EXISTS idx_geo_blocks_geoname ON geo_blocks (geoname_id);
