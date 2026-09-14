"use client";

import { useFormState } from "react-dom";
import type { ActionResult } from "@/app/register/actions";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: (state: ActionResult) => React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, {});
  return (
    <form action={formAction} className={className}>
      {children(state)}
    </form>
  );
}
