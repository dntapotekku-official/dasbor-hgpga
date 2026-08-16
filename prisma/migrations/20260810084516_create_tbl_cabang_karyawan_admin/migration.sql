-- CreateTable
CREATE TABLE `tbl_outlet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_outlet_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_karyawan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password` TEXT NULL,
    `is_username_change` BOOLEAN NOT NULL DEFAULT false,
    `is_password_change` BOOLEAN NOT NULL DEFAULT false,
    `avatar` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_karyawan_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_karyawan_username_key`(`username`),
    INDEX `tbl_karyawan_uuid_outlet_idx`(`uuid_outlet`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password` TEXT NULL,
    `is_username_change` BOOLEAN NOT NULL DEFAULT false,
    `is_password_change` BOOLEAN NOT NULL DEFAULT false,
    `role` ENUM('ADMIN', 'VIEWER') NOT NULL,
    `avatar` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_admin_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_admin_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_karyawan` ADD CONSTRAINT `tbl_karyawan_uuid_outlet_fkey` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE RESTRICT ON UPDATE CASCADE;
