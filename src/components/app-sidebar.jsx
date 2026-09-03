"use client"

import Image from "next/image"
import Link from "next/link"

import { useAuth } from "@/components/auth-provider"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { hasRoleAccess, normalizeRole } from "@/lib/role"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import {
  BadgeDollarSignIcon,
  ChartBarIcon,
  CctvIcon,
  ClipboardCheckIcon,
  IdCardIcon,
  LayoutDashboardIcon,
  PillBottleIcon,
  Settings2Icon,
} from "lucide-react"

const data = {
  navMain: [
    {
      title: "Dasbor",
      url: "/",
      icon: (
        <LayoutDashboardIcon />
      ),
      roles: ["admin", "viewer", "member"],
    },
    {
      title: "Kepuasan Internal",
      url: "/kepuasan-internal",
      icon: (
        <ChartBarIcon />
      ),
      roles: ["admin", "viewer"],
    },
    {
      title: "Kepatuhan SOP CCTV",
      url: "/kepatuhan-sop-cctv",
      icon: (
        <CctvIcon />
      ),
      roles: ["admin", "viewer"],
    },
    {
      title: "Penjualan GoFitKu",
      url: "/penjualan-gofitku",
      icon: (
        <PillBottleIcon />
      ),
      roles: ["admin", "viewer", "member"],
    },
    {
      title: "Nilai Transaksi & Basket Size",
      url: "/nilai-transaksi-basket-size",
      icon: (
        <BadgeDollarSignIcon />
      ),
      roles: ["admin", "viewer", "member"],
    },
    {
      title: "Nilai Magang",
      url: "/nilai-magang",
      icon: (
        <ClipboardCheckIcon />
      ),
      roles: ["admin", "viewer"],
    },
    {
      title: "Atribut InsanKu",
      url: "/atribut-insanku",
      icon: (
        <IdCardIcon />
      ),
      roles: ["admin", "viewer", "member"],
    },
    {
      title: "Pengaturan",
      icon: (
        <Settings2Icon />
      ),
      roles: ["admin"],
      items: [
        {
          title: "Pengguna",
          url: "/pengaturan/pengguna",
          roles: ["admin"],
        },
        {
          title: "Outlet",
          url: "/pengaturan/outlet",
          roles: ["admin"],
        },
        {
          title: "Kunjungan",
          url: "/pengaturan/kunjungan",
          roles: ["admin"],
        },
        {
          title: "Atribut",
          url: "/pengaturan/atribut",
          roles: ["admin"],
        },
        {
          title: "API API",
          url: "/pengaturan/api-ai",
          roles: ["admin"],
        },
        {
          title: "Produk Gofitku",
          url: "/pengaturan/produk-gofitku",
          roles: ["admin"],
        },
        {
          title: "Target",
          url: "/pengaturan/target",
          roles: ["admin"],
        },
      ],
    },
  ],
}

export function AppSidebar({
  ...props
}) {
  const { user } = useAuth()
  const current_user = {
    name: user?.name ?? "Performance Report User",
    username: user?.username ?? user?.role ?? "user",
  };
  const normalized_role = normalizeRole(user?.role ?? "member");
  const nav_items = data.navMain
    .filter((item) => !item.roles || hasRoleAccess(normalized_role, item.roles))
    .map((item) => ({
      ...item,
      items: Array.isArray(item.items)
        ? item.items.filter(
            (child_item) =>
              !child_item.roles || hasRoleAccess(normalized_role, child_item.roles),
          )
        : undefined,
    }));

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-auto data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}>
              <Image
                src="/apotekku-logo-crop.png"
                alt="Performance Report"
                width={120}
                height={83}
                className="h-auto w-[76px] object-contain"
                priority
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={nav_items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={current_user} />
      </SidebarFooter>
    </Sidebar>
  );
}
