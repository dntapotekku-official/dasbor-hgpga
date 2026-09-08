import { prisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/role";

function is_filled_attribute(item) {
  if (item?.atribut?.type === "checkbox") {
    return String(item.value ?? "").toLowerCase() === "true";
  }

  return String(item?.value ?? "").trim() !== "";
}

function get_month_boundaries(today = new Date()) {
  return {
    start: new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)),
    end: new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 1)),
  };
}

async function get_member_overview(user, period) {
  const [required_attribute_count, member] = await Promise.all([
    prisma.tbl_kolom_atribut.count({
      where: {
        deleted_at: null,
        is_attribute: true,
        is_view: true,
      },
    }),
    prisma.tbl_insanku.findFirst({
      where: {
        uuid: user.uuid,
        deleted_at: null,
      },
      select: {
        nik: true,
        is_slip_gaji_account: true,
        outlet_insanku: {
          where: {
            deleted_at: null,
            outlet: {
              deleted_at: null,
              excep: false,
            },
          },
          select: {
            outlet: {
              select: {
                uuid: true,
                name: true,
              },
            },
            penjualan_gofitku: {
              where: {
                deleted_at: null,
                date: { gte: period.start, lt: period.end },
              },
              select: { qty: true },
            },
          },
        },
        atribut_insanku: {
          where: {
            deleted_at: null,
            atribut: {
              deleted_at: null,
              is_attribute: true,
              is_view: true,
            },
          },
          select: {
            value: true,
            atribut: { select: { type: true } },
          },
        },
        nilai_magang: {
          where: {
            deleted_at: null,
            date: { gte: period.start, lt: period.end },
          },
          orderBy: { updated_at: "desc" },
          take: 1,
          select: { value: true },
        },
      },
    }),
  ]);

  const filled_attribute_count =
    member?.atribut_insanku.filter(is_filled_attribute).length ?? 0;
  const attribute_percentage = required_attribute_count
    ? Math.round((filled_attribute_count / required_attribute_count) * 100)
    : 100;
  const monthly_sales =
    member?.outlet_insanku.reduce(
      (total, relation) =>
        total +
        relation.penjualan_gofitku.reduce(
          (relation_total, sale) => relation_total + Number(sale.qty || 0),
          0,
        ),
      0,
    ) ?? 0;
  const outlets = (member?.outlet_insanku ?? [])
    .map((item) => item.outlet)
    .filter(Boolean);
  const internship_score = member?.nilai_magang?.[0]?.value;
  const notices = [];

  if (!outlets.length) {
    notices.push({
      tone: "warning",
      title: "Penempatan outlet belum tersedia",
      description: "Hubungi admin agar penempatan outlet Anda dapat dilengkapi.",
    });
  }

  if (attribute_percentage < 100) {
    notices.push({
      tone: "warning",
      title: `${required_attribute_count - filled_attribute_count} atribut belum lengkap`,
      description: "Lengkapi data Atribut InsanKu agar profil operasional Anda selalu terbaru.",
    });
  } else {
    notices.push({
      tone: "success",
      title: "Atribut utama sudah lengkap",
      description: "Tidak ada atribut wajib yang perlu Anda lengkapi saat ini.",
    });
  }

  return {
    stats: [
      {
        key: "outlets",
        label: "Outlet",
        value: outlets.length.toLocaleString("id-ID"),
        caption: outlets[0]?.name ?? "Belum ada penempatan",
        tone: "sky",
      },
      {
        key: "attributes",
        label: "Atribut",
        value: `${attribute_percentage}%`,
        caption: `${filled_attribute_count} dari ${required_attribute_count} atribut`,
        tone: attribute_percentage === 100 ? "emerald" : "amber",
      },
      {
        key: "internship",
        label: "Nilai Magang",
        value:
          internship_score == null
            ? "—"
            : Number(internship_score).toLocaleString("id-ID", {
                maximumFractionDigits: 2,
              }),
        caption: internship_score == null ? "Belum ada nilai" : "Nilai rapor terbaru",
        tone: "violet",
      },
      {
        key: "sales",
        label: "Penjualan",
        value: monthly_sales.toLocaleString("id-ID"),
        caption: "Total produk bulan ini",
        tone: "rose",
      },
    ],
    notices,
    profile: {
      nik: member?.nik ?? null,
      account_type: member?.is_slip_gaji_account
        ? "InsanKu Slip Gaji"
        : "InsanKu Non Slip Gaji",
      outlet_names: outlets.map((outlet) => outlet.name),
    },
  };
}

