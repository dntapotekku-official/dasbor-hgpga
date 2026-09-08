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
      deleted_at: null,
    },
    select: { uuid: true },
  });
  const outlet_relation_uuids = outlet_relations.map(({ uuid }) => uuid);

  if (outlet_relation_uuids.length) {
    await transaction.tbl_penjualan_gofitku.updateMany({
      where: {
        uuid_outlet_insanku: { in: outlet_relation_uuids },
        deleted_at: null,
      },
      data: { deleted_at },
    });
  }

  await transaction.tbl_atribut_insanku.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: { deleted_at },
  });
  await transaction.tbl_outlet_insanku.updateMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
      deleted_at: null,
    },
    data: { deleted_at },
  });
}
