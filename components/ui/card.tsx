import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-xs text-subtle mt-0.5">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-subtle uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground tabular-nums">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-subtle">{hint}</div> : null}
    </div>
  );
}
