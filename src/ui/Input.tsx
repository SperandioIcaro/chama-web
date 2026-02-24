import React from "react";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3",
        "text-zinc-100 placeholder:text-zinc-500",
        "outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10",
        props.className ?? "",
      ].join(" ")}
    />
  );
}
