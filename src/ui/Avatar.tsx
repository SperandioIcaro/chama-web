type Props = {
  src?: string | null;
  name: string;
  /** diâmetro total em px (inclui o anel) */
  size?: number;
  ring?: boolean;
  className?: string;
};

/** Avatar redondo com anel degradê rosa → amarelo (assinatura do Heat). */
export function Avatar({ src, name, size = 40, ring = true, className = "" }: Props) {
  const border = Math.max(2, Math.round(size / 16));
  const inner = ring ? size - 4 : size;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  const face = src ? (
    <img
      src={src}
      alt={name}
      width={inner}
      height={inner}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="rounded-full bg-ink-700 object-cover"
      style={{ width: inner, height: inner, border: `${border}px solid var(--color-ink-900)` }}
    />
  ) : (
    <span
      role="img"
      aria-label={name}
      className="grid place-items-center rounded-full bg-ink-700 font-bold text-fog-100"
      style={{
        width: inner,
        height: inner,
        fontSize: Math.round(inner * 0.4),
        border: `${border}px solid var(--color-ink-900)`,
        lineHeight: 1,
      }}
    >
      {initial}
    </span>
  );

  if (!ring) return <span className={`inline-block shrink-0 ${className}`}>{face}</span>;
  return <span className={`avatar-ring shrink-0 ${className}`}>{face}</span>;
}
