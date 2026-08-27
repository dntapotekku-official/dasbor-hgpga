import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PenjualanGofitkuTab({ value, onChange }) {
  const tab_value = "penjualan_gofitku";

  return (
    <Tabs defaultValue={tab_value} className="w-full">
      <TabsList className="w-full justify-start sm:w-auto">
        <TabsTrigger value={tab_value}>Penjualan Gofitku</TabsTrigger>
      </TabsList>

      <TabsContent value={tab_value} className="pt-2">
        <textarea
          id="prompt_penjualan_gofitku"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Masukkan prompt. Gunakan variabel seperti {{product_list}} bila perlu."
          className="flex min-h-40 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </TabsContent>
    </Tabs>
  );
}
