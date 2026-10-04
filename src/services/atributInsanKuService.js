import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/role";
import { emit_socket_event } from "@/lib/socket";
import { hardDeleteInsanKuRelations } from "@/services/hardDeleteInsanKuRelations";
import { softDeleteInsanKuRelations } from "@/services/softDeleteInsanKuRelations";
import { syncInsanKu } from "@/services/insanKuService";
import { syncOutletInsanKu } from "@/services/outletInsanKuService";

function normalize_name(name) {
  return String(name ?? "").trim();
}

function normalize_attribute_type(type) {
  return String(type ?? "").trim().toLowerCase();
}

function normalize_attribute_flags({
  is_attribute,
  is_edit,
  is_view,
  is_summary_visible = true,
}) {
  const can_view = Boolean(is_view);

  return {
    is_attribute: Boolean(is_attribute),
    is_view: can_view,
    is_edit: can_view ? Boolean(is_edit) : false,
    is_summary_visible: Boolean(is_summary_visible),
  };
}

async function resolve_range_with(transaction, { range_with, uuid, type }) {
  const normalized_range_with = String(range_with ?? "").trim();

  if (!normalized_range_with) {
    return null;
  }

  if (normalize_attribute_type(type) !== "date") {
    throw new Error("Rentang hanya dapat dibuat untuk kolom bertipe tanggal.");
  }

  if (normalized_range_with === uuid) {
    throw new Error("Kolom tanggal tidak dapat dipasangkan dengan dirinya sendiri.");
  }

  const paired_attribute = await transaction.tbl_kolom_atribut.findUnique({
    where: {
      uuid: normalized_range_with,
    },
    select: {
      uuid: true,
      type: true,
      deleted_at: true,
    },
  });

  if (
    !paired_attribute ||
    paired_attribute.deleted_at ||
    normalize_attribute_type(paired_attribute.type) !== "date"
  ) {
    throw new Error("Kolom pasangan rentang harus bertipe tanggal dan masih aktif.");
  }

  const existing_range = await transaction.tbl_kolom_atribut.findFirst({
    where: {
      range_with: normalized_range_with,
      deleted_at: null,
      ...(uuid ? { uuid: { not: uuid } } : {}),
    },
    select: {
      uuid: true,
    },
  });

  if (existing_range) {
    throw new Error("Kolom tanggal yang dipilih sudah memiliki pasangan rentang.");
  }

  return paired_attribute.uuid;
}

function normalize_attribute_value_by_type(type, value) {
  const normalized_type = normalize_attribute_type(type);

  if (normalized_type === "checkbox") {
    const normalized_value = String(value ?? "").trim().toLowerCase();

    if (value === true || ["true", "1", "ya", "yes"].includes(normalized_value)) {
      return "true";
    }

    return "false";
  }

  if (normalized_type === "number") {
    const normalized_value = String(value ?? "").trim();

    if (!normalized_value) {
      return "";
    }

    const parsed_number = Number(normalized_value);

    if (!Number.isFinite(parsed_number)) {
      throw new Error("Nilai atribut angka tidak valid.");
    }

    return normalized_value;
  }

  if (normalized_type === "date") {
    return String(value ?? "").trim();
  }

  return String(value ?? "").trim();
}

function format_attribute_value_for_response(type, value) {
  const normalized_type = normalize_attribute_type(type);

  if (normalized_type === "checkbox") {
    return String(value ?? "").toLowerCase() === "true";
  }

  return String(value ?? "");
}

function is_attribute_value_valid_for_type(type, value) {
  const normalized_type = normalize_attribute_type(type);
  const normalized_value = String(value ?? "").trim();

  if (normalized_type === "checkbox") {
    return ["", "true", "false", "1", "0", "ya", "tidak", "yes", "no"].includes(
      normalized_value.toLowerCase(),
    );
  }

  if (normalized_type === "number") {
    if (!normalized_value) {
      return true;
    }

    return Number.isFinite(Number(normalized_value));
  }

  if (normalized_type === "date") {
    if (!normalized_value) {
      return true;
    }

    return !Number.isNaN(Date.parse(normalized_value));
  }

  return true;
}

