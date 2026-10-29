-- Legacy exclusions ended by an administrator must not become active again when
-- exclusions switch to permanent behavior. Keep the original range and row.
UPDATE `tbl_insanku_gofitku_exclusion`
SET `deleted_at` = UTC_TIMESTAMP(3)
WHERE `deleted_at` IS NULL
  AND `end_date` IS NOT NULL
  AND `end_date` < DATE(UTC_TIMESTAMP() + INTERVAL 8 HOUR);
