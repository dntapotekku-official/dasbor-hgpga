ALTER TABLE `tbl_outlet`
  ADD COLUMN `username` VARCHAR(100) NULL,
  ADD COLUMN `password` TEXT NULL,
  ADD COLUMN `is_username_change` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `is_password_change` BOOLEAN NOT NULL DEFAULT false;

UPDATE `tbl_outlet`
SET
  `username` = CONCAT('outlet-', `uuid`),
  `password` = 'apotekku'
WHERE `username` IS NULL;

ALTER TABLE `tbl_outlet`
  MODIFY COLUMN `username` VARCHAR(100) NOT NULL;

CREATE UNIQUE INDEX `tbl_outlet_username_key` ON `tbl_outlet`(`username`);
