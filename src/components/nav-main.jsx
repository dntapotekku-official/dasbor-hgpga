"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavMain({ items }) {
  const pathname = usePathname();

  const is_active_item = (url) => {
    if (url === "/") {
      return pathname === url;
    }

    return pathname === url || pathname.startsWith(`${url}/`);
  };

  const [openSections, setOpenSections] = useState({});

  const is_active_group = (item) => {
    if (!Array.isArray(item.items) || item.items.length === 0) {
      return is_active_item(item.url);
    }

    return item.items.some((child_item) => is_active_item(child_item.url));
  };

  const is_open_group = (item) => {
    if (!Array.isArray(item.items) || item.items.length === 0) {
      return false;
    }

    if (Object.hasOwn(openSections, item.title)) {
      return openSections[item.title];
    }

    return is_active_group(item);
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-3 px-2">
        <SidebarMenu className="gap-2">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {Array.isArray(item.items) && item.items.length > 0 ? (
                <div className="space-y-2">
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={is_active_group(item)}
                    className="h-11 px-3 text-white/85 hover:bg-white/10 hover:text-white data-active:bg-white/14 data-active:text-white data-active:font-medium"
                    onClick={() =>
                      setOpenSections((current) => ({
                        ...current,
                        [item.title]: !is_open_group(item),
                      }))
                    }
                  >
                    {item.icon}
                    <span>{item.title}</span>
                    <ChevronDownIcon
                      className={`ml-auto transition-transform ${
                        is_open_group(item) ? "rotate-180" : ""
                      }`}
                    />
                  </SidebarMenuButton>
                  {is_open_group(item) ? (
                    <SidebarMenu className="gap-1 pl-6">
                      {item.items.map((child_item) => (
                        <SidebarMenuItem key={child_item.title}>
                          <SidebarMenuButton
                            tooltip={child_item.title}
                            isActive={is_active_item(child_item.url)}
                            className="h-10 px-3 text-white/75 hover:bg-white/10 hover:text-white data-active:bg-white/14 data-active:text-white data-active:font-medium"
                            render={<Link href={child_item.url} />}
                          >
                            <span>{child_item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  ) : null}
                </div>
              ) : (
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={is_active_item(item.url)}
                  className="h-11 px-3 text-white/85 hover:bg-white/10 hover:text-white data-active:bg-white/14 data-active:text-white data-active:font-medium"
                  render={<Link href={item.url} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
