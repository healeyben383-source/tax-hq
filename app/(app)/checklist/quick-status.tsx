"use client";

import { updateMonthlyTaskStatusAction } from "./actions";

// Three submit buttons sharing one form: each <button> sets its own
// name="status" value="..." pair, so only the clicked button's status
// reaches the server. The currently-active status button is disabled.
export function QuickStatus({
  id,
  current,
}: {
  id: string;
  current: string;
}) {
  return (
    <form
      action={updateMonthlyTaskStatusAction}
      className="inline-flex items-center gap-2 text-xs"
    >
      <input type="hidden" name="id" value={id} />
      <StatusButton value="todo" current={current} label="Mark todo" />
      <span className="text-subtle">·</span>
      <StatusButton
        value="in-progress"
        current={current}
        label="Mark in progress"
      />
      <span className="text-subtle">·</span>
      <StatusButton value="done" current={current} label="Mark done" />
    </form>
  );
}

function StatusButton({
  value,
  current,
  label,
}: {
  value: string;
  current: string;
  label: string;
}) {
  const active = value === current;
  return (
    <button
      type="submit"
      name="status"
      value={value}
      disabled={active}
      className={
        active
          ? "text-foreground/40 cursor-default"
          : "text-muted hover:text-foreground"
      }
    >
      {label}
    </button>
  );
}
