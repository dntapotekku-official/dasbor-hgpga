import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BadgeDollarSignIcon,
  MinusIcon,
  ShoppingBasketIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import CurrencyValue from "@/components/currency-value";
import {
  Card,
  CardDescription,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDecimal,
} from "@/lib/nilaiTransaksiBasketSizeTable";

function gap_value_class_name(value) {
  if (value > 0) {
    return "text-emerald-700 dark:text-emerald-400";
  }

  if (value < 0) {
    return "text-rose-700 dark:text-rose-400";
  }

  return "text-foreground";
}

function GapValue({ value }) {
  const DirectionIcon = value > 0
    ? ArrowUpIcon
    : value < 0
      ? ArrowDownIcon
      : MinusIcon;

  return (
    <span
      className={`inline-flex items-center gap-1 ${gap_value_class_name(value)}`}
    >
      <DirectionIcon className="size-6" />
      {formatDecimal(value)}%
    </span>
  );
}

function SummaryValue({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function MetricHeading({ icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div className="grid min-w-0 auto-rows-min gap-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
    </div>
  );
}

export default function NilaiTransaksiBasketSizeDashboardCard({
  metrics,
  highest_nilai_transaksi_by_category = [],
}) {
  return (
    <Card className="gap-0 overflow-hidden">
      <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
        <section className="bg-orange-50/60 p-(--card-spacing) dark:bg-orange-950/15">
          <MetricHeading
            title="Nilai Transaksi"
            description="Semua kategori"
            icon={
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/50">
                <BadgeDollarSignIcon className="size-5 text-orange-700 dark:text-orange-300" />
              </div>
            }
          />

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Gap Growth</p>
              <p className="text-2xl font-semibold tracking-tight">
                <GapValue value={metrics.nt_gap_growth} />
              </p>
            </div>
            <div className="min-w-0 space-y-1 border-l pl-4">
              <p className="text-xs font-medium text-muted-foreground">Gap Target</p>
              <p className="text-2xl font-semibold tracking-tight">
                <GapValue value={metrics.nt_gap_target} />
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 xl:grid-cols-3">
            <SummaryValue
              label="Target"
              value={<CurrencyValue value={metrics.nt_target} />}
            />
            <SummaryValue
              label="TPP (Bulan berjalan)"
              value={<CurrencyValue value={metrics.nt_current_month_total_revenue} />}
            />
            <SummaryValue
              label="Dilayani (Bulan berjalan)"
              value={formatDecimal(metrics.nt_current_month_served, 0)}
            />
            <SummaryValue
              label="Harian"
              value={<CurrencyValue value={metrics.nt_daily} />}
            />
            <SummaryValue
              label="Bulan berjalan"
              value={<CurrencyValue value={metrics.nt_current_month} />}
            />
            <SummaryValue
              label="Bulan lalu"
              value={<CurrencyValue value={metrics.nt_last_month} />}
            />
            <SummaryValue
              label="Growth"
              value={`${formatDecimal(metrics.nt_growth)}%`}
            />
            <SummaryValue
              label="Dari Target"
              value={`${formatDecimal(metrics.nt_target_compare)}%`}
            />
          </div>

          {highest_nilai_transaksi_by_category.length ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Nilai Transaksi Harian Tertinggi per Kategori
              </p>
              <div className="mt-2 space-y-2">
                {highest_nilai_transaksi_by_category.map((item) => (
                  <div
                    key={item.category_key}
                    className="grid gap-1 sm:grid-cols-[120px_1fr_auto] sm:items-center"
                  >
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {item.category_label}
                    </span>
                    <span className="truncate text-sm font-medium text-emerald-900 dark:text-emerald-100">
                      {item.outlet_name}
                    </span>
                    <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                      <CurrencyValue value={item.value} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="bg-blue-50/60 p-(--card-spacing) dark:bg-blue-950/15">
          <MetricHeading
            title="Basket Size"
            description="Semua kategori"
            icon={
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50">
                <ShoppingBasketIcon className="size-5 text-blue-700 dark:text-blue-300" />
              </div>
            }
          />

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Gap Growth</p>
              <p className="text-2xl font-semibold tracking-tight">
                <GapValue value={metrics.bs_gap_growth} />
              </p>
            </div>
            <div className="min-w-0 space-y-1 border-l pl-4">
              <p className="text-xs font-medium text-muted-foreground">Gap Target</p>
              <p className="text-2xl font-semibold tracking-tight">
                <GapValue value={metrics.bs_gap_target} />
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 xl:grid-cols-3">
            <SummaryValue
              label="Target"
              value={formatDecimal(metrics.bs_target)}
            />
            <SummaryValue
              label="Bulan lalu"
              value={formatDecimal(metrics.bs_last_month)}
            />
            <SummaryValue
              label="Bulan berjalan"
              value={formatDecimal(metrics.bs_current_month)}
            />
            <SummaryValue
              label="Growth"
              value={`${formatDecimal(metrics.bs_growth)}%`}
            />
            <SummaryValue
              label="Dari Target"
              value={`${formatDecimal(metrics.bs_target_compare)}%`}
            />
          </div>
        </section>
      </div>

      <CardFooter className="border-t p-2">
        <Link
          href="/nilai-transaksi-basket-size"
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
  );
}
