import { TN_DISTRICTS } from "@/lib/tn";

// Stylised Tamil Nadu reference panel built only from district headquarters
// coordinates. No boundary geometry is bundled, so this is drawn as reference
// points plus nearest-neighbour links, never as district outlines.
const W = 360;
const H = 480;
const PAD = 26;

const lats = TN_DISTRICTS.map((d) => d.lat);
const lngs = TN_DISTRICTS.map((d) => d.lng);
const minLat = Math.min(...lats);
const maxLat = Math.max(...lats);
const minLng = Math.min(...lngs);
const maxLng = Math.max(...lngs);

const project = (d) => ({
  x: PAD + ((d.lng - minLng) / (maxLng - minLng)) * (W - PAD * 2),
  y: PAD + ((maxLat - d.lat) / (maxLat - minLat)) * (H - PAD * 2),
});

const points = TN_DISTRICTS.map((d) => ({ d, ...project(d) }));

// Nearest-neighbour reference links (deterministic, computed from coordinates).
const links = [];
points.forEach((a) => {
  const nearest = points
    .filter((b) => b.d.id !== a.d.id)
    .map((b) => ({ b, dist: Math.hypot(a.x - b.x, a.y - b.y) }))
    .sort((m, n) => m.dist - n.dist)
    .slice(0, 2);
  nearest.forEach(({ b }) => {
    const key = [a.d.id, b.d.id].sort().join("-");
    if (!links.some((l) => l.key === key)) links.push({ key, from: a, to: b });
  });
});

const LABELLED = ["chennai", "coimbatore", "madurai", "tiruchirappalli", "salem", "tirunelveli"];
const labelled = points.filter((p) => LABELLED.includes(p.d.id));

// Reference corridor used by the demonstration routing network (Chennai–Madurai).
const CORRIDOR = ["chennai", "chengalpattu", "viluppuram", "perambalur", "tiruchirappalli", "dindigul", "madurai"];
const corridorPoints = CORRIDOR.map((id) => points.find((p) => p.d.id === id)).filter(Boolean);
const corridorPath = corridorPoints.map((p) => `${p.x},${p.y}`).join(" ");

export default function TNPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Tamil Nadu district reference points">
        <defs>
          <radialGradient id="haze" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.16)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0)" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#haze)" />
        {Array.from({ length: 18 }).map((_, i) => (
          <line key={"h" + i} x1="0" y1={i * 28} x2={W} y2={i * 28} stroke="hsl(var(--border) / 0.5)" strokeWidth="0.6" />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={"v" + i} x1={i * 28} y1="0" x2={i * 28} y2={H} stroke="hsl(var(--border) / 0.5)" strokeWidth="0.6" />
        ))}

        {links.map((l) => (
          <line
            key={l.key}
            x1={l.from.x}
            y1={l.from.y}
            x2={l.to.x}
            y2={l.to.y}
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
        ))}

        <polyline points={corridorPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.6" strokeDasharray="6 6" className="dash-run" />

        {points.map((p) => (
          <g key={p.d.id}>
            <circle cx={p.x} cy={p.y} r="6.5" fill="hsl(var(--primary) / 0.12)" />
            <circle cx={p.x} cy={p.y} r="2.4" fill="hsl(var(--primary))" />
          </g>
        ))}

        {labelled.map((p) => (
          <text
            key={"lbl" + p.d.id}
            x={p.x + 8}
            y={p.y + 3.5}
            fill="hsl(var(--muted-foreground))"
            fontSize="9.5"
            fontFamily="var(--font-mono)"
          >
            {p.d.name}
          </text>
        ))}

        <rect x="0" y="0" width={W} height="26" fill="hsl(var(--primary) / 0.10)" className="sweep" />
      </svg>

      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
        <span>38 district reference points</span>
        <span>·</span>
        <span>dashed line: demonstration corridor</span>
        <span>·</span>
        <span>no boundary geometry bundled</span>
      </div>
    </div>
  );
}