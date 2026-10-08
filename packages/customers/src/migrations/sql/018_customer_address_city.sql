-- City, door/buzzer code and coordinates on the shared address row.
--
-- An address picked from a places search arrives with a city and a point; the
-- row had nowhere to keep either, so the city was dropped (or stuffed into
-- line2 by apps that needed it). The unit (suite, apartment) stays `unit`;
-- `access_code` is the code whoever comes to the door needs.
--
-- Additive and nullable: rows written before this read back with NULLs, and
-- the code serving during a deploy neither reads nor writes these columns.
-- No backfill — a line2 that holds a city cannot be told apart from one that
-- holds a street complement; apps that stored the city there can move it.
ALTER TABLE fonderie_addresses
	ADD COLUMN IF NOT EXISTS city        TEXT CHECK (city IS NULL OR length(city) <= 100),
	ADD COLUMN IF NOT EXISTS access_code TEXT CHECK (access_code IS NULL OR length(access_code) <= 20),
	ADD COLUMN IF NOT EXISTS latitude    NUMERIC(9,6) CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
	ADD COLUMN IF NOT EXISTS longitude   NUMERIC(9,6) CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
