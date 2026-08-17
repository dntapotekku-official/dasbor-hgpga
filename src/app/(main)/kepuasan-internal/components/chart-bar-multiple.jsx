"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export default function ChartBarMultiple({
  title = "Kepuasan Internal",
  filter,
  action,
  chartData = [],
  series = [],
  emptyMessage = "Belum ada data kepuasan internal.",
}) {
  const chart_config = Object.fromEntries(
    series.map((item, index) => {
      const normalized_label = item.label.toLowerCase();
      const is_negative =
        normalized_label.includes("tidak") &&
        (normalized_label.includes("puas") ||
          normalized_label.includes("patuh"));
      const is_positive =
        normalized_label.includes("puas") ||
        normalized_label.includes("patuh");

      return [
        item.key,
        {
          label: item.label,
          color: is_negative
            ? "#f97316"
            : is_positive
              ? "#16a34a"
              : `var(--chart-${index + 1})`,
        },
      ];
    }),
  );
  if (!chartData.length || !series.length) {
    return (
      <Card className="border-t-4 border-t-primary">
        <CardHeader className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <CardTitle className="text-xl">{title}</CardTitle>
          </div>
          {filter || action ? (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end sm:justify-end">
              {filter ? <div className="w-full sm:w-auto">{filter}</div> : null}
              {action ? <div className="w-full sm:w-auto">{action}</div> : null}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="pt-5">
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-t-4 border-t-primary">
      <CardHeader className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            {series.map((item) => {
              const normalized_label = item.label.toLowerCase();
              const is_negative =
                normalized_label.includes("tidak") &&
                (normalized_label.includes("puas") ||
                  normalized_label.includes("patuh"));
              const is_positive =
                normalized_label.includes("puas") ||
                normalized_label.includes("patuh");
              const legend_tone = is_negative
                ? "bg-orange-500"
                : is_positive
                  ? "bg-emerald-600"
                  : "bg-slate-500";

              return (
                <div key={item.key} className="flex items-center gap-2">
                  <span className={`size-4 rounded-full ${legend_tone}`} />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        {filter || action ? (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end sm:justify-end">
            {filter ? <div className="w-full sm:w-auto">{filter}</div> : null}
            {action ? <div className="w-full sm:w-auto">{action}</div> : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="pt-5">
        <ChartContainer config={chart_config} className="aspect-auto h-[180px] w-full">
          <BarChart accessibilityLayer data={chartData} margin={{ top: 20 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const [year, month] = value.split("-");
                const date = new Date(Number(year), Number(month) - 1, 1);

                if (Number.isNaN(date.getTime())) {
                  return value;
                }

                return new Intl.DateTimeFormat("id-ID", {
                  month: "short",
                }).format(date);
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                fill={`var(--color-${item.key})`}
                radius={8}
              >
                <LabelList
                  position="top"
                  offset={12}
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
