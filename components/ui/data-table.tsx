import type { ReactNode } from "react";

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="text-left text-[11px] font-medium text-subtle uppercase tracking-wide">
      {children}
    </thead>
  );
}

export function TH({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-5 py-2.5 font-medium border-b border-border ${className}`}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TR({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const base = "hover:bg-slate-50/60";
  return (
    <tr className={className ? `${base} ${className}` : base}>{children}</tr>
  );
}

export function TD({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-5 py-3 align-middle text-foreground ${className}`}>
      {children}
    </td>
  );
}

export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-5 py-10 text-center text-sm text-subtle"
      >
        {children}
      </td>
    </tr>
  );
}
