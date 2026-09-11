-- Target GoFitKu kini dimiliki oleh InsanKU, bukan outlet. Pemeriksaan
-- information_schema membuat migrasi tetap aman bila kolom sudah diubah manual.
SET @target_gofitku_drop_outlet = (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `tbl_target_gofitku` DROP COLUMN `uuid_outlet`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_target_gofitku'
    AND COLUMN_NAME = 'uuid_outlet'
);
PREPARE target_gofitku_stmt FROM @target_gofitku_drop_outlet;
EXECUTE target_gofitku_stmt;
DEALLOCATE PREPARE target_gofitku_stmt;

SET @target_gofitku_add_insanku = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `tbl_target_gofitku` ADD COLUMN `uuid_insanku` CHAR(36) NULL',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_target_gofitku'
    AND COLUMN_NAME = 'uuid_insanku'
);
PREPARE target_gofitku_stmt FROM @target_gofitku_add_insanku;
EXECUTE target_gofitku_stmt;
DEALLOCATE PREPARE target_gofitku_stmt;

SET @target_gofitku_add_insanku_index = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `tbl_target_gofitku_uuid_insanku_idx` ON `tbl_target_gofitku`(`uuid_insanku`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_target_gofitku'
    AND INDEX_NAME = 'tbl_target_gofitku_uuid_insanku_idx'
);
PREPARE target_gofitku_stmt FROM @target_gofitku_add_insanku_index;
EXECUTE target_gofitku_stmt;
DEALLOCATE PREPARE target_gofitku_stmt;

SET @target_gofitku_add_period_index = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX `idx_target_gofitku_insanku_period` ON `tbl_target_gofitku`(`uuid_insanku`, `start_date`, `end_date`, `deleted_at`)',
    'SELECT 1'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_target_gofitku'
    AND INDEX_NAME = 'idx_target_gofitku_insanku_period'
);
PREPARE target_gofitku_stmt FROM @target_gofitku_add_period_index;
EXECUTE target_gofitku_stmt;
DEALLOCATE PREPARE target_gofitku_stmt;

SET @target_gofitku_add_fk = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `tbl_target_gofitku` ADD CONSTRAINT `fk_target_gofitku_insanku` FOREIGN KEY (`uuid_insanku`) REFERENCES `tbl_insanku`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT 1'
  )
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_target_gofitku'
    AND CONSTRAINT_NAME = 'fk_target_gofitku_insanku'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
PREPARE target_gofitku_stmt FROM @target_gofitku_add_fk;
EXECUTE target_gofitku_stmt;
DEALLOCATE PREPARE target_gofitku_stmt;
