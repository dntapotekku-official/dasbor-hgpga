import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeDollarSignIcon,
  HandIcon,
  PieChartIcon,
  ShoppingBasketIcon,
} from "lucide-react";
import { connection } from "next/server";

import getCurrentUser from "@/lib/auth";
import PageHeading from "@/components/page-heading";
import { ChartBarLabel } from "@/components/charts/chart-bar-label";
import { ChartPieDonutText } from "@/components/charts/chart-pie-donut-text";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { getKepuasanInternalChart } from "@/services/kepuasanInternalService";
import {
  getPenjualanGofitkuTopOutletChart,
  getPenjualanGofitkuTopProdukChart,
} from "@/services/penjualanGofitkuService";
import { getNilaiTransaksiBasketSize } from "@/services/nilaiTransaksiBasketSizeService";
import { outlet_category_slug_options } from "@/lib/outletCategories";
import KepatuhanSopCctvDashboardCard from "./components/kepatuhan-sop-cctv-dashboard-card";
import NilaiTransaksiBasketSizeDashboardCard from "./components/nilai-transaksi-basket-size-dashboard-card";

export default async function Page() {
  await connection();

  const user = await getCurrentUser();
  const today = new Date();
  const current_year = String(today.getFullYear());
  const current_month = `${current_year}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [
    kepuasan_internal,
    nilai_transaksi_basket_size,
    outlet_chart,
    product_chart,
  ] = await Promise.all([
    getKepuasanInternalChart({
      year: current_year,
    }),
    getNilaiTransaksiBasketSize({}),
    getPenjualanGofitkuTopOutletChart({
      username: user?.username,
      role: user?.role,
    }),
    getPenjualanGofitkuTopProdukChart({
      username: user?.username,
      role: user?.role,
    }),
  ]);
  const current_chart_item = kepuasan_internal.data?.chart_data?.find(
    (item) => item.month === current_month,
  );
  const pie_data = current_chart_item
    ? (kepuasan_internal.data?.series ?? []).map((item) => ({
        key: item.key,
        label: item.label,
        value: Number(current_chart_item[item.key]) || 0,
      }))
    : [];
  const outlet_chart_data = outlet_chart.chart_data ?? [];
  const product_chart_data = product_chart.chart_data ?? [];
  const outlet_chart_height = Math.max(320, outlet_chart_data.length * 42);
  const user_display_name = user?.name || user?.username || "User";
  const highest_nilai_transaksi_by_category = outlet_category_slug_options
    .map((category) => {
      const row = (nilai_transaksi_basket_size.rows ?? [])
        .filter((item) => item.category_key === category.value)
        .reduce((highest, item) => {
          if (!highest || Number(item.nt_daily ?? 0) > Number(highest.nt_daily ?? 0)) {
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
    });

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title={
            <span className="inline-flex items-center gap-2">
              <HandIcon className="size-5 text-primary" />
              Hai, {user_display_name}
            </span>
          }
          description="Ringkasan utama aktivitas dan data operasional dalam Performance Report."
        />
      </div>

      <div className="grid gap-4 px-4 md:grid-cols-2 lg:px-6">
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
        <KepatuhanSopCctvDashboardCard />
      </div>
      <div className="px-4 lg:px-6">
        <Card>
          <div className="grid divide-y xl:grid-cols-2 xl:divide-x xl:divide-y-0">
            <ChartBarLabel
              renderCard={false}
              title="Top 5 Outlet GoFitKu"
              description="Akumulasi penjualan GoFitKu tertinggi berdasarkan outlet."
              data={outlet_chart_data}
              showLegend={false}
              icon={<BadgeDollarSignIcon className="size-5 text-rose-700" />}
              chartClassName="w-full"
              chartStyle={{ minHeight: `${outlet_chart_height}px` }}
              emptyClassName="min-h-[320px]"
              emptyMessage="Diagram penjualan outlet belum tersedia."
            />
            <ChartBarLabel
              renderCard={false}
              title="Top 5 Produk GoFitKu"
              description="Produk dengan total penjualan tertinggi."
              data={product_chart_data}
              showLegend={false}
              icon={<ShoppingBasketIcon className="size-5 text-rose-700" />}
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
      </div>
      <div className="px-4 lg:px-6">
        <NilaiTransaksiBasketSizeDashboardCard
          metrics={nilai_transaksi_basket_size.overall_metrics}
          highest_nilai_transaksi_by_category={highest_nilai_transaksi_by_category}
        />
      </div>
    </>
  );
}
