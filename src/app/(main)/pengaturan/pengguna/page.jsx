"use client";

import { useRouter, useSearchParams } from "next/navigation";

import PageHeading from "@/components/page-heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminTab from "./components/admin-tab";
import KaryawanTab from "./components/karyawan-tab";

const TAB_LABELS = {
  admin: "Admin",
  karyawan: "Karyawan",
};

export default function PenggunaPage() {
  const router = useRouter();
  const search_params = useSearchParams();
  const requested_tab = search_params.get("tab");
  const active_tab = Object.hasOwn(TAB_LABELS, requested_tab)
    ? requested_tab
    : "admin";

  const handle_tab_change = (next_tab) => {
    const next_params = new URLSearchParams(search_params.toString());
    next_params.set("tab", next_tab);
    router.replace(`/pengaturan/pengguna?${next_params.toString()}`);
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Pengaturan"
          description="Kelola akun admin, superadmin, dan data karyawan dalam satu halaman."
        />
      </div>

      <div className="px-4 lg:px-6">
        <Tabs value={active_tab} onValueChange={handle_tab_change} className="gap-4">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-1">
            {Object.entries(TAB_LABELS).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="min-w-max px-4 py-2">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="admin">
            <AdminTab />
          </TabsContent>
          <TabsContent value="karyawan">
            <KaryawanTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
