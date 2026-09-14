import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeDollarSignIcon,
  Building2Icon,
  CalendarDaysIcon,
  ChartNoAxesCombinedIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  ClipboardCheckIcon,
  IdCardIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  PieChartIcon,
  ShieldCheckIcon,
  ShoppingBasketIcon,
  UserRoundCogIcon,
  UsersRoundIcon,
} from "lucide-react";
import { connection } from "next/server";

import { ChartBarLabel } from "@/components/charts/chart-bar-label";
import { ChartPieDonutText } from "@/components/charts/chart-pie-donut-text";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import getCurrentUser from "@/lib/auth";
import { canAccessMenu } from "@/lib/menu-access";
import { outlet_category_slug_options } from "@/lib/outletCategories";
import { normalizeRole } from "@/lib/role";
import { getDashboardOverview } from "@/services/dashboardService";
import { getKepuasanInternalChart } from "@/services/kepuasanInternalService";
import { getNilaiTransaksiBasketSize } from "@/services/nilaiTransaksiBasketSizeService";
import {
  getPenjualanGofitkuTopOutletChart,
  getPenjualanGofitkuTopProdukChart,
} from "@/services/penjualanGofitkuService";
import KepatuhanSopCctvDashboardCard from "./components/kepatuhan-sop-cctv-dashboard-card";
import NilaiTransaksiBasketSizeDashboardCard from "./components/nilai-transaksi-basket-size-dashboard-card";

const ROLE_META = {
  member: {
    label: "Outlet",
    description:
      "Lihat ringkasan data InsanKu dan performa outlet Anda dalam satu tempat.",
    icon: IdCardIcon,
  },
  admin: {
    label: "Admin",
    description:
      "Pantau ringkasan operasional dan menu yang menjadi kewenangan Anda.",
    icon: ShieldCheckIcon,
  },
  superadmin: {
    label: "Superadmin",
    description:
      "Pantau ringkasan operasional dan pengaturan sistem secara menyeluruh.",
    icon: KeyRoundIcon,
  },
};

const KPI_META = {
  employees: UsersRoundIcon,
  outlets: Building2Icon,
  attributes: ClipboardCheckIcon,
  internship: ChartNoAxesCombinedIcon,
  sales: ShoppingBasketIcon,
  admins: UserRoundCogIcon,
  access: KeyRoundIcon,
};

const KPI_TONES = {
  sky: {
    card: "border-sky-200 bg-sky-50/80 text-sky-950 dark:border-sky-900 dark:bg-sky-950/35 dark:text-sky-50",
    icon: "border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-900/70 dark:text-sky-300",
  },
  violet: {
    card: "border-violet-200 bg-violet-50/80 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50",
    icon: "border-violet-200 bg-violet-100 text-violet-700 dark:border-violet-800 dark:bg-violet-900/70 dark:text-violet-300",
  },
  emerald: {
    card: "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50",
    icon: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-300",
  },
  amber: {
    card: "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50",
    icon: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/70 dark:text-amber-300",
  },
  rose: {
    card: "border-rose-200 bg-rose-50/80 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50",
    icon: "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/70 dark:text-rose-300",
  },
};

