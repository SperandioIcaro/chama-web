import type { ComponentProps } from "react";

/** Superfície padrão (cartão) do tema. */
export function Panel({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`bg-ink-850 ${className}`} />;
}
