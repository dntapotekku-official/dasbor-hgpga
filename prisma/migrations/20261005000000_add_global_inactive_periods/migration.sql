ALTER TABLE `tbl_outlet_insanku`
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE `tbl_insanku_inactive_period` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `uuid_insanku` CHAR(36) NOT NULL,
  `start_date` DATETIME(3) NOT NULL,
  `end_date` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,

  UNIQUE INDEX `tbl_insanku_inactive_period_uuid_key`(`uuid`),
  INDEX `tbl_insanku_inactive_period_uuid_insanku_idx`(`uuid_insanku`),
  INDEX `idx_insanku_inactive_period`(`uuid_insanku`, `start_date`, `end_date`, `deleted_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tbl_outlet_insanku_inactive_period` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` CHAR(36) NOT NULL,
  `uuid_outlet_insanku` CHAR(36) NOT NULL,
  `start_date` DATETIME(3) NOT NULL,
  `end_date` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,

  UNIQUE INDEX `tbl_outlet_insanku_inactive_period_uuid_key`(`uuid`),
  INDEX `tbl_outlet_insanku_inactive_period_uuid_outlet_insanku_idx`(`uuid_outlet_insanku`),
  INDEX `idx_outlet_insanku_inactive_period`(`uuid_outlet_insanku`, `start_date`, `end_date`, `deleted_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tbl_insanku_inactive_period`
  ADD CONSTRAINT `fk_insanku_inactive_period_insanku`
  FOREIGN KEY (`uuid_insanku`) REFERENCES `tbl_insanku`(`uuid`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tbl_outlet_insanku_inactive_period`
  ADD CONSTRAINT `fk_outlet_insanku_inactive_period_placement`
  FOREIGN KEY (`uuid_outlet_insanku`) REFERENCES `tbl_outlet_insanku`(`uuid`)
  ON DELETE CASCADE ON UPDATE CASCADE;
