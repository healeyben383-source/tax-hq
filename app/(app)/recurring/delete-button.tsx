"use client";

import { type FormEvent } from "react";
import { deleteRecurringSubscriptionAction } from "./actions";

export function DeleteRecurringSubscriptionButton({ id }: { id: string }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Are you sure you want to delete this subscription?")) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={deleteRecurringSubscriptionAction}
      onSubmit={handleSubmit}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-sm text-red-700 hover:text-red-900 underline-offset-4 hover:underline"
      >
        Delete
      </button>
    </form>
  );
}
