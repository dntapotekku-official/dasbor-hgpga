ALTER TABLE `tbl_nt_bs_summary_exclusion`
    ADD COLUMN `start_date` DATE NULL,
    ADD COLUMN `end_date` DATE NULL;

UPDATE `tbl_nt_bs_summary_exclusion`
SET `start_date` = STR_TO_DATE(CONCAT(`month`, '-01'), '%Y-%m-%d'),
    `end_date` = LAST_DAY(STR_TO_DATE(CONCAT(`month`, '-01'), '%Y-%m-%d'));

ALTER TABLE `tbl_nt_bs_summary_exclusion`
    MODIFY COLUMN `start_date` DATE NOT NULL,
    MODIFY COLUMN `end_date` DATE NOT NULL,
    DROP INDEX `uq_nt_bs_summary_exclusion_period`,
    DROP INDEX `idx_nt_bs_summary_exclusion_month`,
    DROP COLUMN `month`,
    ADD INDEX `idx_nt_bs_summary_exclusion_range` (`uuid_outlet`, `metric`, `start_date`, `end_date`, `deleted_at`);