async function safely(load, fallback) {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

function KpiCard({ item }) {
  const Icon = KPI_META[item.key] ?? LayoutDashboardIcon;
  const tone = KPI_TONES[item.tone] ?? KPI_TONES.sky;

  return (
    <Card className={`h-full border ${tone.card}`}>
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium opacity-75">
            {item.label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {item.value}
          </p>
          <p className="mt-1 truncate text-xs opacity-70">{item.caption}</p>
        </div>
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${tone.icon}`}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ title, description }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function DashboardSection({ children, className = "space-y-6" }) {
  return (
    <section className={`border-t pt-4 ${className}`}>
      {children}
    </section>
  );
}

export default async function Page() {
  await connection();

  const user = await getCurrentUser();
  const role = normalizeRole(user?.role);
  const role_meta = ROLE_META[role] ?? ROLE_META.member;
  const RoleIcon = role_meta.icon;
  const today = new Date();
  const current_year = String(today.getFullYear());
  const current_month = `${current_year}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const can_view_kepuasan = canAccessMenu(user, "kepuasan-internal");
  const can_view_cctv = canAccessMenu(
    user,
    "kepatuhan-sop-cctv",
    ["member"],
  );
  const can_view_gofitku = canAccessMenu(
    user,
    "penjualan-gofitku",
    ["member"],
  );
  const can_view_ntbs = canAccessMenu(
    user,
    "nilai-transaksi-basket-size",
    ["member"],
  );
  const [
    overview,
    kepuasan_internal,
    nilai_transaksi_basket_size,
    gofitku_outlet_chart,
    gofitku_product_chart,
  ] = await Promise.all([
    getDashboardOverview(user),
    can_view_kepuasan
      ? safely(
          () => getKepuasanInternalChart({ year: current_year }),
          { data: { chart_data: [], series: [] } },
        )
      : null,
    can_view_ntbs
      ? safely(() => getNilaiTransaksiBasketSize(), {
          rows: [],
          overall_metrics: {},
        })
      : null,
    can_view_gofitku
      ? safely(
          () => getPenjualanGofitkuTopOutletChart(),
          { chart_data: [] },
        )
      : null,
    can_view_gofitku
      ? safely(
          () =>
            getPenjualanGofitkuTopProdukChart({
              account_uuid: user?.uuid,
              role,
            }),
          { chart_data: [] },
        )
      : null,
  ]);
  const current_chart_item = kepuasan_internal?.data?.chart_data?.find(
    (item) => item.month === current_month,
  );
  const pie_data = current_chart_item
    ? (kepuasan_internal.data?.series ?? []).map((item) => ({
        key: item.key,
        label: item.label,
        value: Number(current_chart_item[item.key]) || 0,
      }))
    : [];
  const outlet_chart_data = gofitku_outlet_chart?.chart_data ?? [];
  const product_chart_data = gofitku_product_chart?.chart_data ?? [];
  const outlet_chart_height = Math.max(320, outlet_chart_data.length * 42);
  const user_display_name = user?.name || user?.username || "User";
  const highest_nilai_transaksi_by_category = outlet_category_slug_options.map(
    (category) => {
      const row = (nilai_transaksi_basket_size?.rows ?? [])
        .filter((item) => item.category_key === category.value)
        .reduce((highest, item) => {
          if (
            !highest ||
            Number(item.nt_daily ?? 0) > Number(highest.nt_daily ?? 0)
          ) {
            return item;
          }

          return highest;
        }, null);

      return {
        category_key: category.value,
        category_label: category.label,
        outlet_name: row?.outlet_name ?? "-",
        value: Number(row?.nt_daily ?? 0),
      };
    },
  );
  const highest_basket_size_by_category = outlet_category_slug_options.map(
    (category) => {
      const row = (nilai_transaksi_basket_size?.rows ?? [])
        .filter((item) => item.category_key === category.value)
        .reduce((highest, item) => {
          if (
            !highest ||
            Number(item.bs_current_month ?? 0) >
              Number(highest.bs_current_month ?? 0)
          ) {
            return item;
          }

          return highest;
        }, null);

      return {
        category_key: category.value,
        category_label: category.label,
        outlet_name: row?.outlet_name ?? "-",
        value: Number(row?.bs_current_month ?? 0),
      };
    },
  );
  const formatted_date = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);
  const summary_grid_columns =
    overview.stats.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4";
  const show_operational_section =
    can_view_kepuasan || can_view_cctv || can_view_gofitku || can_view_ntbs;

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary via-primary to-rose-700 px-5 py-6 text-white shadow-lg dark:from-red-900 dark:via-red-950 dark:to-rose-950 sm:px-7 sm:py-8">
        <div className="absolute -top-20 -right-16 size-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <RoleIcon className="size-4" />
              {role_meta.label}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Selamat datang, {user_display_name} 👋
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80 sm:text-base">
              {role_meta.description}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/20 bg-black/10 px-3 py-2 text-sm text-white/90 backdrop-blur-sm">
            <CalendarDaysIcon className="size-4" />
            {formatted_date}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <SectionHeading
          title="Ringkasan"
          description={
            role === "member"
              ? "Kondisi terbaru dari outlet Anda."
              : "Ringkasan terbaru dari data operasional."
          }
        />
        <div className={`grid gap-4 sm:grid-cols-2 ${summary_grid_columns}`}>
          {overview.stats.map((item) => (
            <KpiCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      <section>
        <Card className="h-full gap-0">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                <CircleAlertIcon className="size-5" />
              </div>
              <div>
                <CardTitle>Informasi</CardTitle>
                <CardDescription>Informasi terbaru untuk Anda.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {overview.notices.map((notice, index) => (
              <div
                key={`${notice.title}-${index}`}
                className="flex gap-3 px-4 py-4"
              >
                <div
                  className={
                    notice.tone === "success"
                      ? "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }
                >
                  {notice.tone === "success" ? (
                    <CheckCircle2Icon className="size-4" />
                  ) : (
                    <CircleAlertIcon className="size-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{notice.title}</p>
                  <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
                    {notice.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {show_operational_section ? (
        <DashboardSection>
          <SectionHeading
            title="Statistik"
            description={
              role === "member"
                ? "Grafik terbaru dari outlet Anda dan data pembanding yang tersedia."
                : "Grafik dan angka terbaru sesuai kewenangan menu Anda."
            }
          />

          {can_view_kepuasan || can_view_cctv ? (
            <div
              className={`grid gap-4 ${
                can_view_kepuasan && can_view_cctv
                  ? "md:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              {can_view_kepuasan ? (
                <ChartPieDonutText
                  title="Kepuasan Internal"
                  description={new Intl.DateTimeFormat("id-ID", {
                    month: "long",
                    year: "numeric",
                  }).format(today)}
                  data={pie_data}
                  emptyMessage="Data kepuasan internal belum tersedia."
                  icon={<PieChartIcon className="size-5 text-rose-700" />}
                  action={
                    <Link
                      href="/kepuasan-internal"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className: "h-8 w-full rounded-md",
                      })}
                    >
                      Lihat Detail
                      <ArrowRightIcon data-icon="inline-end" />
                    </Link>
                  }
                />
              ) : null}
              {can_view_cctv ? <KepatuhanSopCctvDashboardCard /> : null}
            </div>
          ) : null}

          {can_view_gofitku ? (
            <Card>
              <div className="grid divide-y xl:grid-cols-2 xl:divide-x xl:divide-y-0">
                <ChartBarLabel
                  renderCard={false}
                  title="Top 5 Outlet"
                  description="Akumulasi penjualan tertinggi per outlet."
                  data={outlet_chart_data}
                  showLegend={false}
                  icon={
                    <BadgeDollarSignIcon className="size-5 text-rose-700" />
                  }
                  chartClassName="w-full"
                  chartStyle={{ minHeight: `${outlet_chart_height}px` }}
                  emptyClassName="min-h-[320px]"
                  emptyMessage="Diagram penjualan outlet belum tersedia."
                />
                <ChartBarLabel
                  renderCard={false}
                  title="Top 5 Produk GoFitKu"
                  description={
                    role === "member"
                      ? "Produk dengan total penjualan tertinggi di outlet Anda."
                      : "Produk dengan total penjualan tertinggi."
                  }
                  data={product_chart_data}
                  showLegend={false}
                  icon={
                    <ShoppingBasketIcon className="size-5 text-rose-700" />
                  }
                  chartClassName="w-full"
                  chartStyle={{ minHeight: "320px" }}
                  emptyClassName="min-h-[320px]"
                  emptyMessage="Diagram penjualan produk belum tersedia."
                />
              </div>
              <CardFooter className="p-2">
                <Link
                  href="/penjualan-gofitku"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "h-8 w-full rounded-md",
                  })}
                >
                  Lihat Detail
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </CardFooter>
            </Card>
          ) : null}

          {can_view_ntbs ? (
            <NilaiTransaksiBasketSizeDashboardCard
              metrics={nilai_transaksi_basket_size.overall_metrics}
              highest_nilai_transaksi_by_category={
                highest_nilai_transaksi_by_category
              }
              highest_basket_size_by_category={highest_basket_size_by_category}
            />
          ) : null}
        </DashboardSection>
      ) : null}
    </div>
  );
}
