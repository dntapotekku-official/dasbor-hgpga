SET @attribute_range_index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tbl_kolom_atribut'
      AND INDEX_NAME = 'tbl_kolom_atribut_range_with_key'
);
SET @attribute_range_index_sql = IF(
    @attribute_range_index_exists > 0,
    'DROP INDEX `tbl_kolom_atribut_range_with_key` ON `tbl_kolom_atribut`',
    'SELECT 1'
);
PREPARE attribute_range_index_statement FROM @attribute_range_index_sql;
EXECUTE attribute_range_index_statement;
DEALLOCATE PREPARE attribute_range_index_statement;
