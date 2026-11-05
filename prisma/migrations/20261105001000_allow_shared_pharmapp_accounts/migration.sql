-- Support both databases managed by migrations and databases already adjusted with db push.
-- Keep all placement data; PharmApp accounts may be shared across placements.

SET @migration_sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_outlet_insanku' AND COLUMN_NAME = 'pharmapp_account'), 'ALTER TABLE `tbl_outlet_insanku` ADD COLUMN `pharmapp_account` VARCHAR(100) NULL', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_outlet_insanku' AND INDEX_NAME = 'tbl_outlet_insanku_pharmapp_account_idx'), 'CREATE INDEX `tbl_outlet_insanku_pharmapp_account_idx` ON `tbl_outlet_insanku` (`pharmapp_account`)', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_outlet_insanku' AND INDEX_NAME = 'tbl_outlet_insanku_pharmapp_account_key'), 'DROP INDEX `tbl_outlet_insanku_pharmapp_account_key` ON `tbl_outlet_insanku`', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;
