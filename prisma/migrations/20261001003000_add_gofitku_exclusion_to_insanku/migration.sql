-- CreateTable
CREATE TABLE `tbl_insanku_gofitku_exclusion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_insanku` CHAR(36) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_insanku_gofitku_exclusion_uuid_key`(`uuid`),
    INDEX `tbl_insanku_gofitku_exclusion_uuid_insanku_idx`(`uuid_insanku`),
    INDEX `idx_gofitku_exclusion_insanku_period`(`uuid_insanku`, `start_date`, `end_date`, `deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_insanku_gofitku_exclusion`
    ADD CONSTRAINT `fk_gofitku_exclusion_insanku`
    FOREIGN KEY (`uuid_insanku`) REFERENCES `tbl_insanku`(`uuid`)
    ON DELETE CASCADE ON UPDATE CASCADE;
