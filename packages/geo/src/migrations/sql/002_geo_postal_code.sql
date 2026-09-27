-- MaxMind's City blocks carry a postal code per block (7th CSV column); the
-- first schema dropped it, so the self-hosted provider could never return
-- one while the edge-header path could. Nullable; existing rows fill on the
-- next loadMaxMindCity() (a full reload).
ALTER TABLE geo_blocks ADD COLUMN IF NOT EXISTS postal_code TEXT;
