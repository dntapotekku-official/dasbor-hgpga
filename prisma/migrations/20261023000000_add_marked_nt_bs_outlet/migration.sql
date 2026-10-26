CREATE TABLE `tbl_marked_nt_bs_outlet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    UNIQUE INDEX `tbl_marked_nt_bs_outlet_uuid_key` (`uuid`),
    UNIQUE INDEX `tbl_marked_nt_bs_outlet_uuid_outlet_date_key` (`uuid_outlet`, `date`),
    INDEX `tbl_marked_nt_bs_outlet_date_deleted_at_idx` (`date`, `deleted_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `tbl_marked_nt_bs_outlet_uuid_outlet_fkey` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet` (`uuid`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
