-- Preserve existing category values while aligning the database column with the
-- Prisma field name, then add the reversible outlet-exclusion flag.
ALTER TABLE `tbl_outlet`
  CHANGE COLUMN `kategori` `category` ENUM('non_pariwisata', 'pariwisata', 'parsial') NOT NULL,
  ADD COLUMN `excep` BOOLEAN NOT NULL DEFAULT FALSE AFTER `category`;
