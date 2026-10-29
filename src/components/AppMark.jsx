export default function AppMark({ size = 32, withWordmark = true, className = "" }) {
  return (
    <span className={"inline-flex items-center gap-2.5 " + className}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
        <defs>
          <linearGradient id="xmadrl-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="hsl(var(--accent))" />
          </linearGradient>
        </defs>
        <path
          d="M20 2.5 34.5 11v18L20 37.5 5.5 29V11z"
          fill="none"
          stroke="url(#xmadrl-mark)"
          strokeWidth="2"
        />
        <path d="M11 26.5c3.5-2.4 5-9.5 8-11.5s5.5 4.6 9-2" fill="none" stroke="url(#xmadrl-mark)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="19" cy="15" r="2.6" fill="hsl(var(--primary))" />
      </svg>
      {withWordmark && (
        <span className="font-display text-[15px] font-semibold tracking-[0.16em] text-foreground">
          X-MADRL
        </span>
      )}
    </span>
  );
}