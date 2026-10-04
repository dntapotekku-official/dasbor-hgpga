ALTER TABLE `tbl_target_gofitku`
  ADD COLUMN `uuid_outlet_insanku` CHAR(36) NULL;

INSERT INTO `tbl_target_gofitku` (
  `uuid`,
  `uuid_outlet_insanku`,
  `value`,
  `start_date`,
  `end_date`,
  `created_at`,
  `updated_at`,
  `deleted_at`
)
SELECT
  UUID(),
  `placement`.`uuid`,
  `target`.`value`,
  `target`.`start_date`,
  `target`.`end_date`,
  `target`.`created_at`,
  `target`.`updated_at`,
  `target`.`deleted_at`
FROM `tbl_target_gofitku` AS `target`
INNER JOIN `tbl_outlet_insanku` AS `placement`
  ON `placement`.`uuid_insanku` = `target`.`uuid_insanku`
  AND `placement`.`deleted_at` IS NULL
WHERE `target`.`uuid_insanku` IS NOT NULL
  AND `target`.`uuid_outlet_insanku` IS NULL;

UPDATE `tbl_target_gofitku`
SET `deleted_at` = COALESCE(`deleted_at`, NOW())
WHERE `uuid_insanku` IS NOT NULL
  AND `uuid_outlet_insanku` IS NULL;

ALTER TABLE `tbl_target_gofitku`
  DROP FOREIGN KEY `fk_target_gofitku_insanku`;

DROP INDEX `idx_target_gofitku_insanku_period` ON `tbl_target_gofitku`;
DROP INDEX `tbl_target_gofitku_uuid_insanku_idx` ON `tbl_target_gofitku`;

ALTER TABLE `tbl_target_gofitku`
  DROP COLUMN `uuid_insanku`;

CREATE INDEX `tbl_target_gofitku_uuid_outlet_insanku_idx`
  ON `tbl_target_gofitku`(`uuid_outlet_insanku`);

CREATE INDEX `idx_target_gofitku_placement_period`
  ON `tbl_target_gofitku`(`uuid_outlet_insanku`, `start_date`, `end_date`, `deleted_at`);

ALTER TABLE `tbl_target_gofitku`
  ADD CONSTRAINT `fk_target_gofitku_outlet_insanku`
  FOREIGN KEY (`uuid_outlet_insanku`) REFERENCES `tbl_outlet_insanku`(`uuid`)
  ON DELETE SET NULL ON UPDATE CASCADE;
