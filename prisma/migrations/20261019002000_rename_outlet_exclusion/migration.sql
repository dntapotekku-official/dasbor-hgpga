-- Preserve exclusion values, including databases already renamed manually.
SET @has_old_outlet_exclusion = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_outlet' AND COLUMN_NAME = 'excep'
);
SET @has_new_outlet_exclusion = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tbl_outlet' AND COLUMN_NAME = 'is_excluded'
);
SET @rename_outlet_exclusion = IF(
    @has_old_outlet_exclusion > 0 OR @has_new_outlet_exclusion = 0,
    'ALTER TABLE `tbl_outlet` CHANGE COLUMN `excep` `is_excluded` BOOLEAN NOT NULL DEFAULT false',
    'SELECT 1'
);
PREPARE rename_outlet_exclusion_stmt FROM @rename_outlet_exclusion;
EXECUTE rename_outlet_exclusion_stmt;
DEALLOCATE PREPARE rename_outlet_exclusion_stmt;
