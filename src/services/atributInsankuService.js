import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/role";

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
    if (value === true || value === "true" || value === "1" || value === 1) {
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
    return ["", "true", "false", "1", "0"].includes(
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
      orderBy: {
        order: "asc",
      },
      select: {
        uuid: true,
        name: true,
        type: true,
        is_edit: true,
        is_view: true,
        order: true,
      },
    }),
    prisma.tbl_karyawan.findMany({
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
        atribut_karyawan: {
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
        employee.atribut_karyawan.map((item) => [
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

export async function updateAtributKaryawan({
  uuid_karyawan,
  uuid_atribut,
  value,
  actor_uuid,
  actor_role,
}) {
  if (!uuid_karyawan) {
    throw new Error("UUID karyawan wajib diisi.");
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

  if (is_member && uuid_karyawan !== actor_uuid) {
    throw new Error("Atribut hanya dapat diubah untuk akun sendiri.");
  }

  const [employee, attribute] = await Promise.all([
    prisma.tbl_karyawan.findUnique({
      where: {
        uuid: uuid_karyawan,
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
    throw new Error("Data karyawan tidak ditemukan.");
  }

  if (!attribute || attribute.deleted_at) {
    throw new Error("Data atribut tidak ditemukan.");
  }

  if (is_member && (!attribute.is_view || !attribute.is_edit)) {
    throw new Error("Atribut ini tidak dapat diubah dari InsanKu.");
  }

  const next_value = normalize_attribute_value_by_type(attribute.type, value);
  const existing_rows = await prisma.tbl_atribut_karyawan.findMany({
    where: {
      uuid_karyawan,
      uuid_atribut,
      deleted_at: null,
    },
    select: {
      uuid: true,
    },
  });

  if (existing_rows.length === 0) {
    await prisma.tbl_atribut_karyawan.create({
      data: {
        uuid: randomUUID(),
        uuid_karyawan,
        uuid_atribut,
        value: next_value,
      },
    });
  } else {
    await prisma.tbl_atribut_karyawan.updateMany({
      where: {
        uuid_karyawan,
        uuid_atribut,
        deleted_at: null,
      },
      data: {
        value: next_value,
      },
    });
  }

  return {
    success: true,
    data: {
      uuid_karyawan,
      uuid_atribut,
      value: next_value,
    },
    message: "Atribut karyawan berhasil diperbarui.",
  };
}

export async function getAtributMaster() {
  const data_atribut = await prisma.tbl_atribut.findMany({
    where: {
      deleted_at: null,
    },
    orderBy: {
      order: "asc",
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

  const created_attribute = await prisma.tbl_atribut.create({
    data: {
      uuid: randomUUID(),
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
      deleted_at: true
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

  const attribute_value_rows = await prisma.tbl_atribut_karyawan.findMany({
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
      `Jenis atribut tidak bisa diubah karena ada ${invalid_value_count} data karyawan yang tidak cocok dengan jenis baru.`,
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
          transaction.tbl_atribut_karyawan.update({
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

    await transaction.tbl_atribut_karyawan.updateMany({
      where: {
        uuid_atribut,
        deleted_at: null,
      },
      data: {
        deleted_at,
      },
    });
  });

  return {
    success: true,
    message: "Atribut berhasil dihapus.",
  };
}
