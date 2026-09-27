-- Which network operator an address belongs to, from MaxMind's free GeoLite2
-- ASN database (a separate download from City). Loaded by loadMaxMindAsn().
-- Same containment model as geo_blocks: native cidr, IPv4 and IPv6 in one
-- table, most-specific block wins.
CREATE TABLE IF NOT EXISTS geo_asn_blocks (
	network        CIDR   NOT NULL,
	asn            BIGINT NOT NULL,   -- 15169 (rendered "AS15169")
	organization   TEXT               -- "Google LLC"
);
CREATE INDEX IF NOT EXISTS idx_geo_asn_blocks_network ON geo_asn_blocks USING gist (network inet_ops);
CREATE UNIQUE INDEX IF NOT EXISTS uq_geo_asn_blocks_network ON geo_asn_blocks (network);
