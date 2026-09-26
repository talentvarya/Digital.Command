"use client";

import { useEffect, useRef } from "react";

// Clears the form it sits in once an action reports success, so the next
// customer can be typed straight in. Pass something that changes on each success
// (the confirmation message).
export function ResetFormOnSuccess({ when }: { when: string | undefined }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (when) ref.current?.closest("form")?.reset();
  }, [when]);
  return <span ref={ref} hidden />;
}
