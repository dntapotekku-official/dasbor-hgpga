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

const format_number = (value) => Number(value || 0).toLocaleString("id-ID");

function render_value_label({ value, x, y, width, height }) {
  if (value == null) {
    return null;
  }

  const numeric_value = Number(value) || 0;
  const label_x = numeric_value < 0 ? x - 8 : x + width + 8;
  const text_anchor = numeric_value < 0 ? "end" : "start";

  return (
    <text
      x={label_x}
      y={y + height / 2}
      dy={4}
      textAnchor={text_anchor}
      className="fill-foreground text-xs"
    >
      {format_number(numeric_value)}
    </text>
  );
}

export function ChartBarLabel({
  title = "Distribusi Respon",
  description = "Bulan berjalan",
  filter,
  showLegend = true,
  chartClassName = "min-h-[250px] w-full",
  chartStyle,
  emptyClassName = "min-h-[250px]",
  data = [],
  emptyMessage = "Data kepuasan internal belum tersedia.",
  action,
  icon,
  renderCard = true,
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
  const has_data = chart_data.some((item) => item.value !== 0);

  const content = (
    <>
      <CardHeader>
        <div className="grid auto-rows-min gap-1">
          <div className="flex items-start gap-3">
            {icon ? (
              <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50">
                {icon}
              </div>
            ) : null}
            <div className="grid auto-rows-min gap-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {filter ? <div className="w-full sm:w-auto">{filter}</div> : null}
        {has_data ? (
          <div
            className={cn(
              showLegend && has_series ? "space-y-3 rounded-lg border p-4" : null,
            )}
          >
            {showLegend && has_series ? (
              <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
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
            <ChartContainer
              config={chartConfig}
              className={chartClassName}
              style={chartStyle}
            >
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
                  <LabelList dataKey="value" content={render_value_label} />
                  {chart_data.map((item) => (
                    <Cell key={item.key} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
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
      {action ? (
        <CardFooter className="p-2">{action}</CardFooter>
      ) : null}
    </>
  );

  if (!renderCard) {
    return <div className="flex h-full min-w-0 flex-col">{content}</div>;
  }

  return (
    <Card className="flex h-full flex-col gap-0">
      {content}
    </Card>
  );
}
