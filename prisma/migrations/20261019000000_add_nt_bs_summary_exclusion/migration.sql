CREATE TABLE `tbl_nt_bs_summary_exclusion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NOT NULL,
    `month` CHAR(7) NOT NULL,
    `metric` ENUM('nilai_transaksi', 'basket_size') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    UNIQUE INDEX `tbl_nt_bs_summary_exclusion_uuid_key` (`uuid`),
    UNIQUE INDEX `uq_nt_bs_summary_exclusion_period` (`uuid_outlet`, `month`, `metric`),
    INDEX `idx_nt_bs_summary_exclusion_month` (`month`, `deleted_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `tbl_nt_bs_summary_exclusion_uuid_outlet_fkey` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet` (`uuid`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