async function get_management_overview(user) {
  const [employees, required_attribute_count, outlet_count, admin_count] =
    await Promise.all([
      prisma.tbl_insanku.findMany({
        where: { deleted_at: null },
        select: {
          outlet_insanku: {
            where: {
              deleted_at: null,
              outlet: { deleted_at: null, excep: false },
            },
            select: { uuid: true },
          },
          atribut_insanku: {
            where: {
              deleted_at: null,
              atribut: { deleted_at: null, is_attribute: true },
            },
            select: {
              value: true,
              atribut: { select: { type: true } },
            },
          },
        },
      }),
      prisma.tbl_kolom_atribut.count({
        where: { deleted_at: null, is_attribute: true },
      }),
      prisma.tbl_outlet.count({
        where: { deleted_at: null, excep: false },
      }),
      normalizeRole(user.role) === "superadmin"
        ? prisma.tbl_admin.count({ where: { deleted_at: null } })
        : Promise.resolve(null),
    ]);

  const total_required_values = employees.length * required_attribute_count;
  const total_filled_values = employees.reduce(
    (total, employee) =>
      total + employee.atribut_insanku.filter(is_filled_attribute).length,
    0,
  );
  const attribute_percentage = total_required_values
    ? Math.round((total_filled_values / total_required_values) * 100)
    : 100;
  const employees_without_outlet = employees.filter(
    (employee) => employee.outlet_insanku.length === 0,
  ).length;
  const incomplete_employees = employees.filter(
    (employee) =>
      employee.atribut_insanku.filter(is_filled_attribute).length <
      required_attribute_count,
  ).length;
  const is_superadmin = normalizeRole(user.role) === "superadmin";
  const notices = [];

  if (employees_without_outlet) {
    notices.push({
      tone: "warning",
      title: `${employees_without_outlet} InsanKu belum memiliki outlet`,
      description: "Periksa penempatan pengguna agar pelaporan operasional tetap akurat.",
    });
  }

  if (incomplete_employees) {
    notices.push({
      tone: "warning",
      title: `${incomplete_employees} InsanKu belum melengkapi atribut`,
      description: "Pantau dan tindak lanjuti kelengkapan atribut wajib InsanKu.",
    });
  }

  if (!notices.length) {
    notices.push({
      tone: "success",
      title: "Data utama dalam kondisi baik",
      description: "Seluruh InsanKu aktif telah memiliki outlet dan atribut wajib yang lengkap.",
    });
  }

  return {
    stats: [
      {
        key: "employees",
        label: "InsanKu",
        value: employees.length.toLocaleString("id-ID"),
        caption: "Jumlah pengguna aktif",
        tone: "sky",
      },
      {
        key: "outlets",
        label: "Outlet",
        value: outlet_count.toLocaleString("id-ID"),
        caption: "Jumlah outlet aktif",
        tone: "violet",
      },
      {
        key: "attributes",
        label: "Atribut",
        value: `${attribute_percentage}%`,
        caption: `${incomplete_employees} pengguna belum lengkap`,
        tone: attribute_percentage === 100 ? "emerald" : "amber",
      },
      {
        key: is_superadmin ? "admins" : "access",
        label: is_superadmin ? "Admin" : "Menu",
        value: is_superadmin
          ? Number(admin_count ?? 0).toLocaleString("id-ID")
          : user.menu_access_keys.length.toLocaleString("id-ID"),
        caption: is_superadmin
          ? "Admin dan superadmin"
          : "Menu yang dapat Anda kelola",
        tone: "rose",
      },
    ],
    notices,
  };
}

export async function getDashboardOverview(user) {
  const role = normalizeRole(user?.role);
  const period = get_month_boundaries();

  if (role === "member") {
    return get_member_overview(user, period);
  }

  if (role === "admin" || role === "superadmin") {
    return get_management_overview(user);
  }

  throw new Error("Role dashboard tidak valid.");
}
