"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import FilterField from "@/components/filter-field";
import OptionDropdown from "@/components/option-dropdown";
import { buildDailyPlacementMonth } from "@/lib/placementMapping";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SearchInput from "@/components/search-input";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function PlacementMappingTab() {
  const current_year = Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "Asia/Makassar" }).format(new Date()));
  const [year, setYear] = useState(String(current_year));
  const [outlet, setOutlet] = useState("");
  const [selected_month, setSelectedMonth] = useState("all");
  const [search, setSearch] = useState("");
  const [account_type, setAccountType] = useState("all");
  const [data, setData] = useState(null);
  const [is_loading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const field_id = useId();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/penempatan-mapping?year=${encodeURIComponent(year)}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || "Gagal mengambil mapping penempatan.");
        if (!controller.signal.aborted) {
          setData(payload.data);
          setOutlet((current) => current === "all" || payload.data.outlets.some((item) => item.value === current)
            ? current
            : payload.data.outlets[0]?.value ?? "");
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause.message || "Gagal mengambil mapping penempatan.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [year, refresh]);

  const month_tables = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id-ID");
    const people = (data?.people ?? []).filter((person) =>
      (!term || `${person.name} ${person.nik}`.toLocaleLowerCase("id-ID").includes(term)) &&
      (account_type === "all" || person.is_slip_gaji_account === (account_type === "slip")),
    );
    return MONTHS.flatMap((name, index) => selected_month !== "all" && String(index) !== selected_month
      ? []
      : [{ name, index, ...buildDailyPlacementMonth(people, year, index, outlet) }]);
  }, [data, search, account_type, selected_month, year, outlet]);
  const has_placements = month_tables.some((month) => month.groups.length > 0);
  const year_options = Array.from({ length: 31 }, (_, index) => ({ value: String(current_year - 20 + index), label: String(current_year - 20 + index) })).reverse();

  return (
    <Card className="h-[80svh] min-h-[40rem] gap-0 border-t-2 border-t-primary/70 sm:min-h-[32rem]">
      <CardHeader className="shrink-0 border-b">
        <CardTitle>Mapping Penempatan</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-5">
        <div className="flex shrink-0 flex-wrap items-end gap-3">
          <FilterField label="Pencarian" htmlFor={`${field_id}-search`} className="w-full sm:w-[280px]">
            <SearchInput id={`${field_id}-search`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama atau NIK…" onClear={() => setSearch("")} />
          </FilterField>
          <FilterField label="Jenis InsanKU" htmlFor={`${field_id}-type`} className="w-full sm:w-[180px]">
            <OptionDropdown id={`${field_id}-type`} value={account_type} options={[{ value: "all", label: "Semua InsanKU" }, { value: "slip", label: "Slip Gaji" }, { value: "non-slip", label: "Non Slip Gaji" }]} onValueChange={setAccountType} ariaLabel="Filter jenis InsanKU" />
          </FilterField>
          <FilterField label="Outlet" htmlFor={`${field_id}-outlet`} className="w-full sm:w-[320px]">
            <OptionDropdown id={`${field_id}-outlet`} value={outlet} options={[{ value: "all", label: "Semua Outlet" }, ...(data?.outlets ?? [])]} onValueChange={setOutlet} ariaLabel="Filter outlet mapping penempatan" searchable disabled={is_loading} />
          </FilterField>
          <FilterField label="Bulan" htmlFor={`${field_id}-month`} className="w-full sm:w-[160px]">
            <OptionDropdown id={`${field_id}-month`} value={selected_month} options={[{ value: "all", label: "Semua Bulan" }, ...MONTHS.map((label, index) => ({ value: String(index), label }))]} onValueChange={setSelectedMonth} ariaLabel="Bulan mapping penempatan" />
          </FilterField>
          <FilterField label="Tahun" htmlFor={`${field_id}-year`} className="w-full sm:w-[110px]">
            <OptionDropdown id={`${field_id}-year`} value={year} options={year_options} onValueChange={setYear} ariaLabel="Tahun mapping penempatan" />
          </FilterField>
          <div className="ml-auto flex w-full justify-end sm:w-auto">
            <Button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={is_loading} aria-busy={is_loading}>
              {is_loading ? <><LoaderCircleIcon className="size-4 animate-spin" />Menyinkronkan...</> : "Sinkron"}
            </Button>
          </div>
        </div>

        {error ? (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error} Gunakan tombol Sinkron untuk mencoba kembali.</div>
        ) : is_loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><LoaderCircleIcon className="size-5 animate-spin" />Memuat periode penempatan…</div>
        ) : !has_placements ? (
          <div className="rounded-xl border px-4 py-14 text-center text-sm text-muted-foreground">Tidak ada data yang cocok dengan filter.</div>
        ) : (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain rounded-xl border p-3" role="region" aria-label="Tabel mapping penempatan bulanan" tabIndex={0}>
            {month_tables.map((month) => (
              <section key={month.index} aria-labelledby={`${field_id}-month-${month.index}`} className="overflow-hidden rounded-xl border">
                <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                  <h3 id={`${field_id}-month-${month.index}`} className="font-semibold">{month.name} {year}</h3>
                  <span className="text-xs text-muted-foreground">{month.person_count} InsanKU</span>
                </div>
                {!month.groups.length ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada penempatan tercatat pada bulan ini untuk Outlet yang dipilih.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-xs" style={{ minWidth: 400 + month.total_days * 34 }}>
                      <caption className="sr-only">Mapping harian per Outlet, {month.name} {year}</caption>
                      <thead>
                        <tr>
                          <th scope="col" className="sticky left-0 z-20 w-[200px] border-b border-r bg-muted px-3 py-3 text-left">Outlet</th>
                          <th scope="col" className="w-[200px] border-b border-r bg-muted px-3 py-3 text-left">InsanKU</th>
                          {Array.from({ length: month.total_days }, (_, index) => <th key={index} scope="col" className="w-[34px] border-b border-r bg-muted py-3 text-center font-medium last:border-r-0">{index + 1}</th>)}
                        </tr>
                      </thead>
                      {month.groups.map((group) => (
                        <tbody key={group.uuid}>
                          {group.rows.map((row, row_index) => (
                            <tr key={row.placement_uuid}>
                              {row_index === 0 && <th scope="rowgroup" rowSpan={group.rows.length} className="sticky left-0 z-10 border-b border-r bg-card px-3 py-3 text-left align-top font-medium">{group.name}</th>}
                              <th scope="row" className="border-b border-r bg-card px-3 py-2 text-left font-normal">
                                {row.person_name}
                              </th>
                              {row.days.map((active, day_index) => (
                                <td key={day_index} className={`h-9 border-b border-r p-0 text-center last:border-r-0 ${active ? "bg-red-600" : "bg-muted/30"}`}>
                                  <span className="sr-only">{active ? "Aktif" : "Tidak ada penempatan aktif tercatat"}</span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      ))}
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
