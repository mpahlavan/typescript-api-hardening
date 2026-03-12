-- #23: Drop unused title column from template_categories join table
ALTER TABLE template_categories DROP COLUMN IF EXISTS title;

-- #24: Enforce non-empty id on templates
ALTER TABLE templates ADD CONSTRAINT templates_id_nonempty CHECK (id <> '');

-- #25: Add indexes for common query patterns
-- order_index is used in every ORDER BY on the templates list
CREATE INDEX IF NOT EXISTS idx_templates_order_index ON templates (order_index ASC);

-- template_id and category_id are used in every JOIN via template_categories
CREATE INDEX IF NOT EXISTS idx_template_categories_template_id ON template_categories (template_id);
CREATE INDEX IF NOT EXISTS idx_template_categories_category_id ON template_categories (category_id);