export async function getAtributInsanku({ user_uuid, user_role } = {}) {
  const normalized_role = normalizeRole(user_role);
  const is_member = normalized_role === "member";
  const can_manage_attributes =
    normalized_role === "admin" || normalized_role === "superadmin";
  const can_edit_values =
    normalized_role === "member" ||
    can_manage_attributes;

  const [attributes, employees] = await Promise.all([
    prisma.tbl_kolom_atribut.findMany({
      where: {
        deleted_at: null,
        ...(is_member ? { is_view: true } : {}),
      },
      orderBy: [
        {
          order: "asc",
        },
        {
          created_at: "asc",
        },
      ],
      select: {
        uuid: true,
        name: true,
        type: true,
        is_attribute: true,
        range_with: true,
        is_edit: true,
        is_view: true,
        is_summary_visible: true,
        order: true,
      },
    }),
    prisma.tbl_insanku.findMany({
      where: {
        ...(is_member
          ? {
              outlet_insanku: {
                some: {
                  uuid_outlet: user_uuid,
                  deleted_at: null,
                  outlet: { deleted_at: null, excep: false },
                },
              },
            }
          : {}),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        uuid: true,
        is_slip_gaji_account: true,
        nik: true,
        name: true,
        username: true,
        deleted_at: true,
        atribut_insanku: {
          where: {
            deleted_at: null,
            atribut: {
              deleted_at: null,
            },
          },
          select: {
            value: true,
            uuid_atribut: true,
          },
        },
      },
    }),
  ]);

  return {
    actor_role: normalized_role,
    can_edit_values,
    can_manage_attributes,
    is_member_view: is_member,
    attribute_columns: attributes.map((attribute) => ({
      key: attribute.uuid,
      label: attribute.name,
      type: attribute.type,
      is_attribute: attribute.is_attribute,
      range_with: attribute.range_with,
      is_edit: attribute.is_edit,
      is_view: attribute.is_view,
      is_summary_visible: attribute.is_summary_visible,
      order: attribute.order,
    })),
    rows: employees.map((employee) => {
      const values_by_attribute = Object.fromEntries(
        employee.atribut_insanku.map((item) => [
          item.uuid_atribut,
          item.value,
        ]),
      );

      return {
        uuid: employee.uuid,
        is_slip_gaji_account: employee.is_slip_gaji_account,
        nik: employee.nik,
        name: employee.name,
        username: employee.username,
        is_active: employee.deleted_at === null,
        filled_attribute_keys: employee.atribut_insanku.map(
          (item) => item.uuid_atribut,
        ),
        attribute_values: Object.fromEntries(
          attributes.map((attribute) => [
            attribute.uuid,
            format_attribute_value_for_response(
              attribute.type,
              values_by_attribute[attribute.uuid],
            ),
          ]),
        ),
      };
    }),
  };
}

