import type { ComponentProps, ReactNode } from "react";

type FieldProps = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
};

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-fog-300">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-heat-pink">
          {error}
        </p>
      ) : hint ? (
        <div className="mt-1.5 text-xs text-fog-500">{hint}</div>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={[
        "h-12 w-full border border-transparent bg-ink-700 px-4 text-fog-100",
        "placeholder:text-fog-500 outline-none transition",
        "focus:border-heat-yellow aria-[invalid=true]:border-heat-pink",
        className,
      ].join(" ")}
    />
  );
}
