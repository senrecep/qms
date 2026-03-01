"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  BookCheck,
  BookOpenText,
  Building2,
  Settings,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth/client";

const mainNavItems = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "documents", href: "/documents", icon: FileText },
  { key: "approvals", href: "/approvals", icon: CheckSquare },
  { key: "readTasks", href: "/read-tasks", icon: BookCheck },
  { key: "guide", href: "/guide", icon: BookOpenText },
  { key: "departments", href: "/departments", icon: Building2 },
];

const adminNavItems = [
  { key: "users", href: "/users", icon: Users },
  { key: "settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { data: session } = authClient.useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileText className="size-4" />
          </div>
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
            DMS
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={t(item.key)}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{t(item.key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {userRole === "ADMIN" && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("administration")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={t(item.key)}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{t(item.key)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
