import React from "react";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "solid" | "ghost";
  },
) {
  const variant = props.variant ?? "solid";

  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-3 font-medium transition active:scale-[0.99] disabled:opacity-50";

  const solid = "bg-white text-zinc-950 hover:bg-zinc-200";

  const ghost =
    "bg-white/0 text-zinc-100 hover:bg-white/10 border border-white/10";

  return (
    <button
      {...props}
      className={[
        base,
        variant === "solid" ? solid : ghost,
        props.className ?? "",
      ].join(" ")}
    />
  );
}
