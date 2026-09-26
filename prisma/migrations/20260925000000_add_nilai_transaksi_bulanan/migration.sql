-- CreateTable
CREATE TABLE `tbl_nilai_transaksi_bulanan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `active_key` VARCHAR(80) NULL,
    `from_date` DATETIME(3) NOT NULL,
    `to_date` DATETIME(3) NOT NULL,
    `total_revenue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_nilai_transaksi_bulanan_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_nilai_transaksi_bulanan_active_key_key`(`active_key`),
    INDEX `tbl_nilai_transaksi_bulanan_uuid_outlet_idx`(`uuid_outlet`),
    INDEX `tbl_nilai_transaksi_bulanan_from_date_idx`(`from_date`),
    INDEX `tbl_nilai_transaksi_bulanan_to_date_idx`(`to_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_dilayani_bulanan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `active_key` VARCHAR(80) NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `from_date` DATETIME(3) NOT NULL,
    `to_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_dilayani_bulanan_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_dilayani_bulanan_active_key_key`(`active_key`),
    INDEX `tbl_dilayani_bulanan_uuid_outlet_idx`(`uuid_outlet`),
    INDEX `tbl_dilayani_bulanan_from_date_idx`(`from_date`),
    INDEX `tbl_dilayani_bulanan_to_date_idx`(`to_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_nilai_transaksi_bulanan` ADD CONSTRAINT `fk_nilai_transaksi_bulanan_outlet` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_dilayani_bulanan` ADD CONSTRAINT `fk_dilayani_bulanan_outlet` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;
