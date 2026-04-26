import type { ReactNode } from "react";

type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  muted: "bg-slate-50 text-slate-500 border-slate-200",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium leading-5 ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
