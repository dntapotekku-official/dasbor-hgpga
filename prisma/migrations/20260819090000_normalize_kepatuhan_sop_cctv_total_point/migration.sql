-- Normalize legacy API values so total points are stored as deductions.
UPDATE `tbl_kepatuhan_sop_cctv`
SET
    `total_point` = -ABS(`total_point`),
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `total_point` > 0;
