import { ShieldXIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 lg:px-6">
      <Card className="w-full max-w-lg border-t-2 border-t-amber-500">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <ShieldXIcon className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold">Akses Menu Belum Diberikan</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Hubungi superadmin untuk memberikan akses ke menu yang Anda perlukan.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
