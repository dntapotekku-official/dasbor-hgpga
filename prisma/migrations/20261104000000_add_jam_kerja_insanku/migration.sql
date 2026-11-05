CREATE TABLE IF NOT EXISTS `tbl_jam_kerja_insanku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet_insanku` CHAR(36) NOT NULL,
    `excel_value` INTEGER NOT NULL DEFAULT 0,
    `pharmapp_value` INTEGER NOT NULL DEFAULT 0,
    `is_verfified` BOOLEAN NOT NULL DEFAULT false,
    `is_validated` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    UNIQUE INDEX `tbl_jam_kerja_insanku_uuid_key` (`uuid`),
    INDEX `tbl_jam_kerja_insanku_uuid_outlet_insanku_idx` (`uuid_outlet_insanku`),
    PRIMARY KEY (`id`),
    CONSTRAINT `tbl_jam_kerja_insanku_uuid_outlet_insanku_fkey` FOREIGN KEY (`uuid_outlet_insanku`) REFERENCES `tbl_outlet_insanku` (`uuid`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
