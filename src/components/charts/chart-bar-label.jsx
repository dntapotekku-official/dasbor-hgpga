"use client";

import * as React from "react";
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const chartConfig = {
  value: {
    label: "Respon",
  },
  puas: {
    label: "Puas",
    color: "#16a34a",
  },
  tidak_puas: {
    label: "Tidak Puas",
    color: "#f97316",
  },
};

export function ChartBarLabel({
  title = "Distribusi Respon",
  description = "Bulan berjalan",
  filter,
  showLegend = true,
  chartClassName = "min-h-[250px] w-full",
  emptyClassName = "min-h-[250px]",
  data = [],
  emptyMessage = "Data kepuasan internal belum tersedia.",
  action,
}) {
  const chart_data = React.useMemo(() => {
    return data.map((item, index) => {
      const normalized_label = item.label.toLowerCase();
      const fallback_fill =
        normalized_label.includes("puas") && normalized_label.includes("tidak")
          ? "#f97316"
          : normalized_label.includes("puas")
            ? "#16a34a"
            : `var(--chart-${index + 1})`;

      return {
        ...item,
        fill: item.fill ?? fallback_fill,
      };
    });
  }, [data]);

  const has_series = chart_data.length > 0;
  const has_data = chart_data.some((item) => item.value > 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="grid auto-rows-min gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          {showLegend && has_series ? (
            <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
              {chart_data.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span
                    className="size-4 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {filter ? <div className="w-full sm:w-auto">{filter}</div> : null}
      </CardHeader>
      <CardContent className="flex-1">
        {has_data ? (
          <ChartContainer config={chartConfig} className={chartClassName}>
            <BarChart
              accessibilityLayer
              data={chart_data}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                width={86}
              />
              <XAxis dataKey="value" type="number" hide />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Bar dataKey="value" radius={5}>
                <LabelList
                  dataKey="value"
                  position="right"
                  offset={12}
                  className="fill-foreground"
                  fontSize={12}
                  formatter={(value) => Number(value || 0).toLocaleString("id-ID")}
                />
                {chart_data.map((item) => (
                  <Cell key={item.key} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground",
              emptyClassName,
            )}
          >
            {emptyMessage}
          </div>
        )}
      </CardContent>
      {action ? <CardFooter className="p-0">{action}</CardFooter> : null}
    </Card>
  );
}
