export async function hardDeleteInsanKuRelations(
  transaction,
  insanku_uuids,
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
  const outlet_relation_uuids = outlet_relations.map(({ uuid }) => uuid);

  if (outlet_relation_uuids.length) {
    await transaction.tbl_penjualan_gofitku.deleteMany({
      where: {
        uuid_outlet_insanku: { in: outlet_relation_uuids },
      },
    });
  }

  await transaction.tbl_atribut_insanku.deleteMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
    },
  });
  await transaction.tbl_nilai_magang.deleteMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
    },
  });
  await transaction.tbl_target_gofitku.deleteMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
    },
  });
  await transaction.tbl_outlet_insanku.deleteMany({
    where: {
      uuid_insanku: { in: insanku_uuids },
    },
  });
}
