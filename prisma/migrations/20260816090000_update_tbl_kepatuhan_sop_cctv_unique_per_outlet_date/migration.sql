DROP INDEX `tbl_kepatuhan_sop_cctv_date_key` ON `tbl_kepatuhan_sop_cctv`;

CREATE UNIQUE INDEX `tbl_kepatuhan_sop_cctv_uuid_outlet_date_key`
ON `tbl_kepatuhan_sop_cctv`(`uuid_outlet`, `date`);
