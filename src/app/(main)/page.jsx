import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeDollarSignIcon,
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
import KepatuhanSopCctvDashboardCard from "./components/kepatuhan-sop-cctv-dashboard-card";

export default async function Page() {
  await connection();

  const user = await getCurrentUser();
  const today = new Date();
  const current_year = String(today.getFullYear());
  const current_month = `${current_year}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const kepuasan_internal = await getKepuasanInternalChart({
    year: current_year,
  });
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
  const outlet_chart = await getPenjualanGofitkuTopOutletChart({
    username: user?.username,
    role: user?.role,
  });
  const product_chart = await getPenjualanGofitkuTopProdukChart({
    username: user?.username,
    role: user?.role,
  });
  const outlet_chart_data = outlet_chart.chart_data ?? [];
  const product_chart_data = product_chart.chart_data ?? [];
  const outlet_chart_height = Math.max(320, outlet_chart_data.length * 42);

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Dasbor"
          description="Ringkasan utama aktivitas dan data operasional HGPGA."
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
    </>
  );
}
