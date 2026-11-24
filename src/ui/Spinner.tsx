import { LoaderCircle } from "lucide-react";

export function Spinner({ className = "" }: { className?: string }) {
  return <LoaderCircle aria-hidden className={`animate-spin ${className}`} />;
}

export function FullScreenLoader({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="grid h-full min-h-dvh place-items-center bg-ink-900 text-fog-300"
    >
      <div className="flex items-center gap-3">
        <Spinner className="h-5 w-5 text-heat-yellow" />
        <span>{label}</span>
      </div>
    </div>
  );
}
