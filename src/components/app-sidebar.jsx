"use client"

import Image from "next/image"
import Link from "next/link"

import { useAuth } from "@/components/auth-provider"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { canAccessMenu } from "@/lib/menu-access"
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
  BotMessageSquareIcon,
  BadgeDollarSignIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  CctvIcon,
  ClipboardCheckIcon,
  Columns3Icon,
  CrosshairIcon,
  IdCardIcon,
  LayoutDashboardIcon,
  LinkIcon,
  PackageIcon,
  PillBottleIcon,
  Settings2Icon,
  StoreIcon,
  UserRoundCogIcon,
} from "lucide-react"

const data = {
  navMain: [
    {
      title: "Dasbor",
      url: "/",
      icon: (
        <LayoutDashboardIcon />
      ),
      roles: ["member"],
      menuKey: "dashboard",
    },
    {
      title: "Kepuasan Internal",
      url: "/kepuasan-internal",
      icon: (
        <ChartBarIcon />
      ),
      menuKey: "kepuasan-internal",
    },
    {
      title: "Kepatuhan SOP CCTV",
      url: "/kepatuhan-sop-cctv",
      icon: (
        <CctvIcon />
      ),
      roles: ["member"],
      menuKey: "kepatuhan-sop-cctv",
    },
    {
      title: "Penjualan GoFitKu",
      url: "/penjualan-gofitku",
      icon: (
        <PillBottleIcon />
      ),
      roles: ["member"],
      menuKey: "penjualan-gofitku",
    },
    {
      title: "Nilai Transaksi & Basket Size",
      url: "/nilai-transaksi-basket-size",
      badge: "Beta",
      icon: (
        <BadgeDollarSignIcon />
      ),
      roles: ["member"],
      menuKey: "nilai-transaksi-basket-size",
    },
    {
      title: "Nilai Magang",
      url: "/nilai-magang",
      icon: (
        <ClipboardCheckIcon />
      ),
      menuKey: "nilai-magang",
    },
    {
      title: "Atribut InsanKu",
      url: "/atribut-insanku",
      icon: (
        <IdCardIcon />
      ),
      roles: ["member"],
      menuKey: "atribut-insanku",
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
          icon: <UserRoundCogIcon />,
          roles: ["admin"],
          menuKey: "pengaturan-pengguna",
        },
        {
          title: "Outlet",
          url: "/pengaturan/outlet",
          icon: <StoreIcon />,
          roles: ["admin"],
          menuKey: "pengaturan-outlet",
        },
        {
          title: "Produk Gofitku",
          url: "/pengaturan/produk-gofitku",
          icon: <PackageIcon />,
          roles: ["admin"],
          menuKey: "pengaturan-produk-gofitku",
        },
        {
          title: "Target",
          url: "/pengaturan/target",
          icon: <CrosshairIcon />,
          roles: ["admin"],
          menuKey: "pengaturan-target",
        },
        {
          title: "Kolom Atribut",
          url: "/pengaturan/atribut",
          icon: <Columns3Icon />,
          roles: ["admin"],
          menuKey: "pengaturan-atribut",
        },
        {
          title: "API AI",
          url: "/pengaturan/api-ai",
          icon: <BotMessageSquareIcon />,
          roles: ["admin"],
          menuKey: "pengaturan-api-ai",
        },
        {
          title: "URL Website",
          url: "/pengaturan/website-url",
          icon: <LinkIcon />,
          roles: ["admin"],
          menuKey: "pengaturan-website-url",
        },
      ],
    },
  ],
}

export function AppSidebar({
  dashboardkuHomeUrl,
  ...props
}) {
  const { user } = useAuth()
  const current_user = {
    name: user?.name ?? "Performance Report User",
    username: user?.username ?? user?.role ?? "user",
  };
  const nav_items = data.navMain
    .map((item) => ({
      ...item,
      items: Array.isArray(item.items)
        ? item.items.filter(
            (child_item) =>
              !child_item.menuKey ||
              canAccessMenu(user, child_item.menuKey, child_item.roles),
          )
        : undefined,
    }))
    .filter((item) => {
      if (Array.isArray(item.items)) {
        return item.items.length > 0;
      }

      return !item.menuKey || canAccessMenu(user, item.menuKey, item.roles);
    });
  const home_href = nav_items[0]?.url ?? "/";
  const dashboardku_home_url = String(dashboardkuHomeUrl ?? "").trim();
  const should_show_dashboardku_link =
    user?.auth_source === "dashboardku" && dashboardku_home_url;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-auto data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href={home_href} />}>
              <Image
                src="/apotekku-logo-legal.png"
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
        {should_show_dashboardku_link ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Kembali ke DashboardKU"
                className="h-auto min-h-11 items-center px-3 py-3 text-white/85 hover:bg-white/10 hover:text-white"
                render={
                  <a
                    href={dashboardku_home_url}
                    rel="noreferrer"
                  />
                }
              >
                <ArrowLeftIcon />
                <span className="min-w-0 whitespace-normal break-words leading-snug">
                  Kembali ke DashboardKU
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
        <NavUser user={current_user} />
      </SidebarFooter>
    </Sidebar>
  );
}
