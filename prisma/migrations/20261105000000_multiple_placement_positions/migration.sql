-- Keep existing assignments and allow multiple distinct positions per placement.
-- Add the replacement index first so the placement foreign key stays indexed.
CREATE UNIQUE INDEX `uq_placement_jabatan`
    ON `tbl_jabatan_insanku` (`uuid_outlet_insanku`, `uuid_jabatan_master`);
DROP INDEX `tbl_jabatan_insanku_uuid_outlet_insanku_key` ON `tbl_jabatan_insanku`;
