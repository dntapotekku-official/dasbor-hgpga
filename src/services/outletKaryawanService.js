import { prisma } from "@/lib/prisma";

function dedupeByUuid(items) {
  return Array.from(
    new Map(items.map((item) => [item.uuid, item])).values(),
  );
}

export async function syncOutletKaryawan() {
  const result = await fetch(process.env.OUTLET_SLIPGAJI_API_URL, {
    headers: {
      "x-api-key": process.env.SLIPGAJI_AUDIT_API_KEY,
    },
  });

  if (!result.ok) {
    throw new Error(`Gagal menyinkronkan data outlet beserta karyawan: ${result.status}`);
  }

  const data = await result.json();
  const outlet_payload = data?.data && typeof data.data === "object"
    ? data.data
    : data;

  if (!outlet_payload || typeof outlet_payload !== "object") {
    throw new Error("Format response outlet-karyawan tidak valid.");
  }

  const data_outlet = [];
  const data_karyawan = [];

  Object.entries(outlet_payload).forEach(([key, value]) => {
    const [uuid, ...nama_outlet_parts] = key.split("_");
    const nama_outlet = nama_outlet_parts.join("_");

    data_outlet.push({
      uuid,
      name: nama_outlet,
    });

    if (!Array.isArray(value)) {
      throw new Error(`Format karyawan untuk outlet ${key} tidak valid.`);
    }

    value.forEach((karyawan) => {
      const username = karyawan.username?.trim();

      data_karyawan.push({
        uuid: karyawan.id_karyawans,
        uuid_outlet: uuid,
        name: karyawan.nama?.trim() || "-",
        username: username || `user_${karyawan.id_karyawans}`,
        password: karyawan.password ?? null,
        is_username_change: false,
        is_password_change: false,
        avatar: karyawan.foto_profile ?? null,
      });
    });
  });

  const unique_outlet = dedupeByUuid(data_outlet);
  const unique_karyawan = dedupeByUuid(data_karyawan);

  const existing_outlet = await prisma.tbl_outlet.findMany({
    select: { uuid: true },
  });

  const existing_karyawan = await prisma.tbl_karyawan.findMany({
    select: { uuid: true },
  });

  const existing_outlet_set = new Set(existing_outlet.map((item) => item.uuid));
  const existing_karyawan_set = new Set(existing_karyawan.map((item) => item.uuid));

  const new_outlet = unique_outlet.filter((item) => !existing_outlet_set.has(item.uuid));
  const update_outlet = unique_outlet.filter((item) => existing_outlet_set.has(item.uuid));

  const new_karyawan = unique_karyawan.filter((item) => !existing_karyawan_set.has(item.uuid));
  const update_karyawan = unique_karyawan.filter((item) => existing_karyawan_set.has(item.uuid));

  await prisma.$transaction(async (tx) => {
    if (new_outlet.length > 0) {
      await tx.tbl_outlet.createMany({
        data: new_outlet,
        skipDuplicates: true,
      });
    }

    if (new_karyawan.length > 0) {
      await tx.tbl_karyawan.createMany({
        data: new_karyawan,
        skipDuplicates: true,
      });
    }

    await Promise.all(
      update_outlet.map((item) =>
        tx.tbl_outlet.update({
          where: { uuid: item.uuid },
          data: {
            name: item.name,
            deleted_at: null,
          },
        }),
      ),
    );

    await Promise.all(
      update_karyawan.map((item) =>
        tx.tbl_karyawan.update({
          where: { uuid: item.uuid },
          data: {
            uuid_outlet: item.uuid_outlet,
            name: item.name,
            username: item.username,
            password: item.password,
            avatar: item.avatar,
            deleted_at: null,
          },
        }),
      ),
    );
  });

  return {
    success: true,
    data: {
      data_outlet: unique_outlet,
      data_karyawan: unique_karyawan,
    },
    summary: {
      inserted_outlet: new_outlet.length,
      updated_outlet: update_outlet.length,
      inserted_karyawan: new_karyawan.length,
      updated_karyawan: update_karyawan.length,
    },
  };
}

export async function getOutletKaryawan() {
  const [data_outlet, data_karyawan] = await Promise.all([
    prisma.tbl_outlet.findMany(),
    prisma.tbl_karyawan.findMany({
      select: {
        uuid: true,
        name: true,
        username: true,
        outlet: {
          select: { name: true },
        },
      },
    }),
  ]);

  return {
    data_outlet,
    data_karyawan: data_karyawan.map((item) => ({
      uuid: item.uuid,
      name: item.name,
      username: item.username,
      outlet_name: item.outlet?.name ?? "-",
    })),
  };
}
