CREATE TABLE IF NOT EXISTS `tbl_pengecualian_jabatan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_jabatan_master` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    UNIQUE INDEX `tbl_pengecualian_jabatan_uuid_key` (`uuid`),
    INDEX `tbl_pengecualian_jabatan_uuid_jabatan_master_idx` (`uuid_jabatan_master`),
    PRIMARY KEY (`id`),
    CONSTRAINT `tbl_pengecualian_jabatan_uuid_jabatan_master_fkey` FOREIGN KEY (`uuid_jabatan_master`)
        REFERENCES `tbl_jabatan_master` (`uuid`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
