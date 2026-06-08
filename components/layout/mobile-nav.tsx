"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationItems } from "@/lib/mock-data";
import { canAccessNavItem } from "@/lib/mock-auth";
import { cn } from "@/lib/utils";
import type { MockRole } from "@/lib/types";

export function MobileNav({ role }: { role: MockRole }) {
  const pathname = usePathname();
  const visibleNavigationItems = navigationItems.filter((item) => canAccessNavItem(role, item));
  const visibleLinks = visibleNavigationItems.flatMap((item) => {
    const children = item.children?.filter((child) => canAccessNavItem(role, child)) ?? [];
    return children.length > 0 ? children : [item];
  });

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
      {visibleLinks.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === item.href
            : pathname === item.href ||
              (item.href !== "/course-builder" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "whitespace-nowrap rounded-xl border bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-soft",
              isActive && "border-primary bg-primary text-white",
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </div>
  );
}
