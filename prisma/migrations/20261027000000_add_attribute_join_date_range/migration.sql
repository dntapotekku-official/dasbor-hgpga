CREATE TABLE IF NOT EXISTS `tbl_rentang_tgl_atribut` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` CHAR(36) NOT NULL,
    `uuid_kolom_atribut` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_rentang_tgl_atribut_uuid_key` (`uuid`),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_rentang_tgl_atribut_kolom_atribut` FOREIGN KEY (`uuid_kolom_atribut`)
        REFERENCES `tbl_kolom_atribut` (`uuid`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
