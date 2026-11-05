-- Data lama menggunakan bulan tanggal pembuatan karena sebelumnya belum memiliki periode.
ALTER TABLE `tbl_jam_kerja_insanku`
    ADD COLUMN `date` DATETIME(3) NULL,
    ADD COLUMN `img_url` TEXT NULL,
    MODIFY `excel_value` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `pharmapp_value` DOUBLE NOT NULL DEFAULT 0;

UPDATE `tbl_jam_kerja_insanku`
SET `date` = DATE_FORMAT(`created_at`, '%Y-%m-01 00:00:00')
WHERE `date` IS NULL;

ALTER TABLE `tbl_jam_kerja_insanku`
    MODIFY `date` DATETIME(3) NOT NULL;
