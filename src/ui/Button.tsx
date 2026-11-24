import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./Spinner";

type Variant = "yellow" | "pink" | "ghost" | "dark";
type Size = "sm" | "md";

type Props = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

const variants: Record<Variant, string> = {
  yellow: "bg-heat-yellow text-ink-950",
  pink: "bg-heat-pink text-white",
  dark: "bg-ink-700 text-fog-100",
  ghost: "border border-ink-600 bg-transparent text-fog-100 hover:bg-ink-800",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-12 px-8 text-sm",
};

/** Botão no estilo Heat: reto, caixa-alta e em negrito. */
export function Button({
  variant = "yellow",
  size = "md",
  loading = false,
  icon,
  className = "",
  children,
  disabled,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-3 font-bold uppercase tracking-wide",
        "transition enabled:hover:brightness-90 enabled:active:scale-[0.99]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      ].join(" ")}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
}
