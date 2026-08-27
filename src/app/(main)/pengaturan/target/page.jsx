"use client";

import { useRouter, useSearchParams } from "next/navigation";

import PageHeading from "@/components/page-heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BasketSizeTab from "./components/basket-size-tab";
import GofitkuTab from "./components/gofitku-tab";
import NilaiTransaksiTab from "./components/nilai-transaksi-tab";

const TAB_CONFIG = {
  ns: { label: "Nilai Transaksi", component: NilaiTransaksiTab },
  bs: { label: "Basket Size", component: BasketSizeTab },
  gofitku: { label: "GoFitKu", component: GofitkuTab },
};

export default function PengaturanTargetPage() {
  const router = useRouter();
  const search_params = useSearchParams();
  const requested_tab = search_params.get("tab");
  const active_tab = Object.hasOwn(TAB_CONFIG, requested_tab)
    ? requested_tab
    : "ns";
  const ActiveTab = TAB_CONFIG[active_tab].component;

  const handle_tab_change = (next_tab) => {
    const next_params = new URLSearchParams(search_params.toString());
    next_params.set("tab", next_tab);
    router.replace(`/pengaturan/target?${next_params.toString()}`);
  };

  return (
    <>
      <div className="px-4 lg:px-6">
        <PageHeading
          title="Pengaturan"
          description="Kelola target Nilai Transaksi, Basket Size, dan GoFitKu."
        />
      </div>

      <div className="px-4 lg:px-6">
        <Tabs value={active_tab} onValueChange={handle_tab_change} className="gap-4">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/80 p-1">
            {Object.entries(TAB_CONFIG).map(([key, item]) => (
              <TabsTrigger key={key} value={key} className="min-w-max px-4 py-2">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={active_tab}>
            <ActiveTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
