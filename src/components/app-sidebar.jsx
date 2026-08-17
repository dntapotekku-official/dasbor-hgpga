"use client"

import Image from "next/image"
import Link from "next/link"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
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
  DumbbellIcon,
  GraduationCapIcon,
  IdCardIcon,
  LayoutDashboardIcon,
  Settings2Icon,
} from "lucide-react"

const data = {
  user: {
    name: "Admin HGPGA",
    email: "admin",
  },
  navMain: [
    {
      title: "Dasbor",
      url: "/",
      icon: (
        <LayoutDashboardIcon />
      ),
    },
    {
      title: "Kepuasan Internal",
      url: "/kepuasan-internal",
      icon: (
        <ChartBarIcon />
      ),
    },
    {
      title: "Kepatuhan SOP CCTV",
      url: "/kepatuhan-sop-cctv",
      icon: (
        <CctvIcon />
      ),
    },
    {
      title: "Gofitku",
      url: "/gofitku",
      icon: (
        <DumbbellIcon />
      ),
    },
    {
      title: "Nilai Transaksi",
      url: "/nilai-transaksi",
      icon: (
        <BadgeDollarSignIcon />
      ),
    },
    {
      title: "Nilai Magang",
      url: "/nilai-magang",
      icon: (
        <GraduationCapIcon />
      ),
    },
    {
      title: "Atribut InsanKu",
      url: "/atribut-insanku",
      icon: (
        <IdCardIcon />
      ),
    },
    {
      title: "Pengaturan",
      url: "/pengaturan",
      icon: (
        <Settings2Icon />
      ),
    },
  ],
}
export function AppSidebar({
  ...props
}) {
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
                alt="HGPGA"
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
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