export async function updateAtributInsanKu({
  uuid_insanku,
  uuid_atribut,
  value,
  actor_uuid,
  actor_role,
}) {
  if (!uuid_insanku) {
    throw new Error("UUID InsanKu wajib diisi.");
  }

  if (!uuid_atribut) {
    throw new Error("UUID atribut wajib diisi.");
  }

  const normalized_role = normalizeRole(actor_role);
  const is_member = normalized_role === "member";
  const is_admin =
    normalized_role === "admin" || normalized_role === "superadmin";

  if (!is_member && !is_admin) {
    throw new Error("Tidak memiliki akses untuk mengubah atribut.");
  }

  const [employee, attribute] = await Promise.all([
    prisma.tbl_insanku.findFirst({
      where: {
        uuid: uuid_insanku,
        ...(is_member
          ? {
              outlet_insanku: {
                some: {
                  uuid_outlet: actor_uuid,
                  deleted_at: null,
                  outlet: { deleted_at: null, excep: false },
                },
              },
            }
          : {}),
      },
      select: {
        uuid: true,
        deleted_at: true,
      },
    }),
    prisma.tbl_kolom_atribut.findUnique({
      where: {
        uuid: uuid_atribut,
      },
      select: {
        uuid: true,
        type: true,
        is_attribute: true,
        is_edit: true,
        is_view: true,
        deleted_at: true,
      },
    }),
  ]);

  if (!employee || employee.deleted_at) {
    throw new Error("Data InsanKu tidak ditemukan.");
  }

  if (!attribute || attribute.deleted_at) {
    throw new Error("Data atribut tidak ditemukan.");
  }

  if (is_member && (!attribute.is_view || !attribute.is_edit)) {
    throw new Error("Atribut ini tidak dapat diubah dari InsanKu.");
  }

  const next_value = normalize_attribute_value_by_type(attribute.type, value);
  await prisma.tbl_atribut_insanku.upsert({
    where: {
      uuid_insanku_uuid_atribut: { uuid_insanku, uuid_atribut },
    },
    update: { value: next_value, deleted_at: null },
    create: {
      uuid: randomUUID(),
      uuid_insanku,
      uuid_atribut,
      value: next_value,
    },
  });

  const response_value = format_attribute_value_for_response(
    attribute.type,
    next_value,
  );

  emit_socket_event("attribute.value.changed", {
    uuid_insanku,
    uuid_atribut,
    value: response_value,
  });

  return {
    success: true,
    data: {
      uuid_insanku,
      uuid_atribut,
      value: response_value,
    },
    message: "Atribut InsanKu berhasil diperbarui.",
  };
}

export async function syncAtributInsanKuByNik({ actor_role }) {
  const normalized_role = normalizeRole(actor_role);
  const is_admin =
    normalized_role === "admin" || normalized_role === "superadmin";

  if (!is_admin) {
    throw new Error("Tidak memiliki akses untuk menyinkronkan oper atribut berdasarkan NIK.");
  }

  const [non_slip_accounts, slip_accounts] = await Promise.all([
    prisma.tbl_insanku.findMany({
      where: {
        is_slip_gaji_account: false,
        deleted_at: null,
        nik: { not: null },
      },
      select: {
        uuid: true,
        nik: true,
        atribut_insanku: {
          where: {
            deleted_at: null,
            atribut: { deleted_at: null },
          },
          select: {
            uuid_atribut: true,
            value: true,
          },
        },
      },
    }),
    prisma.tbl_insanku.findMany({
      where: {
        is_slip_gaji_account: true,
        deleted_at: null,
        nik: { not: null },
      },
      select: { uuid: true, nik: true },
    }),
  ]);
  const slip_account_by_nik = new Map(
    slip_accounts
      .filter((account) => String(account.nik ?? "").trim())
      .map((account) => [String(account.nik).trim(), account]),
  );
  const matched_accounts = non_slip_accounts
    .map((source) => ({
      source,
      target: slip_account_by_nik.get(String(source.nik ?? "").trim()),
    }))
    .filter(({ target }) => Boolean(target));
  let transferred_attributes = 0;

  await prisma.$transaction(async (tx) => {
    for (const { source, target } of matched_accounts) {
      for (const attribute of source.atribut_insanku) {
        await tx.tbl_atribut_insanku.upsert({
          where: {
            uuid_insanku_uuid_atribut: {
              uuid_insanku: target.uuid,
              uuid_atribut: attribute.uuid_atribut,
            },
          },
          update: {
            value: attribute.value,
            deleted_at: null,
          },
          create: {
            uuid: randomUUID(),
            uuid_insanku: target.uuid,
            uuid_atribut: attribute.uuid_atribut,
            value: attribute.value,
          },
        });
      }

      const sales_count = await tx.tbl_penjualan_gofitku.count({
        where: { outlet_insanku: { uuid_insanku: source.uuid } },
      });
      if (sales_count > 0) {
        const deleted_at = new Date();
        await softDeleteInsanKuRelations(tx, [source.uuid], deleted_at);
        await tx.tbl_insanku.update({
          where: { uuid: source.uuid },
          data: { deleted_at },
        });
      } else {
        await hardDeleteInsanKuRelations(tx, [source.uuid]);
        await tx.tbl_insanku.delete({
          where: { uuid: source.uuid },
        });
      }
      transferred_attributes += source.atribut_insanku.length;
    }
  });

  emit_socket_event("attribute.sync.completed", {
    operation: "automatic-transfer-by-nik",
    transferred_non_slip_insanku: matched_accounts.length,
    transferred_attributes,
  });

  return {
    success: true,
    data: {
      transferred_non_slip_insanku: matched_accounts.length,
      transferred_attributes,
    },
    message: matched_accounts.length
      ? `${matched_accounts.length} akun Non Slip Gaji berhasil dioper otomatis ke Slip Gaji berdasarkan NIK.`
      : "Sinkronisasi selesai. Tidak ada NIK Non Slip Gaji yang cocok dengan Slip Gaji.",
  };
}

