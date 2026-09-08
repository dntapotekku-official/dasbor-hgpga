-- CreateTable
CREATE TABLE `tbl_outlet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `category` ENUM('non_pariwisata', 'pariwisata', 'parsial') NOT NULL,
    `excep` BOOLEAN NOT NULL DEFAULT false,
    `is_skip_sync` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_outlet_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_insanku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `nik` VARCHAR(20) NULL,
    `name` VARCHAR(100) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password` TEXT NULL,
    `is_username_change` BOOLEAN NOT NULL DEFAULT false,
    `is_password_change` BOOLEAN NOT NULL DEFAULT false,
    `avatar` TEXT NULL,
    `is_slip_gaji_account` BOOLEAN NOT NULL DEFAULT false,
    `is_skip_sync` BOOLEAN NOT NULL DEFAULT false,
    `role` ENUM('superadmin', 'admin', 'member') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_insanku_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_insanku_username_key`(`username`),
    UNIQUE INDEX `tbl_insanku_nik_is_slip_gaji_account_key`(`nik`, `is_slip_gaji_account`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `password` TEXT NULL,
    `is_username_change` BOOLEAN NOT NULL DEFAULT false,
    `is_password_change` BOOLEAN NOT NULL DEFAULT false,
    `role` ENUM('superadmin', 'admin', 'member') NOT NULL,
    `avatar` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_admin_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_admin_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_kepuasan_internal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `puas` INTEGER NOT NULL DEFAULT 0,
    `tidak_puas` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_kepuasan_internal_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_kepuasan_internal_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_kepatuhan_sop_cctv` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `date` DATETIME(3) NOT NULL,
    `total` INTEGER NOT NULL DEFAULT 0,
    `total_point` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_kepatuhan_sop_cctv_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_kepatuhan_sop_cctv_uuid_outlet_date_key`(`uuid_outlet`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_outlet_insanku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `uuid_insanku` CHAR(36) NULL,
    `is_skip_sync` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_outlet_insanku_uuid_key`(`uuid`),
    INDEX `tbl_outlet_insanku_uuid_outlet_idx`(`uuid_outlet`),
    INDEX `tbl_outlet_insanku_uuid_insanku_idx`(`uuid_insanku`),
    UNIQUE INDEX `tbl_outlet_insanku_uuid_outlet_uuid_insanku_key`(`uuid_outlet`, `uuid_insanku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_penjualan_gofitku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet_insanku` CHAR(36) NULL,
    `uuid_produk_gofitku` CHAR(36) NULL,
    `name` VARCHAR(30) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_penjualan_gofitku_uuid_key`(`uuid`),
    INDEX `tbl_penjualan_gofitku_uuid_outlet_insanku_idx`(`uuid_outlet_insanku`),
    INDEX `tbl_penjualan_gofitku_uuid_produk_gofitku_idx`(`uuid_produk_gofitku`),
    INDEX `tbl_penjualan_gofitku_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_produk_gofitku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_produk_gofitku_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_api_ai` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `base_url` VARCHAR(255) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `api_key` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_api_ai_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_prompt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `prompt` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_prompt_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_target_gofitku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_target_gofitku_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_target_nilai_transaksi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_target_nilai_transaksi_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_target_basket_size` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_target_basket_size_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_nilai_transaksi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `active_key` VARCHAR(80) NULL,
    `date` DATETIME(3) NOT NULL,
    `total_revenue` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_nilai_transaksi_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_nilai_transaksi_active_key_key`(`active_key`),
    INDEX `tbl_nilai_transaksi_uuid_outlet_idx`(`uuid_outlet`),
    INDEX `tbl_nilai_transaksi_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_basket_size` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `active_key` VARCHAR(80) NULL,
    `date` DATETIME(3) NOT NULL,
    `sku_qty` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_basket_size_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_basket_size_active_key_key`(`active_key`),
    INDEX `tbl_basket_size_uuid_outlet_idx`(`uuid_outlet`),
    INDEX `tbl_basket_size_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_dilayani` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `active_key` VARCHAR(80) NULL,
    `value` INTEGER NOT NULL DEFAULT 0,
    `date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_dilayani_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_dilayani_active_key_key`(`active_key`),
    INDEX `tbl_dilayani_uuid_outlet_idx`(`uuid_outlet`),
    INDEX `tbl_dilayani_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_atribut_insanku` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_insanku` CHAR(36) NULL,
    `uuid_atribut` CHAR(36) NULL,
    `value` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_atribut_insanku_uuid_key`(`uuid`),
    INDEX `tbl_atribut_insanku_uuid_insanku_idx`(`uuid_insanku`),
    INDEX `tbl_atribut_insanku_uuid_atribut_idx`(`uuid_atribut`),
    UNIQUE INDEX `tbl_atribut_insanku_uuid_insanku_uuid_atribut_key`(`uuid_insanku`, `uuid_atribut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_kolom_atribut` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('string', 'number', 'date', 'checkbox') NOT NULL,
    `is_attribute` BOOLEAN NOT NULL DEFAULT false,
    `range_with` CHAR(36) NULL,
    `is_edit` BOOLEAN NOT NULL DEFAULT false,
    `is_view` BOOLEAN NOT NULL DEFAULT false,
    `order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_kolom_atribut_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_kolom_atribut_range_with_key`(`range_with`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_target_global` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_target_global_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_admin_menu_access` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_admin` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_admin_menu_access_uuid_key`(`uuid`),
    INDEX `tbl_admin_menu_access_uuid_admin_idx`(`uuid_admin`),
    UNIQUE INDEX `tbl_admin_menu_access_uuid_admin_key_key`(`uuid_admin`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tbl_nilai_magang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_outlet` CHAR(36) NULL,
    `uuid_insanku` CHAR(36) NULL,
    `active_key` VARCHAR(100) NULL,
    `value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_nilai_magang_uuid_key`(`uuid`),
    UNIQUE INDEX `tbl_nilai_magang_active_key_key`(`active_key`),
    INDEX `tbl_nilai_magang_uuid_outlet_idx`(`uuid_outlet`),
    INDEX `tbl_nilai_magang_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_kepatuhan_sop_cctv` ADD CONSTRAINT `fk_kepatuhan_sop_cctv_outlet` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_outlet_insanku` ADD CONSTRAINT `fk_outlet_insanku_outlet` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_outlet_insanku` ADD CONSTRAINT `fk_outlet_insanku_insanku` FOREIGN KEY (`uuid_insanku`) REFERENCES `tbl_insanku`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_penjualan_gofitku` ADD CONSTRAINT `fk_penjualan_gofitku_outlet_insanku` FOREIGN KEY (`uuid_outlet_insanku`) REFERENCES `tbl_outlet_insanku`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_penjualan_gofitku` ADD CONSTRAINT `fk_penjualan_gofitku_produk` FOREIGN KEY (`uuid_produk_gofitku`) REFERENCES `tbl_produk_gofitku`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_nilai_transaksi` ADD CONSTRAINT `fk_nilai_transaksi_outlet` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_basket_size` ADD CONSTRAINT `fk_basket_size_outlet` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_dilayani` ADD CONSTRAINT `fk_dilayani_outlet` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_atribut_insanku` ADD CONSTRAINT `fk_atribut_insanku_insanku` FOREIGN KEY (`uuid_insanku`) REFERENCES `tbl_insanku`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_atribut_insanku` ADD CONSTRAINT `fk_atribut_insanku_kolom_atribut` FOREIGN KEY (`uuid_atribut`) REFERENCES `tbl_kolom_atribut`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_admin_menu_access` ADD CONSTRAINT `tbl_admin_menu_access_uuid_admin_fkey` FOREIGN KEY (`uuid_admin`) REFERENCES `tbl_admin`(`uuid`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_nilai_magang` ADD CONSTRAINT `fk_nilai_magang_outlet` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tbl_nilai_magang` ADD CONSTRAINT `fk_nilai_magang_insanku` FOREIGN KEY (`uuid_insanku`) REFERENCES `tbl_insanku`(`uuid`) ON DELETE SET NULL ON UPDATE CASCADE;
