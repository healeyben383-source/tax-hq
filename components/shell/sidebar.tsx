"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const primary: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/providers", label: "Providers" },
  { href: "/expenses", label: "Expenses" },
  { href: "/documents", label: "Documents" },
  { href: "/recurring", label: "Recurring" },
  { href: "/checklist", label: "Monthly checklist" },
];

const secondary: NavItem[] = [
  { href: "/secure-records", label: "Secure records" },
  { href: "/audit-log", label: "Audit log" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-sm font-semibold tracking-tight text-foreground">
          Tax HQ
        </div>
        <div className="text-xs text-subtle mt-0.5">Private admin console</div>
      </div>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-6">
        <NavGroup items={primary} pathname={pathname} />
        <NavGroup items={secondary} pathname={pathname} label="System" />
      </nav>
      <div className="px-5 py-4 border-t border-border text-[11px] text-subtle leading-relaxed">
        Internal tool. Not for external sharing.
      </div>
    </aside>
  );
}

function NavGroup({
  items,
  pathname,
  label,
}: {
  items: NavItem[];
  pathname: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {label ? (
        <div className="px-3 mb-1 text-[10px] font-medium uppercase tracking-wider text-subtle">
          {label}
        </div>
      ) : null}
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              active
                ? "bg-slate-100 text-foreground font-medium"
                : "text-muted hover:bg-slate-50 hover:text-foreground",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