export async function syncAtributInsanKuData({ actor_role }) {
  const normalized_role = normalizeRole(actor_role);
  const can_sync =
    normalized_role === "member" ||
    normalized_role === "admin" ||
    normalized_role === "superadmin";

  if (!can_sync) {
    throw new Error("Tidak memiliki akses untuk menyinkronkan data atribut InsanKu.");
  }

  const insanku_result = await syncInsanKu();
  const outlet_insanku_result = await syncOutletInsanKu();

  emit_socket_event("attribute.sync.completed", {
    operation: "sync-insanku-outlet-placement",
    synced_insanku: insanku_result?.summary?.inserted_insanku ?? 0,
    synced_outlet_insanku:
      outlet_insanku_result?.summary?.synced_outlet_insanku ?? 0,
  });

  return {
    success: true,
    data: {
      insanku: insanku_result?.summary ?? null,
      outlet_insanku: outlet_insanku_result?.summary ?? null,
    },
    message: "Data InsanKu dan penempatan outlet berhasil disinkronkan.",
  };
}

export async function importAtributInsanKu({
  rows,
  active_tab,
  active_category,
  actor_role,
}) {
  const normalized_role = normalizeRole(actor_role);
  const is_admin =
    normalized_role === "admin" || normalized_role === "superadmin";

  if (!is_admin) {
    throw new Error("Tidak memiliki akses untuk mengimpor atribut.");
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("File Excel tidak memiliki data yang dapat diimpor.");
  }

  if (rows.length > 5000) {
    throw new Error("Maksimal 5.000 baris dapat diimpor sekaligus.");
  }

  if (!["aktif", "non-aktif"].includes(active_tab)) {
    throw new Error("Tab impor tidak valid.");
  }

  if (!["slip-gaji", "non-slip-gaji"].includes(active_category)) {
    throw new Error("Kategori impor tidak valid.");
  }

  const category_label =
    active_category === "slip-gaji" ? "Slip Gaji" : "Non Slip Gaji";

  const normalized_rows = rows.map((row) => ({
    username: String(row?.username ?? "").trim(),
    values:
      row?.values && typeof row.values === "object" && !Array.isArray(row.values)
        ? row.values
        : {},
  }));
  const usernames = normalized_rows.map((row) => row.username).filter(Boolean);

  if (!usernames.length) {
    throw new Error("Kolom Username pada file Excel masih kosong.");
  }

  if (new Set(usernames).size !== usernames.length) {
    throw new Error("File Excel memiliki Username yang duplikat.");
  }

  const employee_where = {
    username: { in: usernames },
    deleted_at: active_tab === "aktif" ? null : { not: null },
    is_slip_gaji_account: active_category === "slip-gaji",
  };
  const attribute_uuids = Array.from(
    new Set(normalized_rows.flatMap((row) => Object.keys(row.values))),
  );
  const [employees, attributes] = await Promise.all([
    prisma.tbl_insanku.findMany({
      where: employee_where,
      select: {
        uuid: true,
        username: true,
      },
    }),
    prisma.tbl_kolom_atribut.findMany({
      where: {
        uuid: { in: attribute_uuids },
        deleted_at: null,
      },
      select: {
        uuid: true,
        type: true,
        is_attribute: true,
        is_edit: true,
        is_view: true,
      },
    }),
  ]);
  const employee_map = new Map(employees.map((employee) => [employee.username, employee]));
  const attribute_map = new Map(attributes.map((attribute) => [attribute.uuid, attribute]));
  const unmatched_usernames = usernames.filter((username) => !employee_map.has(username));

  if (unmatched_usernames.length) {
    throw new Error(
      `${unmatched_usernames.length} Username tidak ditemukan pada kategori ${category_label} tab ${active_tab}.`,
    );
  }

  if (attribute_map.size !== attribute_uuids.length) {
    throw new Error("Sebagian atribut pada file Excel sudah tidak tersedia.");
  }

  const updates = [];

  for (const row of normalized_rows) {
    const employee = employee_map.get(row.username);

    for (const [uuid_atribut, raw_value] of Object.entries(row.values)) {
      const attribute = attribute_map.get(uuid_atribut);

      if (is_member && (!attribute.is_view || !attribute.is_edit)) {
        throw new Error("File memuat atribut yang tidak dapat diubah oleh InsanKu.");
      }

      if (!is_attribute_value_valid_for_type(attribute.type, raw_value)) {
        throw new Error(`Nilai atribut untuk Username ${row.username} tidak valid.`);
      }

      updates.push({
        uuid_insanku: employee.uuid,
        uuid_atribut,
        value: normalize_attribute_value_by_type(attribute.type, raw_value),
      });
    }
  }

  if (!updates.length) {
    throw new Error("File Excel tidak memiliki nilai atribut yang dapat diimpor.");
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.tbl_atribut_insanku.upsert({
        where: {
          uuid_insanku_uuid_atribut: {
            uuid_insanku: update.uuid_insanku,
            uuid_atribut: update.uuid_atribut,
          },
        },
        update: {
          value: update.value,
          deleted_at: null,
        },
        create: {
          uuid: randomUUID(),
          ...update,
        },
      }),
    ),
  );

  emit_socket_event("attribute.sync.completed", {
    source: "excel-import",
    active_tab,
    active_category,
  });

  return {
    success: true,
    data: {
      imported_employees: normalized_rows.length,
      updated_attributes: updates.length,
    },
    message: `Impor atribut berhasil untuk ${normalized_rows.length} InsanKu ${category_label} pada tab ${active_tab}.`,
  };
}

