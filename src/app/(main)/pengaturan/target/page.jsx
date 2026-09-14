"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";

import PageHeading from "@/components/page-heading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
const BasketSizeTab = dynamic(() => import("./components/basket-size-tab"));
const GlobalTab = dynamic(() => import("./components/global-tab"));
const GofitkuTab = dynamic(() => import("./components/gofitku-tab"));
const NilaiTransaksiTab = dynamic(
  () => import("./components/nilai-transaksi-tab"),
);

const TAB_CONFIG = {
  global: { label: "Global", component: GlobalTab },
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
    : "global";
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
          description="Kelola target global, Nilai Transaksi, Basket Size, dan GoFitKu."
        />
      </div>

      <div className="px-4 lg:px-6">
        <Tabs value={active_tab} onValueChange={handle_tab_change}>
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
