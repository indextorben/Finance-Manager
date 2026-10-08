-- Standardbuchungen koennen als Preisvorlage dienen: ihr Betrag wird vorgeschlagen,
-- sobald die Beschreibung in einem Buchungsformular eingetippt wird.
ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS price_template boolean NOT NULL DEFAULT true;
