-- CreateTable
CREATE TABLE `tbl_jabatan_master` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_jabatan_master_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_jabatan_insanku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet_insanku` CHAR(36) NULL,
    `uuid_jabatan_master` CHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_jabatan_insanku_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_jabatan_insanku_uuid_outlet_insanku_key`(`uuid_outlet_insanku`),
    INDEX `tbl_jabatan_insanku_uuid_jabatan_master_idx`(`uuid_jabatan_master`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_jabatan_insanku`
    ADD CONSTRAINT `fk_jabatan_insanku_outlet_insanku`
    FOREIGN KEY (`uuid_outlet_insanku`) REFERENCES `tbl_outlet_insanku`(`uuid`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_jabatan_insanku`
    ADD CONSTRAINT `fk_jabatan_insanku_master`
    FOREIGN KEY (`uuid_jabatan_master`) REFERENCES `tbl_jabatan_master`(`uuid`)
    ON DELETE SET NULL ON UPDATE CASCADE;
