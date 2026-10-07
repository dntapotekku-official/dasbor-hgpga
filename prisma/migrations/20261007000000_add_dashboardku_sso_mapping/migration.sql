-- CreateTable
CREATE TABLE `tbl_sso_account_link` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `issuer` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `account_uuid` CHAR(36) NOT NULL,
    `account_type` ENUM('admin', 'outlet') NOT NULL,
    `status` ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_sso_account_link_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_sso_account_link_issuer_subject_key`(`issuer`, `subject`),
    INDEX `tbl_sso_account_link_account_uuid_idx`(`account_uuid`),
    INDEX `tbl_sso_account_link_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
