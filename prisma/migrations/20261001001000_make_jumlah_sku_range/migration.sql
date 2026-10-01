-- AlterTable
ALTER TABLE `tbl_jumlah_sku`
    ADD COLUMN `start_date` DATETIME(3) NULL,
    ADD COLUMN `end_date` DATETIME(3) NULL;

-- Backfill existing daily SKU rows as one-day ranges.
UPDATE `tbl_jumlah_sku`
SET
    `start_date` = `date`,
    `end_date` = `date`
WHERE `start_date` IS NULL OR `end_date` IS NULL;

-- Drop old daily index before removing the column.
DROP INDEX `tbl_basket_size_date_idx` ON `tbl_jumlah_sku`;

-- Make range columns required and remove the old daily column.
ALTER TABLE `tbl_jumlah_sku`
    MODIFY `start_date` DATETIME(3) NOT NULL,
    MODIFY `end_date` DATETIME(3) NOT NULL,
    DROP COLUMN `date`;

-- CreateIndex
CREATE INDEX `tbl_basket_size_start_date_idx` ON `tbl_jumlah_sku`(`start_date`);
CREATE INDEX `tbl_basket_size_end_date_idx` ON `tbl_jumlah_sku`(`end_date`);
