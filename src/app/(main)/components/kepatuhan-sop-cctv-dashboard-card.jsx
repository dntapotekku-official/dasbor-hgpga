"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  Building2Icon,
  CctvIcon,
  ChevronDownIcon,
  SearchIcon,
} from "lucide-react";

import { getKepatuhanSopCctvFromDb } from "@/lib/kepatuhanSopCctvClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

const default_outlet = { value: "semua-outlet", label: "Semua Outlet" };
const format_number = (value) => Number(value || 0).toLocaleString("id-ID");

export default function KepatuhanSopCctvDashboardCard({ showDetailLink = true }) {
  const current_day_range = useMemo(() => {
    const today = new Date();
    const today_param = today.toISOString().slice(0, 10);

    return {
      tanggal_awal: today_param,
      tanggal_akhir: today_param,
      label: new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(today),
    };
  }, []);
  const [dashboard_data, setDashboardData] = useState({
    outlet_options: [],
    summary: {
      total: 0,
      total_point: 0,
    },
  });
  const [selected_outlet, setSelectedOutlet] = useState(default_outlet.value);
  const [is_outlet_menu_open, setIsOutletMenuOpen] = useState(false);
  const [outlet_search, setOutletSearch] = useState("");
  const [empty_message, setEmptyMessage] = useState("Memuat data kepatuhan SOP CCTV...");

  const outlet_options = useMemo(() => {
    const current_options = dashboard_data.outlet_options
      .filter((item) => item?.value && item?.label)
      .map((item) => ({
        value: item.value,
        label: item.label,
      }));

    return current_options.length
      ? [default_outlet, ...current_options]
      : [default_outlet];
  }, [dashboard_data.outlet_options]);
  const active_outlet = outlet_options.some((item) => item.value === selected_outlet)
    ? selected_outlet
    : default_outlet.value;
  const selected_outlet_label =
    outlet_options.find((item) => item.value === active_outlet)?.label ??
    default_outlet.label;
  const filtered_outlet_options = outlet_options.filter((item) =>
    item.label.toLowerCase().includes(outlet_search.trim().toLowerCase()),
  );
  const has_data =
    Number(dashboard_data.summary?.total) !== 0 ||
    Number(dashboard_data.summary?.total_point) !== 0;

  useEffect(() => {
    let is_active = true;

    const run = async () => {
      try {
        const response = await fetch("/api/outlet", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json();

        if (!is_active || !response.ok || !payload.success) {
          return;
        }

        const outlet_options_from_payload = Array.isArray(payload.data?.data_outlet)
          ? payload.data.data_outlet.map((item) => ({
              value: item.uuid,
              label: item.name,
            }))
          : [];

        setDashboardData((current_data) => ({
          ...current_data,
          outlet_options: outlet_options_from_payload.filter(
            (item) => item?.value && item?.label,
          ),
        }));
      } catch {
        // Dropdown outlet boleh kosong kalau API outlet gagal, data utama tetap dicoba.
      }
    };

    void run();

    return () => {
      is_active = false;
    };
  }, []);

  useEffect(() => {
    let is_active = true;

    const run = async () => {
      try {
        setEmptyMessage("Memuat data kepatuhan SOP CCTV...");
        const response = await getKepatuhanSopCctvFromDb({
          tanggal_awal: current_day_range.tanggal_awal,
          tanggal_akhir: current_day_range.tanggal_akhir,
          uuid_outlet:
            active_outlet === default_outlet.value ? undefined : active_outlet,
        });

        if (!is_active) {
          return;
        }

        if (!response.success) {
          setDashboardData((current_data) => ({
            ...current_data,
            summary: {
              total: 0,
              total_point: 0,
            },
          }));
          setEmptyMessage(response.message || "Data kepatuhan SOP CCTV belum tersedia.");
          return;
        }

        const rows = Array.isArray(response.data?.rows) ? response.data.rows : [];
        const outlet_options_from_payload = Array.isArray(response.data?.outlet_options)
          ? response.data.outlet_options
          : rows.map((item) => ({
              value: item.uuid_outlet,
              label: item.nama_outlet,
            }));

        setDashboardData((current_data) => ({
          ...current_data,
          outlet_options: current_data.outlet_options.length
            ? current_data.outlet_options
            : outlet_options_from_payload,
          summary: {
            total: Number(response.data?.summary?.total) || 0,
            total_point: Number(response.data?.summary?.total_point) || 0,
          },
        }));
        setEmptyMessage("Data kepatuhan SOP CCTV belum tersedia.");
      } catch (error) {
        if (!is_active) {
          return;
        }

        setEmptyMessage(
          error instanceof Error ? error.message : "Terjadi kesalahan saat mengambil data.",
        );
      }
    };

    void run();

    return () => {
      is_active = false;
    };
  }, [active_outlet, current_day_range.tanggal_akhir, current_day_range.tanggal_awal]);

  return (
    <Card className="flex flex-col self-start gap-0">
      <CardHeader>
        <div className="grid auto-rows-min gap-1">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50">
              <CctvIcon className="size-5 text-rose-700" />
            </div>
            <div className="grid auto-rows-min gap-1">
              <CardTitle>Kepatuhan SOP CCTV</CardTitle>
              <CardDescription>{current_day_range.label}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full sm:w-auto">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Outlet</span>
            <DropdownMenu
              open={is_outlet_menu_open}
              onOpenChange={(open) => {
                setIsOutletMenuOpen(open);

                if (!open) {
                  setOutletSearch("");
                }
              }}
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-between bg-card sm:w-[240px]"
                  />
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Building2Icon className="size-4 shrink-0" />
                  <span className="truncate">{selected_outlet_label}</span>
                </span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[260px]">
                <div className="relative p-1">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={outlet_search}
                    onChange={(event) => setOutletSearch(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Cari outlet..."
                    className="h-9 pl-8"
                  />
                </div>
                <DropdownMenuRadioGroup
                  value={active_outlet}
                  onValueChange={(outlet) => {
                    setSelectedOutlet(outlet);
                    setIsOutletMenuOpen(false);
                    setOutletSearch("");
                  }}
                >
                  {filtered_outlet_options.map((outlet) => (
                    <DropdownMenuRadioItem
                      key={outlet.value}
                      value={outlet.value}
                      className="py-2 text-sm"
                    >
                      {outlet.label}
                    </DropdownMenuRadioItem>
                  ))}
                  {!filtered_outlet_options.length ? (
                    <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                      Outlet tidak ditemukan.
                    </div>
                  ) : null}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {has_data ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-h-[120px] flex-col justify-center rounded-lg border border-blue-200 bg-blue-50 p-6">
              <div className="text-sm text-blue-700">Total</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-blue-900">
                {format_number(dashboard_data.summary?.total)}
              </div>
            </div>
            <div className="flex min-h-[120px] flex-col justify-center rounded-lg border border-amber-200 bg-amber-50 p-6">
              <div className="text-sm text-amber-700">Total Poin</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-amber-900">
                {format_number(dashboard_data.summary?.total_point)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 text-center text-sm text-muted-foreground">
            {empty_message}
          </div>
        )}
      </CardContent>
      {showDetailLink ? <CardFooter className="p-2">
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="h-8 w-full rounded-md"
          render={<Link href="/kepatuhan-sop-cctv" />}
        >
          Lihat Detail
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter> : null}
    </Card>
  );
}
