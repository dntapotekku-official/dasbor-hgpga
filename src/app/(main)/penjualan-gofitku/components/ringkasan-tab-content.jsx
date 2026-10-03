"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

import FilterField from "@/components/filter-field";
import Pagination from "@/components/pagination";
import SortableTableHead from "@/components/sortable-table-head";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import usePagination from "@/hooks/usePagination";

const PAGE_SIZE = 50;

function format_percentage(total, target) {
  if (!target) {
    return "0%";
  }

  return `${Math.round((total / target) * 100)}%`;
}

function get_percentage_value(total, target) {
  if (!target) {
    return 0;
  }

  return Number(total || 0) / Number(target);
}

function get_status(total, target, input = null) {
  if ((input ?? total) <= 0) {
    return {
      label: "Belum input",
      class_name: "bg-amber-100 text-amber-700",
    };
  }

  if (total >= target) {
    return {
      label: "Target tercapai",
      class_name: "bg-emerald-100 text-emerald-700",
    };
  }

  return {
    label: "Perlu dikejar",
    class_name: "bg-sky-100 text-sky-700",
  };
}

function sum_rows(rows) {
  return rows.reduce(
    (current_totals, row) => ({
      today_input: current_totals.today_input + Number(row.today_input || 0),
      weekly_total: current_totals.weekly_total + Number(row.weekly_total || 0),
      monthly_total:
        current_totals.monthly_total + Number(row.monthly_total || 0),
      target: current_totals.target + Number(row.target || 0),
    }),
    {
      today_input: 0,
      weekly_total: 0,
      monthly_total: 0,
      target: 0,
    },
  );
}

function get_person_value(row, sort_key) {
  switch (sort_key) {
    case "name":
      return String(row.name ?? "");
    case "today":
      return Number(row.today_input || 0);
    case "weekly":
      return Number(row.weekly_total || 0);
    case "monthly":
      return Number(row.monthly_total || 0);
    case "target":
      return Number(row.target || 0);
    case "percent":
      return get_percentage_value(row.monthly_total, row.target);
    default:
      return 0;
  }
}

function get_outlet_value(row, sort_key) {
  switch (sort_key) {
    case "outlet":
      return String(row.outlet_name ?? "");
    case "today":
      return Number(row.today_input || 0);
    case "weekly":
      return Number(row.weekly_total || 0);
    case "monthly":
      return Number(row.monthly_total || 0);
    case "target":
      return Number(row.target || 0);
    case "percent":
      return get_percentage_value(row.monthly_total, row.target);
    default:
      return 0;
  }
}

function get_insanku_value(row, sort_key) {
  switch (sort_key) {
    case "name":
      return String(row.name ?? "");
    case "outlet":
      return String(row.outlet_label ?? "");
    case "today":
      return Number(row.today_input || 0);
    case "weekly":
      return Number(row.weekly_total || 0);
    case "monthly":
      return Number(row.monthly_total || 0);
    case "target":
      return Number(row.target || 0);
    case "percent":
      return get_percentage_value(row.monthly_total, row.target);
    default:
      return 0;
  }
}

function sort_by_key(rows, sort_key, sort_direction, get_value) {
  const direction = sort_direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const first_value = get_value(a, sort_key);
    const second_value = get_value(b, sort_key);

    if (typeof first_value === "string" || typeof second_value === "string") {
      return (
        String(first_value).localeCompare(String(second_value), "id") *
        direction
      );
    }

    return (Number(first_value) - Number(second_value)) * direction;
  });
}

