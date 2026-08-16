import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { connection } from "next/server";

import PageHeading from "@/components/page-heading";
import { ChartPieDonutText } from "@/components/charts/chart-pie-donut-text";
import { buttonVariants } from "@/components/ui/button";
import { getKepuasanInternalChart } from "@/services/kepuasanInternalService";
import KepatuhanSopCctvDashboardCard from "./components/kepatuhan-sop-cctv-dashboard-card";

export default async function Page() {
  await connection();

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
          action={
            <Link
              href="/kepuasan-internal"
              className={buttonVariants({
                variant: "ghost",
                size: "sm",
                className: "h-10 w-full rounded-none",
              })}
            >
              Lihat Detail
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          }
        />
        <KepatuhanSopCctvDashboardCard />
      </div>
    </>
  );
}
