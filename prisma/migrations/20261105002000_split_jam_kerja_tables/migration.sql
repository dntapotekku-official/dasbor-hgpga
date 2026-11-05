-- Preserve existing monthly rows when moving to separate monthly and daily tables.

SET @migration_sql = IF(EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku') AND NOT EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku_bulanan'), 'RENAME TABLE `tbl_jam_kerja_insanku` TO `tbl_jam_kerja_insanku_bulanan`', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

CREATE TABLE IF NOT EXISTS `tbl_jam_kerja_insanku_bulanan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet_insanku` CHAR(36) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `excel_value` DOUBLE NOT NULL DEFAULT 0,
    `pharmapp_value` DOUBLE NOT NULL DEFAULT 0,
    `late_value` DOUBLE NOT NULL DEFAULT 0,
    `final_value` DOUBLE NOT NULL DEFAULT 0,
    `is_verfified` BOOLEAN NOT NULL DEFAULT false,
    `is_validated` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    UNIQUE INDEX `tbl_jam_kerja_insanku_bulanan_uuid_key` (`uuid`),
    INDEX `tbl_jam_kerja_insanku_bulanan_uuid_outlet_insanku_idx` (`uuid_outlet_insanku`),
    PRIMARY KEY (`id`),
    CONSTRAINT `tbl_jam_kerja_insanku_bulanan_uuid_outlet_insanku_fkey`
        FOREIGN KEY (`uuid_outlet_insanku`) REFERENCES `tbl_outlet_insanku` (`uuid`)
        ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @migration_sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku_bulanan' AND COLUMN_NAME = 'late_value'), 'ALTER TABLE `tbl_jam_kerja_insanku_bulanan` ADD COLUMN `late_value` DOUBLE NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku_bulanan' AND COLUMN_NAME = 'final_value'), 'ALTER TABLE `tbl_jam_kerja_insanku_bulanan` ADD COLUMN `final_value` DOUBLE NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku_bulanan' AND INDEX_NAME = 'tbl_jam_kerja_insanku_uuid_key') AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku_bulanan' AND INDEX_NAME = 'tbl_jam_kerja_insanku_bulanan_uuid_key'), 'CREATE UNIQUE INDEX `tbl_jam_kerja_insanku_bulanan_uuid_key` ON `tbl_jam_kerja_insanku_bulanan` (`uuid`)', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku_bulanan' AND INDEX_NAME = 'tbl_jam_kerja_insanku_uuid_key'), 'DROP INDEX `tbl_jam_kerja_insanku_uuid_key` ON `tbl_jam_kerja_insanku_bulanan`', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku_bulanan' AND INDEX_NAME = 'tbl_jam_kerja_insanku_uuid_outlet_insanku_idx') AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku_bulanan' AND INDEX_NAME = 'tbl_jam_kerja_insanku_bulanan_uuid_outlet_insanku_idx'), 'CREATE INDEX `tbl_jam_kerja_insanku_bulanan_uuid_outlet_insanku_idx` ON `tbl_jam_kerja_insanku_bulanan` (`uuid_outlet_insanku`)', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

SET @migration_sql = IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_jam_kerja_insanku_bulanan' AND INDEX_NAME = 'tbl_jam_kerja_insanku_uuid_outlet_insanku_idx'), 'DROP INDEX `tbl_jam_kerja_insanku_uuid_outlet_insanku_idx` ON `tbl_jam_kerja_insanku_bulanan`', 'SELECT 1');
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

-- An unused legacy img_url column is intentionally retained if the old monthly table had it.
-- No historical image metadata is discarded by this migration.
CREATE TABLE IF NOT EXISTS `tbl_jam_kerja_insanku_harian` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet_insanku` CHAR(36) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `description` TEXT NULL,
    `img_url` TEXT NULL,
    `hours_value` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    UNIQUE INDEX `tbl_jam_kerja_insanku_harian_uuid_key` (`uuid`),
    INDEX `tbl_jam_kerja_insanku_harian_uuid_outlet_insanku_idx` (`uuid_outlet_insanku`),
    PRIMARY KEY (`id`),
    CONSTRAINT `tbl_jam_kerja_insanku_harian_uuid_outlet_insanku_fkey`
        FOREIGN KEY (`uuid_outlet_insanku`) REFERENCES `tbl_outlet_insanku` (`uuid`)
        ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