function StatusBadge({ total, target, input, bordered = false }) {
  const status = get_status(total, target, input);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${status.class_name} ${bordered ? "border" : ""}`}
    >
      {status.label}
    </span>
  );
}

function PersonRows({ rows }) {
  return rows.map((row) => (
    <TableRow key={row.uuid}>
      <TableCell className="whitespace-normal">
        <div className="font-medium">{row.name}</div>
      </TableCell>
      <TableCell className="font-medium">{row.today_input}</TableCell>
      <TableCell className="font-medium">{row.weekly_total}</TableCell>
      <TableCell className="font-medium">{row.monthly_total}</TableCell>
      <TableCell>{row.target}</TableCell>
      <TableCell>{format_percentage(row.monthly_total, row.target)}</TableCell>
      <TableCell className="whitespace-normal">
        <StatusBadge
          total={row.monthly_total}
          target={row.target}
          input={row.today_input}
        />
      </TableCell>
    </TableRow>
  ));
}

function TotalRow({ totals, label = "TOTAL" }) {
  return (
    <TableRow className="font-semibold hover:bg-transparent">
      <TableCell className="sticky bottom-0 z-10 whitespace-normal border-t bg-muted">
        {label}
      </TableCell>
      <TableCell className="sticky bottom-0 z-10 border-t bg-muted">{totals.today_input}</TableCell>
      <TableCell className="sticky bottom-0 z-10 border-t bg-muted">{totals.weekly_total}</TableCell>
      <TableCell className="sticky bottom-0 z-10 border-t bg-muted">{totals.monthly_total}</TableCell>
      <TableCell className="sticky bottom-0 z-10 border-t bg-muted">{totals.target}</TableCell>
      <TableCell className="sticky bottom-0 z-10 border-t bg-muted">
        {format_percentage(totals.monthly_total, totals.target)}
      </TableCell>
      <TableCell className="sticky bottom-0 z-10 whitespace-normal border-t bg-muted text-muted-foreground">
        <StatusBadge
          total={totals.monthly_total}
          target={totals.target}
          input={totals.today_input}
          bordered
        />
      </TableCell>
    </TableRow>
  );
}

function PersonTableHead({ sort_key, sort_direction, onSort }) {
  return (
    <TableRow>
      <TableHead className="w-[32%]">
        <SortableTableHead
          label="Nama"
          sortKey="name"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Total Hari Ini"
          sortKey="today"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Total Minggu Ini"
          sortKey="weekly"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Total Bulan Ini"
          sortKey="monthly"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Target"
          sortKey="target"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Persentase"
          sortKey="percent"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead className="w-[18%]">Status</TableHead>
    </TableRow>
  );
}

function OutletTableHead({ sort_key, sort_direction, onSort }) {
  return (
    <TableRow>
      <TableHead className="w-[32%]">
        <SortableTableHead
          label="Outlet"
          sortKey="outlet"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Total Hari Ini"
          sortKey="today"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Total Minggu Ini"
          sortKey="weekly"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Total Bulan Ini"
          sortKey="monthly"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Target"
          sortKey="target"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Persentase"
          sortKey="percent"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead className="w-[18%]">Status</TableHead>
    </TableRow>
  );
}

function InsanKuTableHead({ sort_key, sort_direction, onSort }) {
  return (
    <TableRow>
      <TableHead className="w-[24%]">
        <SortableTableHead
          label="Nama"
          sortKey="name"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead className="w-[20%]">
        <SortableTableHead
          label="Outlet"
          sortKey="outlet"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Total Hari Ini"
          sortKey="today"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Total Minggu Ini"
          sortKey="weekly"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Total Bulan Ini"
          sortKey="monthly"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Target"
          sortKey="target"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead>
        <SortableTableHead
          label="Persentase"
          sortKey="percent"
          currentSortKey={sort_key}
          sortDirection={sort_direction}
          onSort={onSort}
        />
      </TableHead>
      <TableHead className="w-[16%]">Status</TableHead>
    </TableRow>
  );
}

const RINGKASAN_SUB_TABS = [
  { value: "outlet-insanku", label: "Outlet & InsanKu" },
  { value: "outlet", label: "Outlet" },
  { value: "insanku", label: "InsanKu" },
];

const SUB_TAB_TITLES = {
  "outlet-insanku": "Ringkasan Outlet & InsanKu",
  outlet: "Ringkasan Outlet",
  insanku: "Ringkasan InsanKu",
};

const SEARCH_PLACEHOLDERS = {
  "outlet-insanku": "Cari outlet / nama...",
  outlet: "Cari outlet...",
  insanku: "Cari nama / outlet...",
};

function get_default_sort_key(sub_tab) {
  return sub_tab === "outlet" ? "outlet" : "name";
}

export default function RingkasanTabContent({
  outlet_groups,
  is_outlet_view = false,
}) {
  const [sub_tab, setSubTab] = useState("outlet-insanku");
  const [search, setSearch] = useState("");
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");

  const handle_sub_tab_change = (next_value) => {
    setSubTab(next_value);
    setSearch("");
    setSortKey(get_default_sort_key(next_value));
    setSortDirection("asc");
  };

  const toggle_sort = (next_sort_key) => {
    if (sort_key === next_sort_key) {
      setSortDirection((current_direction) =>
        current_direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(next_sort_key);
    setSortDirection(
      next_sort_key === "name" || next_sort_key === "outlet" ? "asc" : "desc",
    );
  };

  const outlet_summary = useMemo(
    () =>
      outlet_groups.map((group) => ({
        uuid: group.uuid,
        outlet_name: group.outlet_name,
        ...sum_rows(group.rows ?? []),
      })),
    [outlet_groups],
  );

  const insanku_summary = useMemo(() => {
    const aggregated = new Map();

    for (const group of outlet_groups) {
      for (const row of group.rows ?? []) {
        const key = String(row.uuid ?? row.name ?? "");
        const existing = aggregated.get(key);

        if (!existing) {
          aggregated.set(key, {
            uuid: key,
            name: row.name,
            outlet_names: new Set([group.outlet_name]),
            today_input: Number(row.today_input || 0),
            weekly_total: Number(row.weekly_total || 0),
            monthly_total: Number(row.monthly_total || 0),
            target: Number(row.target || 0),
          });
        } else {
          existing.outlet_names.add(group.outlet_name);
          existing.today_input += Number(row.today_input || 0);
          existing.weekly_total += Number(row.weekly_total || 0);
          existing.monthly_total += Number(row.monthly_total || 0);
          existing.target = Math.max(
            existing.target,
            Number(row.target || 0),
          );
        }
      }
    }

    return Array.from(aggregated.values()).map((item) => ({
      ...item,
      outlet_label: Array.from(item.outlet_names)
        .sort((a, b) => String(a).localeCompare(String(b), "id"))
        .join(", "),
    }));
  }, [outlet_groups]);

  const keyword = search.trim().toLowerCase();

  const filtered_sorted_outlets = useMemo(() => {
    const filtered = outlet_summary.filter(
      (outlet) =>
        !keyword ||
        String(outlet.outlet_name ?? "").toLowerCase().includes(keyword),
    );

    return sort_by_key(filtered, sort_key, sort_direction, get_outlet_value);
  }, [outlet_summary, keyword, sort_key, sort_direction]);

  const filtered_sorted_insanku = useMemo(() => {
    const filtered = insanku_summary.filter(
      (row) =>
        !keyword ||
        String(row.name ?? "").toLowerCase().includes(keyword) ||
        String(row.outlet_label ?? "").toLowerCase().includes(keyword),
    );

    return sort_by_key(filtered, sort_key, sort_direction, get_insanku_value);
  }, [insanku_summary, keyword, sort_key, sort_direction]);

  const filtered_grouped_outlets = useMemo(() => {
    const result = [];

    for (const group of outlet_groups) {
      const outlet_matches =
        keyword &&
        String(group.outlet_name ?? "").toLowerCase().includes(keyword);

      const rows = (group.rows ?? []).filter(
        (row) =>
          outlet_matches ||
          !keyword ||
          String(row.name ?? "").toLowerCase().includes(keyword),
      );

      if (!rows.length) {
        continue;
      }

      result.push({
        ...group,
        rows: sort_by_key(rows, sort_key, sort_direction, get_person_value),
        totals: sum_rows(rows),
      });
    }

    result.sort((a, b) =>
      String(a.outlet_name).localeCompare(String(b.outlet_name), "id"),
    );

    return result;
  }, [outlet_groups, keyword, sort_key, sort_direction]);

  const flat_outlet_insanku_rows = useMemo(() => {
    const filtered = (
      outlet_groups.flatMap((group) => group.rows ?? []) ?? []
    ).filter(
      (row) =>
        !keyword || String(row.name ?? "").toLowerCase().includes(keyword),
    );

    return sort_by_key(filtered, sort_key, sort_direction, get_person_value);
  }, [outlet_groups, keyword, sort_key, sort_direction]);

  const outlet_grand_totals = useMemo(
    () => sum_rows(filtered_sorted_outlets),
    [filtered_sorted_outlets],
  );
  const insanku_grand_totals = useMemo(
    () => sum_rows(filtered_sorted_insanku),
    [filtered_sorted_insanku],
  );
  const {
    current_page: grouped_outlet_current_page,
    total_pages: grouped_outlet_total_pages,
    paginated_rows: paginated_grouped_outlets,
    previous_page: previous_grouped_outlet_page,
    next_page: next_grouped_outlet_page,
  } = usePagination(filtered_grouped_outlets, PAGE_SIZE);
  const {
    current_page: outlet_current_page,
    total_pages: outlet_total_pages,
    paginated_rows: paginated_outlet_rows,
    previous_page: previous_outlet_page,
    next_page: next_outlet_page,
  } = usePagination(filtered_sorted_outlets, PAGE_SIZE);
  const {
    current_page: insanku_current_page,
    total_pages: insanku_total_pages,
    paginated_rows: paginated_insanku_rows,
    previous_page: previous_insanku_page,
    next_page: next_insanku_page,
  } = usePagination(filtered_sorted_insanku, PAGE_SIZE);

  if (!outlet_groups.length) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        Data outlet belum tersedia.
      </div>
    );
  }

  if (is_outlet_view) {
    return (
      <Card className="gap-0 border-t-2 border-t-primary/70">
        <CardHeader className="border-b">
          <CardTitle>Ringkasan</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <FilterField
            label="Pencarian"
            htmlFor="filter-pencarian-ringkasan-gofitku"
            className="w-full sm:w-[320px]"
          >
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-pencarian-ringkasan-gofitku"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={SEARCH_PLACEHOLDERS["outlet-insanku"]}
                className="bg-card pl-9"
              />
            </div>
          </FilterField>

          <Table
            className="min-w-[980px]"
            containerClassName="max-h-[70vh] overflow-y-auto rounded-lg border"
          >
            <TableHeader className="sticky top-0 z-10 bg-primary [&_th]:text-primary-foreground">
              <PersonTableHead
                sort_key={sort_key}
                sort_direction={sort_direction}
                onSort={toggle_sort}
              />
            </TableHeader>
            <TableBody>
              {flat_outlet_insanku_rows.length ? (
                <>
                  <PersonRows rows={flat_outlet_insanku_rows} />
                  <TotalRow totals={sum_rows(flat_outlet_insanku_rows)} />
                </>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    Tidak ada data yang cocok dengan pencarian.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs value={sub_tab} onValueChange={handle_sub_tab_change} className="w-full">
      <TabsList className="w-full">
        {RINGKASAN_SUB_TABS.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className="flex-1 px-4">
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <Card className="gap-0 border-t-2 border-t-primary/70">
        <CardHeader className="border-b">
          <CardTitle>{SUB_TAB_TITLES[sub_tab] ?? "Ringkasan"}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <FilterField
            label="Pencarian"
            htmlFor="filter-pencarian-ringkasan-gofitku"
            className="w-full sm:w-[320px]"
          >
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-pencarian-ringkasan-gofitku"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={SEARCH_PLACEHOLDERS[sub_tab]}
                className="bg-card pl-9"
              />
            </div>
          </FilterField>

          {/* Outlet & InsanKu: per outlet dengan rincian per orang */}
          <TabsContent
            value="outlet-insanku"
            className="space-y-3"
          >
            {is_outlet_view ? (
              <Table
                className="min-w-[980px]"
                containerClassName="max-h-[70vh] overflow-y-auto rounded-lg border"
              >
                  <TableHeader className="sticky top-0 z-10 bg-primary [&_th]:text-primary-foreground">
                    <PersonTableHead
                      sort_key={sort_key}
                      sort_direction={sort_direction}
                      onSort={toggle_sort}
                    />
                  </TableHeader>
                  <TableBody>
                    {flat_outlet_insanku_rows.length ? (
                      <>
                        <PersonRows rows={flat_outlet_insanku_rows} />
                        <TotalRow totals={sum_rows(flat_outlet_insanku_rows)} />
                      </>
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center text-sm text-muted-foreground"
                        >
                          Tidak ada data yang cocok dengan pencarian.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
            ) : filtered_grouped_outlets.length ? (
              <>
                <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
                  {paginated_grouped_outlets.map((group) => (
                    <Card
                      key={`${group.uuid}-summary`}
                      className="gap-0 bg-orange-50/60 shadow-none"
                    >
                      <CardHeader>
                        <CardTitle>{group.outlet_name}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Table
                          className="min-w-[980px]"
                          containerClassName="rounded-lg border bg-card"
                        >
                          <TableHeader sticky={false} className="bg-primary [&_th]:text-primary-foreground">
                            <PersonTableHead
                              sort_key={sort_key}
                              sort_direction={sort_direction}
                              onSort={toggle_sort}
                            />
                          </TableHeader>
                          <TableBody>
                            <PersonRows rows={group.rows} />
                            <TotalRow totals={group.totals} />
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {filtered_grouped_outlets.length > PAGE_SIZE ? (
                  <Pagination
                    current_page={grouped_outlet_current_page}
                    page_size={PAGE_SIZE}
                    total_items={filtered_grouped_outlets.length}
                    total_pages={grouped_outlet_total_pages}
                    item_label="outlet"
                    on_previous={previous_grouped_outlet_page}
                    on_next={next_grouped_outlet_page}
                  />
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Tidak ada data yang cocok dengan pencarian.
              </div>
            )}
          </TabsContent>

          {/* Outlet: 1 baris per outlet */}
          <TabsContent value="outlet">
            <Table
              className="min-w-[860px]"
              containerClassName="max-h-[70vh] overflow-y-auto rounded-lg border"
            >
                <TableHeader className="sticky top-0 z-10 bg-primary [&_th]:text-primary-foreground">
                  <OutletTableHead
                    sort_key={sort_key}
                    sort_direction={sort_direction}
                    onSort={toggle_sort}
                  />
                </TableHeader>
                <TableBody>
                  {filtered_sorted_outlets.length ? (
                    <>
                      {paginated_outlet_rows.map((outlet) => (
                        <TableRow key={outlet.uuid}>
                          <TableCell className="whitespace-normal">
                            <div className="font-medium">
                              {outlet.outlet_name}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {outlet.today_input}
                          </TableCell>
                          <TableCell className="font-medium">
                            {outlet.weekly_total}
                          </TableCell>
                          <TableCell className="font-medium">
                            {outlet.monthly_total}
                          </TableCell>
                          <TableCell>{outlet.target}</TableCell>
                          <TableCell>
                            {format_percentage(
                              outlet.monthly_total,
                              outlet.target,
                            )}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <StatusBadge
                              total={outlet.monthly_total}
                              target={outlet.target}
                              input={outlet.today_input}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      <TotalRow totals={outlet_grand_totals} />
                    </>
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        Tidak ada data yang cocok dengan pencarian.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filtered_sorted_outlets.length > PAGE_SIZE ? (
                <Pagination
                  current_page={outlet_current_page}
                  page_size={PAGE_SIZE}
                  total_items={filtered_sorted_outlets.length}
                  total_pages={outlet_total_pages}
                  item_label="outlet"
                  on_previous={previous_outlet_page}
                  on_next={next_outlet_page}
                />
              ) : null}
          </TabsContent>

          {/* InsanKu: 1 baris per orang */}
          <TabsContent value="insanku">
            <Table
              className="min-w-[980px]"
              containerClassName="max-h-[70vh] overflow-y-auto rounded-lg border"
            >
                <TableHeader className="sticky top-0 z-10 bg-primary [&_th]:text-primary-foreground">
                  <InsanKuTableHead
                    sort_key={sort_key}
                    sort_direction={sort_direction}
                    onSort={toggle_sort}
                  />
                </TableHeader>
                <TableBody>
                  {filtered_sorted_insanku.length ? (
                    <>
                      {paginated_insanku_rows.map((row) => (
                        <TableRow key={row.uuid}>
                          <TableCell className="whitespace-normal">
                            <div className="font-medium">{row.name}</div>
                          </TableCell>
                          <TableCell className="whitespace-normal text-muted-foreground">
                            {row.outlet_label}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.today_input}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.weekly_total}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.monthly_total}
                          </TableCell>
                          <TableCell>{row.target}</TableCell>
                          <TableCell>
                            {format_percentage(row.monthly_total, row.target)}
                          </TableCell>
                          <TableCell className="whitespace-normal">
                            <StatusBadge
                              total={row.monthly_total}
                              target={row.target}
                              input={row.today_input}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-semibold hover:bg-transparent">
                        <TableCell
                          colSpan={2}
                          className="sticky bottom-0 z-10 whitespace-normal border-t bg-muted"
                        >
                          TOTAL
                        </TableCell>
                        <TableCell className="sticky bottom-0 z-10 border-t bg-muted">
                          {insanku_grand_totals.today_input}
                        </TableCell>
                        <TableCell className="sticky bottom-0 z-10 border-t bg-muted">
                          {insanku_grand_totals.weekly_total}
                        </TableCell>
                        <TableCell className="sticky bottom-0 z-10 border-t bg-muted">
                          {insanku_grand_totals.monthly_total}
                        </TableCell>
                        <TableCell className="sticky bottom-0 z-10 border-t bg-muted">
                          {insanku_grand_totals.target}
                        </TableCell>
                        <TableCell className="sticky bottom-0 z-10 border-t bg-muted">
                          {format_percentage(
                            insanku_grand_totals.monthly_total,
                            insanku_grand_totals.target,
                          )}
                        </TableCell>
                        <TableCell className="sticky bottom-0 z-10 whitespace-normal border-t bg-muted text-muted-foreground">
                          <StatusBadge
                            total={insanku_grand_totals.monthly_total}
                            target={insanku_grand_totals.target}
                            input={insanku_grand_totals.today_input}
                            bordered
                          />
                        </TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        Tidak ada data yang cocok dengan pencarian.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filtered_sorted_insanku.length > PAGE_SIZE ? (
                <Pagination
                  current_page={insanku_current_page}
                  page_size={PAGE_SIZE}
                  total_items={filtered_sorted_insanku.length}
                  total_pages={insanku_total_pages}
                  item_label="InsanKu"
                  on_previous={previous_insanku_page}
                  on_next={next_insanku_page}
                />
              ) : null}
          </TabsContent>
        </CardContent>
      </Card>
    </Tabs>
  );
}
