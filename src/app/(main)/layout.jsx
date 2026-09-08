import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import getCurrentUser from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AuthProvider user={user}>
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        }}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 flex-col gap-4 py-4 md:gap-6 md:py-6">
                {children}
              </div>
            </div>
          </div>
          <footer className="mt-auto border-t bg-background/70 px-4 py-4 text-center text-xs text-muted-foreground backdrop-blur-sm md:px-6">
            Dikembangkan oleh <span className="font-semibold"> Tim DnT ApotekKu.</span>
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </AuthProvider>
  );
}
