"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";

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

const chart_config = {
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

export function ChartPieDonutText({
  title = "Kepuasan Internal",
  description = "Bulan terakhir",
  data = [],
  emptyMessage = "Data kepuasan internal belum tersedia.",
  action,
  icon,
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
  const total_responses = chart_data.reduce(
    (total, item) => total + Number(item.value || 0),
    0,
  );
  const has_data = chart_data.some((item) => item.value > 0);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50">
              {icon}
            </div>
          ) : null}
          <div className="grid auto-rows-min gap-1 text-left">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {has_data ? (
          <>
            <ChartContainer
              config={chart_config}
              className="mx-auto aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel nameKey="label" />}
                />
                <Pie
                  data={chart_data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={60}
                  strokeWidth={5}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-3xl font-bold"
                            >
                              {total_responses.toLocaleString("id-ID")}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground"
                            >
                              Respon
                            </tspan>
                          </text>
                        );
                      }

                      return null;
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-4 pb-5 text-sm text-muted-foreground">
              {chart_data.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span>{item.label}</span>
                  <span className="font-medium text-foreground">
                    {Number(item.value || 0).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-[250px] items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </CardContent>
      {action ? (
        <CardFooter className="p-2">{action}</CardFooter>
      ) : null}
    </Card>
  );
}
