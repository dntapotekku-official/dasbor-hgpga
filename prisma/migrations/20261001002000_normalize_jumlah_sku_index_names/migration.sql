-- Rename indexes to match Prisma schema names after the range migration.
ALTER TABLE `tbl_jumlah_sku`
  RENAME INDEX `tbl_basket_size_start_date_idx` TO `tbl_jumlah_sku_start_date_idx`,
  RENAME INDEX `tbl_basket_size_end_date_idx` TO `tbl_jumlah_sku_end_date_idx`;
