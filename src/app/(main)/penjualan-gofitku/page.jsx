"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ChartBarLabel } from "@/components/charts/chart-bar-label";
import RingkasanTab from "./components/ringkasan-tab-content";
import { useAuth } from "@/components/auth-provider";
import ConfirmActionDialog from "@/components/confirm-action-dialog";
import FilterField from "@/components/filter-field";
import OptionDropdown from "@/components/option-dropdown";
import PengaturanRowSheet from "../pengaturan/component/pengaturan-row-sheet";
import PageHeading from "@/components/page-heading";
import { hasRoleAccess } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DetailTab = dynamic(() => import("./components/detail-tab-content"));
const SalesEntryModal = dynamic(() => import("./components/sales-entry-modal"));
const default_date = new Date().toISOString().split("T")[0];

function get_month_input_value(date_value) {
  return String(date_value ?? "").slice(0, 7);
}

function get_first_date_from_month(month_value) {
  return `${month_value}-01`;
}

export default function PenjualanGoFitKuPage() {
  const { role } = useAuth();

  function get_initial_sales_form(group, default_product) {
    return {
      scanned_entries: [
        {
          id: `${group?.uuid ?? "outlet"}_entry_1`,
          employee_uuid: group?.rows?.find((row) => row.is_active)?.uuid ?? "",
          produk_uuid: default_product?.value ?? "",
          product_name: default_product?.label ?? "",
          date: default_date,
          sales_total: "",
        },
      ],
      uploaded_images: [],
      scan_status: "idle",
    };
  }

  function get_default_entries(group, selected_date, default_product) {
    return get_initial_sales_form(group, default_product).scanned_entries.map((entry) => ({
      ...entry,
      date: selected_date,
    }));
  }

  function create_manual_entry(group, selected_date, entry_index, default_product) {
    return {
      id: `${group?.uuid ?? "outlet"}_manual_${entry_index}`,
      employee_uuid: group?.rows?.find((row) => row.is_active)?.uuid ?? "",
      produk_uuid: default_product?.value ?? "",
      product_name: default_product?.label ?? "",
      date: selected_date,
      sales_total: "",
    };
  }

  const [outlet_groups, setOutletGroups] = useState([]);
  const [produk_options, setProdukOptions] = useState([]);
  const [chart_data, setChartData] = useState({
    outlet_chart_data: [],
    product_chart_data: [],
  });
  const [active_tab, setActiveTab] = useState("ringkasan");
  const [selected_date, setSelectedDate] = useState(default_date);
  const [selected_detail_outlet, setSelectedDetailOutlet] = useState("");
  const [active_outlet, setActiveOutlet] = useState(null);
  const [sales_form, setSalesForm] = useState(() => get_initial_sales_form(null, null));
  const [is_loading_page, setIsLoadingPage] = useState(true);
  const [is_scanning, setIsScanning] = useState(false);
  const [is_saving, setIsSaving] = useState(false);
  const [editing_row, setEditingRow] = useState(null);
  const [editing_outlet, setEditingOutlet] = useState(null);
  const [deleting_row, setDeletingRow] = useState(null);
  const [deleting_outlet, setDeletingOutlet] = useState(null);
  const [is_deleting_row, setIsDeletingRow] = useState(false);

  const default_product = produk_options[0] ?? null;
  const is_admin = hasRoleAccess(role, ["admin"]);
  const detail_outlet_options = outlet_groups.map((group) => ({
      value: group.uuid,
      label: group.outlet_name,
    }));
  const resolved_detail_outlet = outlet_groups.some(
    (group) => group.uuid === selected_detail_outlet,
  )
    ? selected_detail_outlet
    : (outlet_groups[0]?.uuid ?? "");
  const detail_outlet_groups = is_admin
    ? outlet_groups.filter((group) => group.uuid === resolved_detail_outlet)
    : outlet_groups.slice(0, 1);
  const outlet_active_group = !is_admin ? outlet_groups[0] : null;
  const is_detail_tab = active_tab === "detail";
  const outlet_chart_height = Math.max(
    320,
    chart_data.outlet_chart_data.length * 42,
  );

  const load_sales_charts = async () => {
    const [outlet_chart_result, product_chart_result] = await Promise.all([
      fetch("/api/penjualan-gofitku?outlet_chart=true"),
      fetch("/api/penjualan-gofitku?product_chart=true"),
    ]);
    const [outlet_chart_payload, product_chart_payload] = await Promise.all([
      outlet_chart_result.json(),
      product_chart_result.json(),
    ]);

    if (!outlet_chart_result.ok || !outlet_chart_payload.success) {
      throw new Error(
        outlet_chart_payload.message ||
          "Gagal mengambil statistik outlet GoFitKu.",
      );
    }

    if (!product_chart_result.ok || !product_chart_payload.success) {
      throw new Error(
        product_chart_payload.message ||
          "Gagal mengambil statistik produk GoFitKu.",
      );
    }

    setChartData({
      outlet_chart_data: outlet_chart_payload.data?.chart_data ?? [],
      product_chart_data: product_chart_payload.data?.chart_data ?? [],
    });
  };

  useEffect(() => {
    let should_ignore = false;

    async function load_initial_data() {
      try {
        setIsLoadingPage(true);

        const [produk_result, penjualan_result] = await Promise.all([
          fetch("/api/produk-gofitku"),
          fetch(`/api/penjualan-gofitku?date=${default_date}`),
        ]);
        const produk_payload = await produk_result.json();
        const penjualan_payload = await penjualan_result.json();

        if (!produk_result.ok || !produk_payload.success) {
          throw new Error(
            produk_payload.message || "Gagal mengambil master produk GoFitKu.",
          );
        }

        if (!penjualan_result.ok || !penjualan_payload.success) {
          throw new Error(
            penjualan_payload.message || "Gagal mengambil data penjualan GoFitKu.",
          );
        }

        if (should_ignore) {
          return;
        }

        const next_produk_options = (
          produk_payload.data?.data_produk_gofitku ?? []
        ).map((item) => ({
          value: item.uuid,
          label: item.name,
        }));
        const next_outlet_groups = penjualan_payload.data?.outlet_groups ?? [];

        setProdukOptions(next_produk_options);
        setOutletGroups(next_outlet_groups);
        await load_sales_charts();
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data penjualan GoFitKu.",
          );
        }
      } finally {
        if (!should_ignore) {
          setIsLoadingPage(false);
        }
      }
    }

    load_initial_data();

    return () => {
      should_ignore = true;
    };
  }, []);

  const load_sales_groups = async (date) => {
    const result = await fetch(`/api/penjualan-gofitku?date=${date}`);
    const payload = await result.json();

    if (!result.ok || !payload.success) {
      throw new Error(payload.message || "Gagal mengambil data penjualan GoFitKu.");
    }

    setOutletGroups(payload.data?.outlet_groups ?? []);
  };

  const load_outlet_group = async (group_uuid, date) => {
    const result = await fetch(
      `/api/penjualan-gofitku?date=${date}&uuid_outlet=${group_uuid}`,
    );
    const payload = await result.json();

    if (!result.ok || !payload.success) {
      throw new Error(payload.message || "Gagal mengambil data penjualan GoFitKu.");
    }

    const updated_group = payload.data?.outlet_groups?.[0];

    if (!updated_group) {
      setOutletGroups((current) =>
        current.filter((group) => group.uuid !== group_uuid),
      );
      return;
    }

    setOutletGroups((current) =>
      current.map((group) => (group.uuid === group_uuid ? updated_group : group)),
    );
  };

  const open_add_modal = (group) => {
    setActiveOutlet(group);
    setSalesForm({
      ...get_initial_sales_form(group, default_product),
      scanned_entries: get_default_entries(
        group,
        selected_date,
        default_product,
      ),
    });
  };

  const handle_open_add_modal = () => {
    if (!outlet_active_group?.rows?.some((row) => row.is_active)) {
      toast.error("Belum ada penempatan InsanKu aktif di outlet ini.");
      return;
    }

    open_add_modal(outlet_active_group);
  };

  const close_add_modal = () => {
    setActiveOutlet(null);
    setSalesForm(get_initial_sales_form(null, default_product));
  };

  const open_edit_modal = (group, row) => {
    setEditingOutlet(group);
    setEditingRow({
      ...row,
      today_input: String(row.today_input ?? 0),
    });
  };

  const close_edit_modal = () => {
    setEditingOutlet(null);
    setEditingRow(null);
  };

  const open_delete_dialog = (group, row) => {
    setDeletingOutlet(group);
    setDeletingRow(row);
  };

  const close_delete_dialog = () => {
    setDeletingOutlet(null);
    setDeletingRow(null);
  };

  const handle_save_sales = async (event) => {
    event.preventDefault();

    if (!active_outlet) {
      return;
    }

    const valid_entries = sales_form.scanned_entries
      .map((entry) => ({
        ...entry,
        sales_total: Number(entry.sales_total || 0),
      }))
      .filter((entry) => entry.employee_uuid && entry.sales_total >= 0)
      .map((entry) => {
        const selected_product = produk_options.find(
          (option) => option.value === entry.produk_uuid,
        );

        return {
          employee_uuid: entry.employee_uuid,
          produk_uuid: entry.produk_uuid,
          product_name: selected_product?.label ?? entry.product_name ?? "",
          date: entry.date,
          sales_total: entry.sales_total,
        };
      });

    if (!valid_entries.length) {
      toast.error("Belum ada entri yang bisa disimpan.");
      return;
    }

    try {
      setIsSaving(true);

      const result = await fetch("/api/penjualan-gofitku", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outlet_uuid: active_outlet.uuid,
          entries: valid_entries,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menyimpan penjualan GoFitKu.");
      }

      await load_outlet_group(
        active_outlet.uuid,
        selected_date,
      );
      await load_sales_charts();

      toast.success(payload.message || "Penjualan GoFitKu berhasil disimpan.");
      close_add_modal();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan penjualan GoFitKu.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handle_update_row = async (next_row) => {
    if (!next_row || !editing_outlet) {
      return;
    }

    const selected_product = produk_options.find(
      (option) => option.value === next_row.produk_uuid,
    );

    const result = await fetch("/api/penjualan-gofitku", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_penjualan_gofitku: next_row.uuid,
        outlet_uuid: editing_outlet.uuid,
        employee_uuid: next_row.employee_uuid,
        produk_uuid: next_row.produk_uuid,
        product_name: selected_product?.label ?? next_row.product_name ?? "",
        date: next_row.date,
        sales_total: next_row.today_input,
      }),
    });
    const payload = await result.json();

    if (!result.ok || !payload.success) {
      throw new Error(payload.message || "Gagal memperbarui penjualan GoFitKu.");
    }

    await load_outlet_group(
      editing_outlet.uuid,
      selected_date,
    );
    await load_sales_charts();

    toast.success(payload.message || "Penjualan GoFitKu berhasil diperbarui.");
  };

  const handle_delete_row = async () => {
    if (!deleting_row || !deleting_outlet) {
      return;
    }

    try {
      setIsDeletingRow(true);

      const result = await fetch("/api/penjualan-gofitku", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid_penjualan_gofitku: deleting_row.uuid,
          outlet_uuid: deleting_outlet.uuid,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menghapus penjualan GoFitKu.");
      }

      await load_outlet_group(
        deleting_outlet.uuid,
        selected_date,
      );
      await load_sales_charts();

      toast.success(payload.message || "Penjualan GoFitKu berhasil dihapus.");
      close_delete_dialog();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus penjualan GoFitKu.",
      );
    } finally {
      setIsDeletingRow(false);
    }
  };

  const handle_image_upload = (event) => {
    const files = Array.from(event.target.files ?? []).map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      size_label: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      file,
    }));

    setSalesForm((current) => ({
      ...current,
      uploaded_images: files,
      scan_status: files.length ? "ready" : "idle",
      scanned_entries: files.length
        ? current.scanned_entries
        : get_default_entries(
            active_outlet,
            selected_date,
            default_product,
          ),
    }));
  };

  const handle_scan_images = async () => {
    if (!active_outlet || !sales_form.uploaded_images.length) {
      return;
    }

    try {
      setIsScanning(true);

      const images = await Promise.all(
        sales_form.uploaded_images.map(
          (image) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();

              reader.onload = () => {
                const result = String(reader.result ?? "");
                const [, base64 = ""] = result.split(",");

                resolve({
                  id: image.id,
                  image: base64,
                  mime_type: image.file.type,
                });
              };

              reader.onerror = () => {
                reject(new Error(`Gagal membaca file ${image.name}.`));
              };

              reader.readAsDataURL(image.file);
            }),
        ),
      );

      const result = await fetch("/api/api-ai/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images,
        }),
      });
      const payload = await result.json();

      if (!result.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.message || "Gagal memproses scan AI.");
      }

      const next_entries = payload.data.flatMap((scan_group, group_index) => {
        const scan_items = Array.isArray(scan_group?.items) ? scan_group.items : [];

        return scan_items.map((item, item_index) => {
          const matched_product = produk_options.find(
            (option) =>
              option.label.trim().toLowerCase() ===
              String(item?.produk ?? "").trim().toLowerCase(),
          );

          return {
            id: `${active_outlet.uuid}_scan_${group_index + 1}_${item_index + 1}`,
            employee_uuid: active_outlet.rows?.find((row) => row.is_active)?.uuid ?? "",
            produk_uuid: matched_product?.value ?? "",
            product_name: matched_product?.label ?? String(item?.produk ?? "").trim(),
            date:
              String(scan_group?.tanggal ?? "").trim() ||
              selected_date,
            sales_total: String(item?.qty ?? 0),
          };
        });
      });

      if (!next_entries.length) {
        throw new Error("Hasil scan tidak memiliki item yang bisa dipakai.");
      }

      setSalesForm((current) => ({
        ...current,
        scan_status: "done",
        scanned_entries: next_entries,
      }));
      toast.success("Hasil scan berhasil dimasukkan ke card entri.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memproses scan AI.",
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handle_entry_change = (entry_id, field, value) => {
    setSalesForm((current) => ({
      ...current,
      scanned_entries: current.scanned_entries.map((entry) =>
        entry.id === entry_id
          ? {
              ...entry,
              [field]: value,
            }
          : entry,
      ),
    }));
  };

  const handle_product_change = (entry_id, produk_uuid) => {
    const selected_product = produk_options.find((option) => option.value === produk_uuid);

    setSalesForm((current) => ({
      ...current,
      scanned_entries: current.scanned_entries.map((entry) =>
        entry.id === entry_id
          ? {
              ...entry,
              produk_uuid,
              product_name: selected_product?.label ?? entry.product_name,
            }
          : entry,
      ),
    }));
  };

  const handle_add_manual_entry = () => {
    if (!active_outlet) {
      return;
    }

    setSalesForm((current) => ({
      ...current,
      scanned_entries: [
        ...current.scanned_entries,
        create_manual_entry(
          active_outlet,
          selected_date,
          current.scanned_entries.length + 1,
          default_product,
        ),
      ],
    }));
  };

  const handle_remove_entry = (entry_id) => {
    setSalesForm((current) => {
      const next_entries = current.scanned_entries.filter((entry) => entry.id !== entry_id);

      return {
        ...current,
        scanned_entries: next_entries.length
          ? next_entries
          : get_default_entries(
              active_outlet,
              selected_date,
              default_product,
            ),
      };
    });
  };

  const handle_remove_image = (image_id) => {
    setSalesForm((current) => {
      const uploaded_images = current.uploaded_images.filter((image) => image.id !== image_id);

      return {
        ...current,
        uploaded_images,
        scan_status: uploaded_images.length ? "ready" : "idle",
        scanned_entries: uploaded_images.length
          ? current.scanned_entries
          : get_default_entries(
              active_outlet,
              selected_date,
              default_product,
            ),
      };
    });
  };

  const handle_selected_date_change = async (event) => {
    const input_value = event.target.value;
    const next_date = is_detail_tab
      ? get_first_date_from_month(input_value)
      : input_value;

    setSelectedDate(next_date);

    try {
      await load_sales_groups(next_date);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data penjualan GoFitKu.",
      );
    }
  };

  const handle_export_sales = async () => {
    try {
      const params = new URLSearchParams({
        export: "true",
        date: selected_date,
      });
      const result = await fetch(`/api/penjualan-gofitku?${params.toString()}`);
      const payload = await result.json();

      if (!result.ok || !payload.success) {
        throw new Error(payload.message || "Gagal mengambil data ekspor.");
      }

      const export_groups = payload.data?.outlet_groups ?? [];

      if (!export_groups.length) {
        toast.error("Data penjualan belum tersedia untuk diekspor.");
        return;
      }

      if (!export_groups.some((group) => group.monthly_groups?.length)) {
        toast.error("Data penjualan bulanan belum tersedia untuk diekspor.");
        return;
      }

      const { export_penjualan_gofitku } = await import(
        "@/lib/penjualanGofitkuExport"
      );
      export_penjualan_gofitku(export_groups);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengekspor data penjualan.",
      );
    }
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Penjualan GoFitKu"
          description={
            is_admin
              ? "Pantau dan kelola input penjualan GoFitKu seluruh outlet."
              : "Input penjualan GoFitKu harian untuk outlet Anda."
          }
        />
      </div>

      <div className="px-4 lg:px-6">
        {is_loading_page ? (
          <div className="flex min-h-40 items-center justify-center rounded-lg border bg-card">
            <LoaderCircleIcon className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Card>
              <div className="grid divide-y xl:grid-cols-2 xl:divide-x xl:divide-y-0">
                <ChartBarLabel
                  renderCard={false}
                  title="Top 5 Outlet"
                  description="Akumulasi penjualan tertinggi per outlet."
                  data={chart_data.outlet_chart_data}
                  showLegend={false}
                  icon={
                    <FileSpreadsheetIcon className="size-5 text-rose-700" />
                  }
                  chartClassName="w-full"
                  chartStyle={{ minHeight: `${outlet_chart_height}px` }}
                  emptyClassName="min-h-[320px]"
                  emptyMessage="Diagram penjualan outlet belum tersedia."
                />
                <ChartBarLabel
                  renderCard={false}
                  title="Top 5 Produk GoFitKu"
                  description={
                    is_admin
                      ? "Produk dengan total penjualan tertinggi."
                      : "Produk dengan total penjualan tertinggi di outlet Anda."
                  }
                  data={chart_data.product_chart_data}
                  showLegend={false}
                  icon={
                    <FileSpreadsheetIcon className="size-5 text-rose-700" />
                  }
                  chartClassName="w-full"
                  chartStyle={{ minHeight: "320px" }}
                  emptyClassName="min-h-[320px]"
                  emptyMessage="Diagram penjualan produk belum tersedia."
                />
              </div>
            </Card>

            {is_admin ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handle_export_sales}
                  className="w-full shrink-0 bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                >
                  <FileSpreadsheetIcon className="size-4" />
                  Ekspor
                </Button>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handle_open_add_modal}
                  disabled={!outlet_active_group?.rows?.some((row) => row.is_active)}
                  className="w-full shrink-0 sm:w-auto"
                >
                  <PlusIcon className="size-4" />
                  Tambah Penjualan
                </Button>
              </div>
            )}

            <Tabs value={active_tab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="ringkasan" className="flex-1 px-4">
                  Ringkasan
                </TabsTrigger>
                <TabsTrigger value="detail" className="flex-1 px-4">
                  Detail
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ringkasan">
                <RingkasanTab
                  outlet_groups={outlet_groups}
                  is_outlet_view={!is_admin}
                  selected_date={selected_date}
                  on_date_change={handle_selected_date_change}
                />
              </TabsContent>

              <TabsContent value="detail">
                <Card className="gap-0 border-t-2 border-t-primary/70">
                  <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>Detail</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
                        {is_admin ? (
                          <FilterField
                            label="Outlet"
                            htmlFor="filter-outlet-detail-gofitku"
                            className="w-full lg:w-[320px]"
                          >
                            <OptionDropdown
                              id="filter-outlet-detail-gofitku"
                              value={resolved_detail_outlet}
                              options={detail_outlet_options}
                              onValueChange={setSelectedDetailOutlet}
                              ariaLabel="Filter outlet detail GoFitKu"
                              searchable
                              searchPlaceholder="Cari outlet..."
                              emptyMessage="Outlet tidak ditemukan."
                            />
                          </FilterField>
                        ) : null}

                        <FilterField label="Bulan" className="w-full lg:w-[180px]">
                          <Input
                            type="month"
                            value={get_month_input_value(selected_date)}
                            onChange={handle_selected_date_change}
                            className="bg-card"
                            aria-label="Bulan detail penjualan GoFitKu"
                          />
                        </FilterField>
                      </div>

                      {is_admin ? (
                        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                          <Button
                            type="button"
                            onClick={() => open_add_modal(detail_outlet_groups[0])}
                            disabled={
                              !detail_outlet_groups[0]?.rows?.some(
                                (row) => row.is_active,
                              )
                            }
                            className="w-full shrink-0 sm:w-auto"
                          >
                            <PlusIcon className="size-4" />
                            Tambah Penjualan
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    <DetailTab
                      outlet_groups={detail_outlet_groups}
                      is_outlet_view={!is_admin}
                      on_edit_row={open_edit_modal}
                      on_delete_row={open_delete_dialog}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {active_outlet ? (
        <SalesEntryModal
          open
          active_outlet={active_outlet}
          sales_form={sales_form}
          produk_options={produk_options}
          is_scanning={is_scanning}
          is_saving={is_saving}
          on_close={close_add_modal}
          on_submit={handle_save_sales}
          on_image_upload={handle_image_upload}
          on_scan_images={handle_scan_images}
          on_remove_image={handle_remove_image}
          on_add_manual_entry={handle_add_manual_entry}
          on_remove_entry={handle_remove_entry}
          on_entry_change={handle_entry_change}
          on_product_change={handle_product_change}
        />
      ) : null}
      <PengaturanRowSheet
        key={editing_row?.uuid ?? "edit-penjualan-gofitku-sheet"}
        open={Boolean(editing_row)}
        on_open_change={(open) => {
          if (!open) {
            close_edit_modal();
          }
        }}
        title="Edit Penjualan"
        item={editing_row}
        fields={[
          {
            key: "date",
            label: "Tanggal",
            type: "date",
          },
          {
            key: "employee_uuid",
            label: "Nama",
            type: "select",
            options: (editing_outlet?.rows ?? [])
              .filter((item) => item.is_active || item.uuid === editing_row?.employee_uuid)
              .map((item) => ({
                value: item.uuid,
                label: item.name,
              })),
            searchable: true,
            search_placeholder: "Cari InsanKu...",
            empty_search_message: "InsanKu tidak ditemukan.",
            aria_label: "Nama InsanKu penjualan",
          },
          {
            key: "produk_uuid",
            label: "Produk",
            type: "select",
            options: produk_options,
            searchable: true,
            search_placeholder: "Cari produk...",
            empty_search_message: "Produk tidak ditemukan.",
            aria_label: "Produk GoFitKu",
          },
          {
            key: "today_input",
            label: "Jumlah",
            type: "number",
            input_type: "number",
            min: "0",
            step: "1",
            placeholder: "Masukkan jumlah",
          },
        ]}
        on_save={handle_update_row}
      />
      <ConfirmActionDialog
        open={Boolean(deleting_row)}
        onOpenChange={(open) => {
          if (!open) {
            close_delete_dialog();
          }
        }}
        title="Hapus Penjualan"
        description={`Data penjualan ${deleting_row?.name ?? ""} akan dihapus dari detail outlet.`}
        confirmLabel="Hapus"
        confirmVariant="delete"
        onConfirm={handle_delete_row}
        isPending={is_deleting_row}
      />
    </>
  );
}
