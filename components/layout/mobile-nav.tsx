"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationItems } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
      {navigationItems.map((item) => {
        const isActive =
          item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

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
