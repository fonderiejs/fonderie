-- A customer belongs to one BRANCH of the business (@fonderie/workspaces
-- migration 011): the face they deal with — the funnel that signed them up,
-- the branch whose name, address, taxes and language their documents carry.
-- Nothing of another branch ever reaches them. NULL = the workspace's default
-- branch (customers from before branches, or created without naming one).
-- No foreign key: modules never couple at the database level; the customers
-- service checks the branch is the workspace's on every write.
ALTER TABLE fonderie_customers ADD COLUMN IF NOT EXISTS branch_id UUID;
CREATE INDEX IF NOT EXISTS idx_fc_workspace_branch ON fonderie_customers (workspace_id, branch_id);
