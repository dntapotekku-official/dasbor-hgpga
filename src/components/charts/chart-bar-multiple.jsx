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

const format_number = (value) => Number(value || 0).toLocaleString("id-ID");

function render_bar_label({
  value,
  x,
  y,
  width,
  height,
  index,
  data_key,
  chart_data,
  label_formatter,
  label_class_name,
}) {
  if (value == null) {
    return null;
  }

  const row_data = chart_data[index] ?? {};
  const numeric_value = Number(value) || 0;
  const bar_start_y = Number(y) || 0;
  const bar_end_y = bar_start_y + (Number(height) || 0);
  const label_x = (Number(x) || 0) + (Number(width) || 0) / 2;
  const label_y =
    numeric_value < 0
      ? Math.max(bar_start_y, bar_end_y) + 8
      : Math.min(bar_start_y, bar_end_y) - 8;
  const formatted_value = label_formatter
    ? label_formatter({
        value: numeric_value,
        data_key,
        payload: row_data,
      })
    : format_number(numeric_value);

  return (
    <text
      x={label_x}
      y={label_y}
      textAnchor="middle"
      dominantBaseline={numeric_value < 0 ? "hanging" : "auto"}
      className={`fill-foreground ${label_class_name}`}
    >
      {formatted_value}
    </text>
  );
}

function get_series_color(item, index) {
  if (item.color) {
    return item.color;
  }

  const normalized_label = item.label.toLowerCase();
  const is_negative =
    normalized_label.includes("tidak") &&
    (normalized_label.includes("puas") ||
      normalized_label.includes("patuh"));
  const is_positive =
    normalized_label.includes("puas") ||
    normalized_label.includes("patuh") ||
    normalized_label.includes("total");

  return is_negative
    ? "#f97316"
    : is_positive
      ? index === 0
        ? "#2563eb"
        : "#16a34a"
      : `var(--chart-${index + 1})`;
}

function build_chart_config(series) {
  return Object.fromEntries(
    series.map((item, index) => [
      item.key,
      {
        label: item.label,
        color: get_series_color(item, index),
      },
    ]),
  );
}

function render_legend(series) {
  return (
    <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
      {series.map((item, index) => (
        <div key={item.key} className="flex items-center gap-2">
          <span
            className="size-4 rounded-full"
            style={{ backgroundColor: get_series_color(item, index) }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function render_chart({
  chart_data,
  series,
  chart_class_name,
  x_data_key,
  x_tick_formatter,
  x_axis_interval,
  tooltip_content,
  label_formatter,
  label_class_name,
}) {
  return (
    <ChartContainer
      config={build_chart_config(series)}
      className={chart_class_name}
    >
      <BarChart accessibilityLayer data={chart_data} margin={{ top: 20, left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={x_data_key}
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          minTickGap={24}
          interval={x_axis_interval}
          tickFormatter={x_tick_formatter}
        />
        <ChartTooltip
          cursor={false}
          content={tooltip_content ?? <ChartTooltipContent indicator="dashed" />}
        />
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            fill={`var(--color-${item.key})`}
            radius={8}
          >
            <LabelList
              dataKey={item.key}
              content={(props) =>
                render_bar_label({
                  ...props,
                  data_key: item.key,
                  chart_data,
                  label_formatter,
                  label_class_name,
                })
              }
            />
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  );
}

export default function ChartBarMultiple({
  title = "Tren Data",
  filter,
  action,
  chartData = [],
  series = [],
  emptyMessage = "Belum ada data.",
  xDataKey = "month",
  xTickFormatter = (value) => value,
  xAxisInterval,
  tooltipContent,
  showLegend = true,
  chartClassName = "aspect-auto h-[180px] w-full",
  renderCard = true,
  wrapperClassName = "rounded-lg border px-4 py-3",
  labelFormatter,
  labelClassName = "text-xs",
}) {
  const has_data = chartData.length > 0 && series.length > 0;

  if (!renderCard) {
    return has_data ? (
      <div className={wrapperClassName}>
        <div className="space-y-3">
          {showLegend ? render_legend(series) : null}
          {render_chart({
            chart_data: chartData,
            series,
            chart_class_name: chartClassName,
            x_data_key: xDataKey,
            x_tick_formatter: xTickFormatter,
            x_axis_interval: xAxisInterval,
            tooltip_content: tooltipContent,
            label_formatter: labelFormatter,
            label_class_name: labelClassName,
          })}
        </div>
      </div>
    ) : (
      <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <Card className="gap-0 border-t-2 border-t-primary/70">
      <CardHeader className="border-b">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {filter || action ? (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {filter ? <div className="w-full sm:w-auto">{filter}</div> : null}
            {action ? <div className="w-full sm:w-auto">{action}</div> : null}
          </div>
        ) : null}
        {has_data ? (
          <div className={wrapperClassName}>
            <div className="space-y-3">
              {showLegend ? render_legend(series) : null}
              {render_chart({
                chart_data: chartData,
                series,
                chart_class_name: chartClassName,
                x_data_key: xDataKey,
                x_tick_formatter: xTickFormatter,
                x_axis_interval: xAxisInterval,
                tooltip_content: tooltipContent,
                label_formatter: labelFormatter,
                label_class_name: labelClassName,
              })}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
