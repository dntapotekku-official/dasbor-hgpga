-- CreateTable
CREATE TABLE `tbl_kepatuhan_sop_cctv` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid_outlet` CHAR(36) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `point` INTEGER NOT NULL DEFAULT 0,
    `total_point` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tbl_kepatuhan_sop_cctv_date_key`(`date`),
    INDEX `tbl_kepatuhan_sop_cctv_uuid_outlet_idx`(`uuid_outlet`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tbl_kepatuhan_sop_cctv` ADD CONSTRAINT `tbl_kepatuhan_sop_cctv_uuid_outlet_fkey` FOREIGN KEY (`uuid_outlet`) REFERENCES `tbl_outlet`(`uuid`) ON DELETE RESTRICT ON UPDATE CASCADE;
