export async function softDeleteInsanKuRelations(
  transaction,
  insanku_uuids,
  deleted_at,
) {
  if (!insanku_uuids.length) {
    return;
  }

  const outlet_relations = await transaction.tbl_outlet_insanku.findMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
    },
    select: { uuid: true },
  });
  const outlet_relation_uuids = outlet_relations.map((item) => item.uuid);

  if (outlet_relation_uuids.length > 0) {
    await transaction.tbl_outlet_insanku_inactive_period.updateMany({
      where: {
        uuid_outlet_insanku: { in: outlet_relation_uuids },
        deleted_at: null,
      },
      data: { deleted_at },
    });
    await transaction.tbl_penjualan_gofitku.updateMany({
      where: {
        uuid_outlet_insanku: { in: outlet_relation_uuids },
        deleted_at: null,
      },
      data: { deleted_at },
    });
    await transaction.tbl_target_gofitku.updateMany({
      where: {
        uuid_outlet_insanku: { in: outlet_relation_uuids },
        deleted_at: null,
      },
      data: { uuid_outlet_insanku: null, deleted_at },
    });
  }

  await transaction.tbl_atribut_insanku.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: { uuid_insanku: null, deleted_at },
  });
  await transaction.tbl_insanku_gofitku_exclusion.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: { deleted_at },
  });
  await transaction.tbl_insanku_inactive_period.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: { deleted_at },
  });
  await transaction.tbl_nilai_magang.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: { uuid_insanku: null, active_key: null, deleted_at },
  });
  await transaction.tbl_outlet_insanku.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: {
      uuid_outlet: null,
      uuid_insanku: null,
      is_skip_sync: false,
      deleted_at,
    },
  });
}
