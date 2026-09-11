-- Target lama berbasis outlet tidak dapat dipetakan secara aman ke InsanKU.
-- Arsipkan secara soft-delete agar tidak ikut terproses oleh operasi massal.
UPDATE `tbl_target_gofitku`
SET `deleted_at` = COALESCE(`deleted_at`, CURRENT_TIMESTAMP(3))
WHERE `uuid_insanku` IS NULL
  AND `deleted_at` IS NULL;
