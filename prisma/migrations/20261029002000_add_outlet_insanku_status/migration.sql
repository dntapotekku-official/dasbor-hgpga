-- Keep existing values when the status column has already been added manually.
SET @outlet_insanku_status_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_outlet_insanku' AND COLUMN_NAME = 'status'
);
SET @outlet_insanku_status_sql = IF(
    @outlet_insanku_status_exists > 0,
    'ALTER TABLE `tbl_outlet_insanku` MODIFY COLUMN `status` ENUM(\'izin\', \'praktek\', \'izin_praktek\') NULL',
    'ALTER TABLE `tbl_outlet_insanku` ADD COLUMN `status` ENUM(\'izin\', \'praktek\', \'izin_praktek\') NULL'
);
PREPARE outlet_insanku_status_statement FROM @outlet_insanku_status_sql;
EXECUTE outlet_insanku_status_statement;
DEALLOCATE PREPARE outlet_insanku_status_statement;
