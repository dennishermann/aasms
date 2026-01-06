"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText,
  Settings,
  BarChart3,
  CheckSquare,
  Home
} from "lucide-react";

interface SidebarProps {
  studyId?: string;
}

export function Sidebar({ studyId }: SidebarProps) {
  const pathname = usePathname();

  if (!studyId) return null;

  const navigation = [
    {
      name: "Overview",
      href: `/studies/${studyId}`,
      icon: Home,
      current: pathname === `/studies/${studyId}`,
    },
    {
      name: "Parameters",
      href: `/studies/${studyId}/parameters`,
      icon: Settings,
      current: pathname === `/studies/${studyId}/parameters`,
    },
    {
      name: "Sources",
      href: `/studies/${studyId}/sources`,
      icon: FileText,
      current: pathname === `/studies/${studyId}/sources`,
    },
    {
      name: "Review",
      href: `/studies/${studyId}/review`,
      icon: CheckSquare,
      current: pathname === `/studies/${studyId}/review`,
    },
    {
      name: "Dashboard",
      href: `/studies/${studyId}/dashboard`,
      icon: BarChart3,
      current: pathname === `/studies/${studyId}/dashboard`,
    },
  ];

  return (
    <aside className="w-64 border-r bg-background flex flex-col overflow-y-auto">
      <nav className="flex flex-col gap-1 p-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                item.current
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