export async function getAtributMaster() {
  const data_atribut = await prisma.tbl_kolom_atribut.findMany({
    where: {
      deleted_at: null,
    },
    orderBy: [
      {
        order: "asc",
      },
      {
        created_at: "asc",
      },
    ],
    select: {
      uuid: true,
      name: true,
      type: true,
      is_attribute: true,
      range_with: true,
      is_edit: true,
      is_view: true,
      is_summary_visible: true,
      order: true,
    },
  });

  return {
    data_atribut,
  };
}

export async function createAtribut({
  name,
  type,
  is_attribute,
  range_with,
  is_edit,
  is_view,
  is_summary_visible,
}) {
  const trimmed_name = normalize_name(name);
  const normalized_type = normalize_attribute_type(type);
  const normalized_flags = normalize_attribute_flags({
    is_attribute,
    is_edit,
    is_view,
    is_summary_visible,
  });

  if (!trimmed_name) {
    throw new Error("Nama kolom atribut wajib diisi.");
  }

  if (!normalized_type) {
    throw new Error("Jenis kolom atribut wajib diisi.");
  }

  const existing_attribute = await prisma.tbl_kolom_atribut.findFirst({
    where: {
      name: trimmed_name,
      deleted_at: null,
    },
    select: {
      uuid: true,
    },
  });

  if (existing_attribute) {
    throw new Error("Nama kolom atribut sudah digunakan.");
  }

  const last_attribute = await prisma.tbl_kolom_atribut.findFirst({
    where: {
      deleted_at: null,
    },
    orderBy: {
      order: "desc",
    },
    select: {
      order: true,
    },
  });

  const created_uuid = randomUUID();
  const created_attribute = await prisma.$transaction(async (transaction) => {
    const range_with_uuid = await resolve_range_with(transaction, {
      range_with,
      uuid: created_uuid,
      type: normalized_type,
    });
    const created_row = await transaction.tbl_kolom_atribut.create({
      data: {
        uuid: created_uuid,
        name: trimmed_name,
        type: normalized_type,
        is_attribute: normalized_flags.is_attribute,
        range_with: range_with_uuid,
        is_view: normalized_flags.is_view,
        is_edit: normalized_flags.is_edit,
        is_summary_visible: normalized_flags.is_summary_visible,
        order: (last_attribute?.order ?? 0) + 1,
      },
      select: {
        uuid: true,
        name: true,
        type: true,
        is_attribute: true,
        range_with: true,
        is_edit: true,
        is_view: true,
        is_summary_visible: true,
        order: true,
      },
    });

    return created_row;
  });

  emit_socket_event("attribute.master.changed", {
    action: "created",
    uuid_atribut: created_attribute.uuid,
  });

  return {
    success: true,
    data: created_attribute,
    message: "Kolom atribut berhasil ditambahkan.",
  };
}

