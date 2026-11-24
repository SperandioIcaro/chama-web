export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden>
        <defs>
          <linearGradient id="chama-flame" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ff008e" />
            <stop offset="1" stopColor="#ffcd1e" />
          </linearGradient>
        </defs>
        <path
          fill="url(#chama-flame)"
          d="M33.5 7c1 7.5-3.2 11.6-7 15.8C23 26.7 20 30.5 20 36.6 20 44.5 25.3 50 32 50s12-5.5 12-13.2c0-4.6-1.9-8.2-4.5-11.1-.6 3-2 5-4 6.1.9-7.7-.9-15.6-2-24.8z"
        />
      </svg>
      <span className="text-heat-gradient text-2xl font-black uppercase leading-none tracking-tight">
        chama
      </span>
    </span>
  );
}
