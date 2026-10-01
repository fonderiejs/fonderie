-- The platform a session was opened from (X-Client-Kind at sign-in: mobile,
-- desktop, web), so each platform keeps its own lifetimes at every refresh
-- (docs/SESSION-DESIGN.md, Phase 3c). Additive and nullable: NULL = not
-- declared, which keeps the shared lifetimes — the code serving during a
-- deploy ignores the column.
ALTER TABLE fonderie_sessions ADD COLUMN IF NOT EXISTS client_kind TEXT;
