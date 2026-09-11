SET @has_price_column = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tbl_penjualan_gofitku'
    AND COLUMN_NAME = 'price'
);

SET @add_price_column_sql = IF(
  @has_price_column = 0,
  'ALTER TABLE `tbl_penjualan_gofitku` ADD COLUMN `price` DECIMAL(18, 2) NOT NULL DEFAULT 0 AFTER `qty`',
  'SELECT 1'
);
PREPARE add_price_column_statement FROM @add_price_column_sql;
EXECUTE add_price_column_statement;
DEALLOCATE PREPARE add_price_column_statement;