export async function updateAtribut({
  uuid_atribut,
  name,
  type,
  is_attribute,
  range_with,
  is_edit,
  is_view,
  is_summary_visible,
}) {
  if (!uuid_atribut) {
    throw new Error("UUID kolom atribut wajib diisi.");
  }

  const trimmed_name = normalize_name(name);
  const normalized_type = normalize_attribute_type(type);
  const normalized_flags = normalize_attribute_flags({
    is_attribute,
    is_edit,
    is_view,
    is_summary_visible,
  });

  if (!trimmed_name) {
    throw new Error("Nama kolom atribut wajib diisi.");
  }

  if (!normalized_type) {
    throw new Error("Jenis kolom atribut wajib diisi.");
  }

  const existing_attribute = await prisma.tbl_kolom_atribut.findUnique({
    where: {
      uuid: uuid_atribut,
    },
    select: {
      uuid: true,
      type: true,
      deleted_at: true,
    },
  });

  if (!existing_attribute || existing_attribute.deleted_at) {
    throw new Error("Data kolom atribut tidak ditemukan.");
  }

  const duplicate_attribute = await prisma.tbl_kolom_atribut.findFirst({
    where: {
      name: trimmed_name,
      deleted_at: null,
      uuid: {
        not: uuid_atribut,
      },
    },
    select: {
      uuid: true,
    },
  });

  if (duplicate_attribute) {
    throw new Error("Nama kolom atribut sudah digunakan.");
  }

  const attribute_value_rows = await prisma.tbl_atribut_insanku.findMany({
    where: {
      uuid_atribut,
      deleted_at: null,
    },
    select: {
      uuid: true,
      value: true,
    },
  });

  const invalid_value_count = attribute_value_rows.filter(
    (row) => !is_attribute_value_valid_for_type(normalized_type, row.value),
  ).length;

  if (invalid_value_count > 0) {
    throw new Error(
      `Jenis atribut tidak bisa diubah karena ada ${invalid_value_count} data InsanKu yang tidak cocok dengan jenis baru.`,
    );
  }

  const updated_attribute = await prisma.$transaction(async (transaction) => {
    const range_with_uuid = await resolve_range_with(transaction, {
      range_with,
      uuid: uuid_atribut,
      type: normalized_type,
    });

    const updated_row = await transaction.tbl_kolom_atribut.update({
      where: {
        uuid: uuid_atribut,
      },
      data: {
        name: trimmed_name,
        type: normalized_type,
        is_attribute: normalized_flags.is_attribute,
        range_with: range_with_uuid,
        is_view: normalized_flags.is_view,
        is_edit: normalized_flags.is_edit,
        is_summary_visible: normalized_flags.is_summary_visible,
      },
      select: {
        uuid: true,
        name: true,
        type: true,
        is_attribute: true,
        range_with: true,
        is_edit: true,
        is_view: true,
        is_summary_visible: true,
        order: true,
      },
    });

    if (existing_attribute.type !== normalized_type) {
      await Promise.all(
        attribute_value_rows.map((row) =>
          transaction.tbl_atribut_insanku.update({
            where: {
              uuid: row.uuid,
            },
            data: {
              value: normalize_attribute_value_by_type(
                normalized_type,
                row.value,
              ),
            },
          }),
        ),
      );
    }

    return updated_row;
  });

  emit_socket_event("attribute.master.changed", {
    action: "updated",
    uuid_atribut,
  });

  return {
    success: true,
    data: updated_attribute,
    message: "Kolom atribut berhasil diperbarui.",
  };
}

