"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import ConfirmActionDialog from "@/components/confirm-action-dialog";
import FilterField from "@/components/filter-field";
import OptionDropdown from "@/components/option-dropdown";
import Pagination from "@/components/pagination";
import SortableTableHead from "@/components/sortable-table-head";
import usePagination from "@/hooks/usePagination";
import useSearch from "@/hooks/useSearch";
import {
  admin_account_roles,
  isSuperadmin,
} from "@/lib/role";
import { menu_access_options } from "@/lib/menu-access";
import PengaturanRowSheet from "../../component/pengaturan-row-sheet";
import { Button } from "@/components/ui/button";
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

const PAGE_SIZE = 50;

export default function AdminTab() {
  const router = useRouter();
  const { role, user } = useAuth();
  const [admin, setAdmin] = useState([]);
  const { search, setSearch, filtered_items } = useSearch(admin, ["name"]);
  const [selected_role, setSelectedRole] = useState("all");
  const [selected_admin, setSelectedAdmin] = useState(null);
  const [deleting_admin, setDeletingAdmin] = useState(null);
  const [is_sheet_open, setIsSheetOpen] = useState(false);
  const [is_create_sheet_open, setIsCreateSheetOpen] = useState(false);
  const [is_deleting_admin, setIsDeletingAdmin] = useState(false);
  const [sort_key, setSortKey] = useState("name");
  const [sort_direction, setSortDirection] = useState("asc");
  const role_filtered_items = useMemo(
    () =>
      selected_role === "all"
        ? filtered_items
        : filtered_items.filter((item) => item.role === selected_role),
    [filtered_items, selected_role],
  );
  const sorted_items = useMemo(() => {
    return [...role_filtered_items].sort((a, b) => {
      const direction = sort_direction === "asc" ? 1 : -1;

      return String(a[sort_key] ?? "").localeCompare(
        String(b[sort_key] ?? ""),
        "id-ID",
      ) * direction;
    });
  }, [role_filtered_items, sort_direction, sort_key]);
  const {
    current_page,
    setCurrentPage,
    total_pages,
    paginated_rows,
    previous_page,
    next_page,
  } = usePagination(sorted_items, PAGE_SIZE);

  const toggle_sort = (next_sort_key) => {
    if (sort_key === next_sort_key) {
      setSortDirection((current_direction) =>
        current_direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(next_sort_key);
    setSortDirection("asc");
  };

  const format_role_label = (value) => {
    const normalized_role = String(value ?? "").trim().toLowerCase();

    if (!normalized_role) {
      return "-";
    }

    return normalized_role.charAt(0).toUpperCase() + normalized_role.slice(1);
  };

  const admin_role_options = admin_account_roles.map((admin_role) => ({
    value: admin_role,
    label: format_role_label(admin_role),
  }));
  const role_helper = "Superadmin dapat mengelola seluruh role akun.";

  const can_manage_admin = (row) =>
    !isSuperadmin(row?.role) || isSuperadmin(role);
  const can_delete_admin = (row) => !isSuperadmin(row?.role);

  useEffect(() => {
    let should_ignore = false;

    async function load_admin() {
      try {
        const result = await fetch("/api/admin");
        const data = await result.json();

        if (!result.ok || !data.success) {
          throw new Error(data.message || "Gagal mengambil data admin.");
        }

        if (should_ignore) {
          return;
        }

        setAdmin(data.data.data_admin);
      } catch (error) {
        if (!should_ignore) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Gagal mengambil data admin.",
          );
        }
      }
    }

    void load_admin();

    return () => {
      should_ignore = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selected_role, setCurrentPage]);

  const handle_save = async (next_admin) => {
    const response = await fetch("/api/admin", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uuid_admin: next_admin.uuid,
        name: next_admin.name,
        username: next_admin.username,
        role: next_admin.role,
        menu_access_keys: next_admin.menu_access_keys,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal memperbarui data admin.");
    }

    setAdmin((current) =>
      current.map((item) => (item.uuid === payload.data.uuid ? payload.data : item)),
    );

    if (payload.data.uuid === user?.uuid) {
      router.refresh();
    }

    toast.success(payload.message || "Data admin berhasil diperbarui.");
  };

  const handle_create = async (new_admin) => {
    const response = await fetch("/api/admin", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: new_admin.name,
        username: new_admin.username,
        password: new_admin.password,
        role: new_admin.role,
        menu_access_keys: new_admin.menu_access_keys,
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.message || "Gagal menambahkan admin.");
    }

    setAdmin((current) => [payload.data, ...current]);
    toast.success(payload.message || "Admin berhasil ditambahkan.");
  };

  const handle_delete = async () => {
    if (!deleting_admin) {
      return;
    }

    try {
      setIsDeletingAdmin(true);

      const response = await fetch("/api/admin", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid_admin: deleting_admin.uuid,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Gagal menghapus admin.");
      }

      setAdmin((current) =>
        current.filter((item) => item.uuid !== deleting_admin.uuid),
      );
      setDeletingAdmin(null);
      toast.success(payload.message || "Data admin berhasil dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus admin.",
      );
    } finally {
      setIsDeletingAdmin(false);
    }
  };

  return (
    <Card className="gap-0 border-t-2 border-t-primary/70">
      <CardHeader className="border-b">
        <CardTitle>Admin & Superadmin</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FilterField
              label="Pencarian"
              htmlFor="filter-pencarian-admin"
              className="w-full sm:max-w-sm"
            >
              <Input
                id="filter-pencarian-admin"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama admin..."
              />
            </FilterField>
            <FilterField label="Role" htmlFor="filter-role-admin">
              <OptionDropdown
                id="filter-role-admin"
                value={selected_role}
                onValueChange={setSelectedRole}
                options={[
                  { value: "all", label: "Semua role" },
                  ...admin_role_options,
                ]}
                ariaLabel="Filter role akun"
                triggerClassName="w-full sm:w-48"
              />
            </FilterField>
            <div className="flex w-full justify-end sm:ml-auto sm:w-auto">
              <Button
                type="button"
                onClick={() => setIsCreateSheetOpen(true)}
                className="w-full sm:w-auto"
              >
                <PlusIcon className="size-4" />
                Tambah Admin
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="max-h-[560px] overflow-auto">
              <Table containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Nama"
                        sortKey="name"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Username"
                        sortKey="username"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableTableHead
                        label="Role"
                        sortKey="role"
                        currentSortKey={sort_key}
                        sortDirection={sort_direction}
                        onSort={toggle_sort}
                      />
                    </TableHead>
                    <TableHead>Akses Menu</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated_rows.map((row, index) => (
                    <TableRow key={row.uuid}>
                      <TableCell>{(current_page - 1) * PAGE_SIZE + index + 1}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.username}</TableCell>
                      <TableCell>{format_role_label(row.role)}</TableCell>
                      <TableCell>
                        {isSuperadmin(row.role)
                          ? "Semua menu"
                          : row.role === "admin"
                            ? `${row.menu_access_keys?.length ?? 0} menu`
                            : "Sesuai role"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {can_manage_admin(row) ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedAdmin(row);
                                  setIsSheetOpen(true);
                                }}
                              >
                                <PencilIcon className="size-4" />
                                Edit
                              </Button>
                              {can_delete_admin(row) ? (
                                <Button
                                  type="button"
                                  variant="delete"
                                  size="sm"
                                  onClick={() => setDeletingAdmin(row)}
                                >
                                  <Trash2Icon className="size-4" />
                                  Hapus
                                </Button>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Khusus superadmin
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {role_filtered_items.length === 0 ? (
              <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
                Tidak ada admin atau superadmin yang cocok dengan pencarian.
              </div>
            ) : (
              <Pagination
                current_page={current_page}
                page_size={PAGE_SIZE}
                total_items={role_filtered_items.length}
                total_pages={total_pages}
                item_label="akun"
                on_previous={previous_page}
                on_next={next_page}
              />
            )}
          </div>

          <PengaturanRowSheet
            key={selected_admin?.uuid ?? "admin-sheet"}
            open={is_sheet_open}
            on_open_change={setIsSheetOpen}
            title="Edit Akun Admin"
            description="Perbarui data admin atau superadmin pada tampilan pengaturan."
            item={selected_admin}
            fields={[
              {
                key: "name",
                label: "Nama",
                placeholder: "Masukkan nama admin",
              },
              {
                key: "username",
                label: "Username",
                placeholder: "Masukkan username",
              },
              {
                key: "role",
                label: "Role",
                type: "select",
                placeholder: "Pilih role",
                options: admin_role_options,
                helper: role_helper,
              },
              {
                key: "menu_access_keys",
                label: "Hak Akses Menu",
                type: "multiselect",
                placeholder: "Pilih menu yang dapat diakses",
                options: menu_access_options,
                selection_label: "menu",
                search_placeholder: "Cari nama menu...",
                empty_search_message: "Menu tidak ditemukan.",
                disabled: (draft) => draft.role !== "admin",
                helper: (draft) =>
                  draft.role === "admin"
                    ? "Admin hanya dapat membuka menu yang dipilih."
                    : "Hak akses khusus hanya diterapkan pada role Admin.",
              },
            ]}
            on_save={handle_save}
          />

          <PengaturanRowSheet
            key="admin-create-sheet"
            open={is_create_sheet_open}
            on_open_change={setIsCreateSheetOpen}
            title="Tambah Akun Admin"
            description="Tambahkan data admin atau superadmin baru ke database sesuai hak akses Anda."
            item={{
              name: "",
              username: "",
              password: "",
              role: "admin",
              menu_access_keys: [],
            }}
            fields={[
              {
                key: "name",
                label: "Nama",
                placeholder: "Masukkan nama admin",
              },
              {
                key: "username",
                label: "Username",
                placeholder: "Masukkan username",
              },
              {
                key: "password",
                label: "Password",
                placeholder: "Masukkan password",
              },
              {
                key: "role",
                label: "Role",
                type: "select",
                placeholder: "Pilih role",
                options: admin_role_options,
                helper: role_helper,
              },
              {
                key: "menu_access_keys",
                label: "Hak Akses Menu",
                type: "multiselect",
                placeholder: "Pilih menu yang dapat diakses",
                options: menu_access_options,
                selection_label: "menu",
                search_placeholder: "Cari nama menu...",
                empty_search_message: "Menu tidak ditemukan.",
                disabled: (draft) => draft.role !== "admin",
                helper: (draft) =>
                  draft.role === "admin"
                    ? "Admin hanya dapat membuka menu yang dipilih."
                    : "Hak akses khusus hanya diterapkan pada role Admin.",
              },
            ]}
            on_save={handle_create}
          />

          <ConfirmActionDialog
            open={Boolean(deleting_admin)}
            onOpenChange={(next_open) => {
              if (!next_open && !is_deleting_admin) {
                setDeletingAdmin(null);
              }
            }}
            title="Hapus Akun Admin"
            description={`Akun ${deleting_admin?.name ?? ""} akan dihapus dari daftar admin dan superadmin.`}
            confirmLabel="Ya, hapus"
            confirmVariant="delete"
            onConfirm={handle_delete}
            isPending={is_deleting_admin}
          />
        </div>
      </CardContent>
    </Card>
  );
}
