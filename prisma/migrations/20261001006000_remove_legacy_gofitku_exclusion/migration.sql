-- Remove the legacy boolean after replacing it with period-based exclusion rows.
ALTER TABLE `tbl_insanku`
    DROP COLUMN `is_exclude_penjualan_gofitku`;
