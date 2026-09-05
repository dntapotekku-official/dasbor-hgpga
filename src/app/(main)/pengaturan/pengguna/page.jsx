"use client";

import { useRouter, useSearchParams } from "next/navigation";

import PageHeading from "@/components/page-heading";
import { useAuth } from "@/components/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSuperadmin } from "@/lib/role";
import AdminTab from "./components/admin-tab";
import InsanKuTab from "./components/insanKu-tab";

const TAB_LABELS = {
  admin: "Admin",
  insanku: "InsanKu",
};

export default function PenggunaPage() {
  const { role } = useAuth();
  const router = useRouter();
  const search_params = useSearchParams();
  const requested_tab = search_params.get("tab");
  const tab_labels = isSuperadmin(role)
    ? TAB_LABELS
    : { insanku: TAB_LABELS.insanku };
  const active_tab = Object.hasOwn(tab_labels, requested_tab)
    ? requested_tab
    : Object.keys(tab_labels)[0];

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
          description="Kelola akun admin, superadmin, dan data InsanKu dalam satu halaman."
        />
      </div>

      <div className="px-4 lg:px-6">
        <Tabs value={active_tab} onValueChange={handle_tab_change} className="gap-4">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-1">
            {Object.entries(tab_labels).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="min-w-max px-4 py-2">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {isSuperadmin(role) ? (
            <TabsContent value="admin">
              <AdminTab />
            </TabsContent>
          ) : null}
          <TabsContent value="insanku">
            <InsanKuTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
