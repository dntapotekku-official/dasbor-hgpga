-- AlterTable
ALTER TABLE `tbl_kunjungan`
    ADD COLUMN `metric` ENUM('nilai_transaksi', 'basket_size') NOT NULL DEFAULT 'nilai_transaksi';

-- CreateIndex
CREATE INDEX `tbl_kunjungan_metric_idx` ON `tbl_kunjungan`(`metric`);
