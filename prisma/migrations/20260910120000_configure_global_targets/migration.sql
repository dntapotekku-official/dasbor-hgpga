SET @has_name_column = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_target_global'
    AND COLUMN_NAME = 'name'
);

SET @has_key_column = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_target_global'
    AND COLUMN_NAME = 'key'
);

SET @rename_column_sql = IF(
  @has_name_column = 1 AND @has_key_column = 0,
  'ALTER TABLE `tbl_target_global` CHANGE COLUMN `name` `key` VARCHAR(100) NOT NULL',
  'SELECT 1'
);
PREPARE rename_column_statement FROM @rename_column_sql;
EXECUTE rename_column_statement;
DEALLOCATE PREPARE rename_column_statement;

SET @has_key_unique_index = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_target_global'
    AND COLUMN_NAME = 'key'
    AND NON_UNIQUE = 0
);

SET @create_index_sql = IF(
  @has_key_unique_index = 0,
  'CREATE UNIQUE INDEX `tbl_target_global_key_key` ON `tbl_target_global`(`key`)',
  'SELECT 1'
);
PREPARE create_index_statement FROM @create_index_sql;
EXECUTE create_index_statement;
DEALLOCATE PREPARE create_index_statement;

INSERT INTO `tbl_target_global` (
  `uuid`, `key`, `value`, `start_date`, `end_date`, `created_at`, `updated_at`, `deleted_at`
)
SELECT UUID(), 'nilai_transaksi', 105000, '1970-01-01 00:00:00.000', NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), NULL
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_target_global` WHERE `key` = 'nilai_transaksi'
);

INSERT INTO `tbl_target_global` (
  `uuid`, `key`, `value`, `start_date`, `end_date`, `created_at`, `updated_at`, `deleted_at`
)
SELECT UUID(), 'basket_size', 2, '1970-01-01 00:00:00.000', NULL, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), NULL
WHERE NOT EXISTS (
  SELECT 1 FROM `tbl_target_global` WHERE `key` = 'basket_size'
);
