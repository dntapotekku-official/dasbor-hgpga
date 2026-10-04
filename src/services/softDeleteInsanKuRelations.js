export async function softDeleteInsanKuRelations(
  transaction,
  insanku_uuids,
  deleted_at,
) {
  if (!insanku_uuids.length) {
    return;
  }

  await transaction.tbl_atribut_insanku.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: { deleted_at },
  });
  await transaction.tbl_target_gofitku.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
      start_date: { lte: deleted_at },
      OR: [{ end_date: null }, { end_date: { gt: deleted_at } }],
    },
    data: { end_date: deleted_at },
  });
  await transaction.tbl_target_gofitku.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
      start_date: { gt: deleted_at },
    },
    data: { deleted_at },
  });
  await transaction.tbl_insanku_gofitku_exclusion.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
      start_date: { lte: deleted_at },
      OR: [{ end_date: null }, { end_date: { gt: deleted_at } }],
    },
    data: { end_date: deleted_at },
  });
  await transaction.tbl_insanku_gofitku_exclusion.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
      start_date: { gt: deleted_at },
    },
    data: { deleted_at },
  });
  await transaction.tbl_nilai_magang.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: { active_key: null, deleted_at },
  });
  await transaction.tbl_outlet_insanku.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: { deleted_at },
  });
}
