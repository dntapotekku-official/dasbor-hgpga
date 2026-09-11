DROP INDEX `tbl_target_global_key_key` ON `tbl_target_global`;

CREATE INDEX `tbl_target_global_key_idx` ON `tbl_target_global`(`key`);

-- Hapus nilai awal tanpa batas waktu yang dibuat oleh migrasi sebelumnya.
-- Target global sekarang harus dibuat sebagai rentang tanggal eksplisit.
DELETE FROM `tbl_target_global`
WHERE `start_date` = '1970-01-01 00:00:00.000'
  AND `end_date` IS NULL
  AND (
    (`key` = 'nilai_transaksi' AND `value` = 105000)
    OR (`key` = 'basket_size' AND `value` = 2)
  );