export async function deleteAtribut({ uuid_atribut }) {
  if (!uuid_atribut) {
    throw new Error("UUID kolom atribut wajib diisi.");
  }

  const existing_attribute = await prisma.tbl_kolom_atribut.findUnique({
    where: {
      uuid: uuid_atribut,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_attribute || existing_attribute.deleted_at) {
    throw new Error("Data kolom atribut tidak ditemukan.");
  }

  await prisma.$transaction(async (transaction) => {
    const deleted_at = new Date();

    await transaction.tbl_kolom_atribut.updateMany({
      where: {
        range_with: uuid_atribut,
      },
      data: {
        range_with: null,
      },
    });

    await transaction.tbl_kolom_atribut.update({
      where: {
        uuid: uuid_atribut,
      },
      data: {
        range_with: null,
        deleted_at,
      },
    });

    await transaction.tbl_atribut_insanku.updateMany({
      where: {
        uuid_atribut,
        deleted_at: null,
      },
      data: {
        deleted_at,
      },
    });
  });

  emit_socket_event("attribute.master.changed", {
    action: "deleted",
    uuid_atribut,
  });

  return {
    success: true,
    message: "Kolom atribut berhasil dihapus.",
  };
}

export async function reorderAtribut({ ordered_uuids }) {
  if (!Array.isArray(ordered_uuids) || ordered_uuids.length === 0) {
    throw new Error("Urutan kolom atribut wajib diisi.");
  }

  const unique_ordered_uuids = [...new Set(ordered_uuids.filter(Boolean))];

  if (unique_ordered_uuids.length !== ordered_uuids.length) {
    throw new Error("Urutan kolom atribut tidak valid.");
  }

  const existing_attributes = await prisma.tbl_kolom_atribut.findMany({
    where: {
      uuid: {
        in: unique_ordered_uuids,
      },
      deleted_at: null,
    },
    select: {
      uuid: true,
    },
  });

  if (existing_attributes.length !== unique_ordered_uuids.length) {
    throw new Error("Ada kolom atribut yang tidak ditemukan.");
  }

  await prisma.$transaction(
    unique_ordered_uuids.map((uuid_atribut, index) =>
      prisma.tbl_kolom_atribut.update({
        where: {
          uuid: uuid_atribut,
        },
        data: {
          order: index + 1,
        },
      }),
    ),
  );

  emit_socket_event("attribute.master.changed", {
    action: "reordered",
  });

  return {
    success: true,
    message: "Urutan kolom atribut berhasil diperbarui.",
  };
}
