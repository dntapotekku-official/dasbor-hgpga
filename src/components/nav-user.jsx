"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { EllipsisVerticalIcon, LogOutIcon } from "lucide-react"

export function NavUser({
  user
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()

  const logoutHandler = async () => {
    try {
      const response = await fetch("/api/auth", {
        method: "DELETE",
      })
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Logout gagal.")
      }

      toast.success("Berhasil keluar.")
      router.replace("/login")
      router.refresh()
    } catch (error) {
      toast.error(error.message || "Terjadi kesalahan saat logout.")
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="text-white/90 hover:bg-white/10 hover:text-white data-open:bg-white/10 data-open:text-white"
              />
            }>
            <Avatar className="size-8 rounded-lg border border-white/15">
              <AvatarFallback className="rounded-lg bg-white/12 text-white">
                HG
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-white/60">
                {user.email}
              </span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4 text-white/70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}>
            <div className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                    HG
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logoutHandler}>
              <LogOutIcon />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
