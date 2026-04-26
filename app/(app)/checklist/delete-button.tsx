"use client";

import { type FormEvent } from "react";
import { deleteMonthlyTaskAction } from "./actions";

// Hidden inputs `redirect_month`/`redirect_year` propagate the current
// view's month/year so the action can return the user to the same period
// they were looking at when they clicked Delete.
export function DeleteTaskButton({
  id,
  redirectMonth,
  redirectYear,
}: {
  id: string;
  redirectMonth?: number;
  redirectYear?: number;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={deleteMonthlyTaskAction}
      onSubmit={handleSubmit}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      {redirectMonth !== undefined && redirectYear !== undefined ? (
        <>
          <input type="hidden" name="redirect_month" value={redirectMonth} />
          <input type="hidden" name="redirect_year" value={redirectYear} />
        </>
      ) : null}
      <button
        type="submit"
        className="text-sm text-red-700 hover:text-red-900 underline-offset-4 hover:underline"
      >
        Delete
      </button>
    </form>
  );
}
