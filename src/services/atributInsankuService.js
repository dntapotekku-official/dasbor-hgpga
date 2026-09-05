import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/role";
import { emit_socket_event } from "@/lib/socket";

function normalize_name(name) {
  return String(name ?? "").trim();
}

function normalize_attribute_type(type) {
  return String(type ?? "").trim().toLowerCase();
}

function normalize_attribute_flags({ is_edit, is_view }) {
  const can_view = Boolean(is_view);

  return {
    is_view: can_view,
    is_edit: can_view ? Boolean(is_edit) : false,
  };
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
  const can_edit_values =
    normalized_role === "member" ||
    normalized_role === "admin" ||
    normalized_role === "superadmin";

  const [attributes, employees] = await Promise.all([
    prisma.tbl_atribut.findMany({
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
        is_edit: true,
        is_view: true,
        order: true,
      },
    }),
    prisma.tbl_insanku.findMany({
      where: {
        ...(is_member ? { uuid: user_uuid } : {}),
      },
      orderBy: {
        name: "asc",
      },
      select: {
        uuid: true,
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
    is_member_view: is_member,
    attribute_columns: attributes.map((attribute) => ({
      key: attribute.uuid,
      label: attribute.name,
      type: attribute.type,
      is_edit: attribute.is_edit,
      is_view: attribute.is_view,
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
        name: employee.name,
        username: employee.username,
        is_active: employee.deleted_at === null,
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

  if (is_member && uuid_insanku !== actor_uuid) {
    throw new Error("Atribut hanya dapat diubah untuk akun sendiri.");
  }

  const [employee, attribute] = await Promise.all([
    prisma.tbl_insanku.findUnique({
      where: {
        uuid: uuid_insanku,
      },
      select: {
        uuid: true,
        deleted_at: true,
      },
    }),
    prisma.tbl_atribut.findUnique({
      where: {
        uuid: uuid_atribut,
      },
      select: {
        uuid: true,
        type: true,
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
  const existing_rows = await prisma.tbl_atribut_insanku.findMany({
    where: {
      uuid_insanku,
      uuid_atribut,
      deleted_at: null,
    },
    select: {
      uuid: true,
    },
  });

  if (existing_rows.length === 0) {
    await prisma.tbl_atribut_insanku.create({
      data: {
        uuid: randomUUID(),
        uuid_insanku,
        uuid_atribut,
        value: next_value,
      },
    });
  } else {
    await prisma.tbl_atribut_insanku.updateMany({
      where: {
        uuid_insanku,
        uuid_atribut,
        deleted_at: null,
      },
      data: {
        value: next_value,
      },
    });
  }

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

export async function importAtributInsanKu({
  rows,
  active_tab,
  actor_uuid,
  actor_role,
}) {
  const normalized_role = normalizeRole(actor_role);
  const is_member = normalized_role === "member";
  const is_admin =
    normalized_role === "admin" || normalized_role === "superadmin";

  if (!is_member && !is_admin) {
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
    ...(is_member ? { uuid: actor_uuid } : {}),
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
    prisma.tbl_atribut.findMany({
      where: {
        uuid: { in: attribute_uuids },
        deleted_at: null,
      },
      select: {
        uuid: true,
        type: true,
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
      `${unmatched_usernames.length} Username tidak ditemukan pada tab ${active_tab}.`,
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
  });

  return {
    success: true,
    data: {
      imported_employees: normalized_rows.length,
      updated_attributes: updates.length,
    },
    message: `Impor atribut berhasil untuk ${normalized_rows.length} InsanKu pada tab ${active_tab}.`,
  };
}

export async function getAtributMaster() {
  const data_atribut = await prisma.tbl_atribut.findMany({
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
      is_edit: true,
      is_view: true,
      order: true,
    },
  });

  return {
    data_atribut,
  };
}

export async function createAtribut({ name, type, is_edit, is_view }) {
  const trimmed_name = normalize_name(name);
  const normalized_type = normalize_attribute_type(type);
  const normalized_flags = normalize_attribute_flags({ is_edit, is_view });

  if (!trimmed_name) {
    throw new Error("Nama atribut wajib diisi.");
  }

  if (!normalized_type) {
    throw new Error("Jenis atribut wajib diisi.");
  }

  const existing_attribute = await prisma.tbl_atribut.findFirst({
    where: {
      name: trimmed_name,
      type: normalized_type,
      deleted_at: null,
    },
    select: {
      uuid: true,
    },
  });

  if (existing_attribute) {
    throw new Error("Nama atribut sudah digunakan.");
  }

  const last_attribute = await prisma.tbl_atribut.findFirst({
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

  const created_attribute = await prisma.tbl_atribut.create({
    data: {
      uuid: randomUUID(),
      name: trimmed_name,
      type: normalized_type,
      is_view: normalized_flags.is_view,
      is_edit: normalized_flags.is_edit,
      order: (last_attribute?.order ?? 0) + 1,
    },
    select: {
      uuid: true,
      name: true,
      type: true,
      is_edit: true,
      is_view: true,
      order: true,
    },
  });

  emit_socket_event("attribute.master.changed", {
    action: "created",
    uuid_atribut: created_attribute.uuid,
  });

  return {
    success: true,
    data: created_attribute,
    message: "Atribut berhasil ditambahkan.",
  };
}

export async function updateAtribut({ uuid_atribut, name, type, is_edit, is_view }) {
  if (!uuid_atribut) {
    throw new Error("UUID atribut wajib diisi.");
  }

  const trimmed_name = normalize_name(name);
  const normalized_type = normalize_attribute_type(type);
  const normalized_flags = normalize_attribute_flags({ is_edit, is_view });

  if (!trimmed_name) {
    throw new Error("Nama atribut wajib diisi.");
  }

  if (!normalized_type) {
    throw new Error("Jenis atribut wajib diisi.");
  }

  const existing_attribute = await prisma.tbl_atribut.findUnique({
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
    throw new Error("Data atribut tidak ditemukan.");
  }

  const duplicate_attribute = await prisma.tbl_atribut.findFirst({
    where: {
      name: trimmed_name,
      type: normalized_type,
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
    throw new Error("Nama atribut sudah digunakan.");
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
    const updated_row = await transaction.tbl_atribut.update({
      where: {
        uuid: uuid_atribut,
      },
      data: {
        name: trimmed_name,
        type: normalized_type,
        is_view: normalized_flags.is_view,
        is_edit: normalized_flags.is_edit,
      },
      select: {
        uuid: true,
        name: true,
        type: true,
        is_edit: true,
        is_view: true,
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
    message: "Atribut berhasil diperbarui.",
  };
}

export async function deleteAtribut({ uuid_atribut }) {
  if (!uuid_atribut) {
    throw new Error("UUID atribut wajib diisi.");
  }

  const existing_attribute = await prisma.tbl_atribut.findUnique({
    where: {
      uuid: uuid_atribut,
    },
    select: {
      uuid: true,
      deleted_at: true,
    },
  });

  if (!existing_attribute || existing_attribute.deleted_at) {
    throw new Error("Data atribut tidak ditemukan.");
  }

  await prisma.$transaction(async (transaction) => {
    const deleted_at = new Date();

    await transaction.tbl_atribut.update({
      where: {
        uuid: uuid_atribut,
      },
      data: {
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
    message: "Atribut berhasil dihapus.",
  };
}

export async function reorderAtribut({ ordered_uuids }) {
  if (!Array.isArray(ordered_uuids) || ordered_uuids.length === 0) {
    throw new Error("Urutan atribut wajib diisi.");
  }

  const unique_ordered_uuids = [...new Set(ordered_uuids.filter(Boolean))];

  if (unique_ordered_uuids.length !== ordered_uuids.length) {
    throw new Error("Urutan atribut tidak valid.");
  }

  const existing_attributes = await prisma.tbl_atribut.findMany({
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
    throw new Error("Ada atribut yang tidak ditemukan.");
  }

  await prisma.$transaction(
    unique_ordered_uuids.map((uuid_atribut, index) =>
      prisma.tbl_atribut.update({
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
    message: "Urutan atribut berhasil diperbarui.",
  };
}
