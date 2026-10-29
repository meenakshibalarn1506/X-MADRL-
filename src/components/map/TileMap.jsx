import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Locate, Maximize2, Loader2, Layers, Map as MapIcon } from "lucide-react";
import { TN_BOUNDS, TN_CENTER } from "@/lib/tn";
import { clamp, fromWorldPx, metersPerPixel, worldPx, TILE_SIZE } from "@/lib/geo";

const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

const INDIA_CENTER = { lat: 22.5, lng: 80 };

const TILE_SOURCES = {
  dark: {
    label: "Dark",
    build: (z, x, y) => `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
    attribution: "© OpenStreetMap contributors · © CARTO",
    filter: "none",
  },
  street: {
    label: "Street",
    build: (z, x, y) => `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
    attribution: "© OpenStreetMap contributors · © CARTO",
    filter: "none",
  },
  satellite: {
    label: "Satellite",
    build: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    attribution: "© Esri, Maxar, Earthstar Geographics",
    filter: "none",
  },
};

const TONE_CLASS = {
  low: "border-risk-low text-risk-low bg-risk-low/20",
  caution: "border-risk-caution text-risk-caution bg-risk-caution/20",
  elevated: "border-risk-elevated text-risk-elevated bg-risk-elevated/20",
  severe: "border-risk-severe text-risk-severe bg-risk-severe/20",
  unknown: "border-risk-unknown text-risk-unknown bg-risk-unknown/20",
  primary: "border-primary text-primary bg-primary/20",
};

const DOT_CLASS = {
  low: "bg-risk-low",
  caution: "bg-risk-caution",
  elevated: "bg-risk-elevated",
  severe: "bg-risk-severe",
  unknown: "bg-risk-unknown",
  primary: "bg-primary",
};

export default function TileMap({
  center = TN_CENTER,
  zoom = 7,
  markers = [],
  routes = [],
  circles = [],
  places = [],
  onMapClick,
  onLocated,
  onViewChange,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
  className = "",
  showControls = true,
  interactive = true,
  ariaLabel = "Tamil Nadu map",
}) {
  const wrapRef = useRef(null);
  const pointerRef = useRef(new Map());
  const modeRef = useRef(null);
  const startRef = useRef(null);
  const movedRef = useRef(0);

  const [size, setSize] = useState({ w: 900, h: 560 });
  const [view, setView] = useState({ lat: center.lat, lng: center.lng, zoom });
  const [dragging, setDragging] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const [tileStyle, setTileStyle] = useState("dark");

  const tileSource = TILE_SOURCES[tileStyle] ?? TILE_SOURCES.dark;

  useEffect(() => {
    setView((v) => (v.lat === center.lat && v.lng === center.lng ? v : { ...v, lat: center.lat, lng: center.lng }));
  }, [center.lat, center.lng]);

  useEffect(() => {
    setView((v) => (v.zoom === zoom ? v : { ...v, zoom }));
  }, [zoom]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setSize({ w: rect.width, h: rect.height });
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom needs a non-passive listener.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !interactive) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      setView((v) => ({ ...v, zoom: clamp(v.zoom + dir, minZoom, maxZoom) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive, minZoom, maxZoom]);

  const centerPx = useMemo(() => worldPx(view.lat, view.lng, view.zoom), [view.lat, view.lng, view.zoom]);
  const origin = { x: centerPx.x - size.w / 2, y: centerPx.y - size.h / 2 };
  const mpp = metersPerPixel(view.lat, view.zoom);

  const toScreen = (lat, lng) => {
    const p = worldPx(lat, lng, view.zoom);
    return { x: p.x - origin.x, y: p.y - origin.y };
  };

  useEffect(() => {
    onViewChange?.({ lat: view.lat, lng: view.lng, zoom: view.zoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.lat, view.lng, view.zoom]);

  const tiles = useMemo(() => {
    const z = view.zoom;
    const count = 2 ** z;
    const x0 = Math.floor(origin.x / TILE_SIZE);
    const x1 = Math.floor((origin.x + size.w) / TILE_SIZE);
    const y0 = Math.max(0, Math.floor(origin.y / TILE_SIZE));
    const y1 = Math.min(count - 1, Math.floor((origin.y + size.h) / TILE_SIZE));
    const out = [];
    for (let x = x0; x <= x1; x += 1) {
      const xw = ((x % count) + count) % count;
      for (let y = y0; y <= y1; y += 1) {
        out.push({
          key: `${tileStyle}/${z}/${x}/${y}`,
          url: tileSource.build(z, xw, y),
          left: x * TILE_SIZE - origin.x,
          top: y * TILE_SIZE - origin.y,
        });
      }
    }
    return out;
  }, [origin.x, origin.y, size.w, size.h, view.zoom, tileStyle, tileSource]);

  const handleDown = (e) => {
    if (!interactive) return;
    pointerRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture unsupported */
    }
    if (pointerRef.current.size >= 2) {
      const [a, b] = [...pointerRef.current.values()];
      modeRef.current = "pinch";
      startRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
    } else {
      modeRef.current = "pan";
      startRef.current = { x: e.clientX, y: e.clientY };
      movedRef.current = 0;
      setDragging(true);
    }
  };

  const handleMove = (e) => {
    if (!interactive || !pointerRef.current.has(e.pointerId)) return;
    const prev = pointerRef.current.get(e.pointerId);
    pointerRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (modeRef.current === "pinch" && pointerRef.current.size >= 2) {
      const [a, b] = [...pointerRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const s = startRef.current;
      if (!s || s.dist <= 0) return;
      const next = clamp(Math.round(s.zoom + Math.log2(dist / s.dist)), minZoom, maxZoom);
      setView((v) => (v.zoom === next ? v : { ...v, zoom: next }));
      return;
    }

    if (modeRef.current === "pan") {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      movedRef.current += Math.abs(dx) + Math.abs(dy);
      const p = worldPx(view.lat, view.lng, view.zoom);
      const next = fromWorldPx(p.x - dx, p.y - dy, view.zoom);
      setView((v) => ({ ...v, lat: next.lat, lng: next.lng }));
    }
  };

  const handleUp = (e) => {
    if (!interactive) return;
    pointerRef.current.delete(e.pointerId);
    if (pointerRef.current.size === 0) {
      if (modeRef.current === "pan" && movedRef.current < 4 && onMapClick && wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        const p = { x: origin.x + (e.clientX - rect.left), y: origin.y + (e.clientY - rect.top) };
        onMapClick(fromWorldPx(p.x, p.y, view.zoom));
      }
      modeRef.current = null;
      setDragging(false);
    } else if (pointerRef.current.size === 1) {
      modeRef.current = "pan";
      movedRef.current = 0;
    }
  };

  const resetToTn = () => setView({ lat: TN_CENTER.lat, lng: TN_CENTER.lng, zoom: 7 });
  const resetToIndia = () => setView({ lat: INDIA_CENTER.lat, lng: INDIA_CENTER.lng, zoom: 5 });
  const cycleTileStyle = () => {
    const keys = Object.keys(TILE_SOURCES);
    const idx = keys.indexOf(tileStyle);
    setTileStyle(keys[(idx + 1) % keys.length]);
  };

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("This device does not expose a location sensor to the browser.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocating(false);
        setView((v) => ({ ...v, lat: latitude, lng: longitude, zoom: Math.max(v.zoom, 12) }));
        onLocated?.({ lat: latitude, lng: longitude, accuracy, timestamp: pos.timestamp });
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. The map keeps working without it."
            : "Your position could not be determined right now.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  };

  const outsideTn =
    view.lat < TN_BOUNDS.south - 2 ||
    view.lat > TN_BOUNDS.north + 2 ||
    view.lng < TN_BOUNDS.west - 2 ||
    view.lng > TN_BOUNDS.east + 2;

  return (
    <div
      ref={wrapRef}
      role="application"
      aria-label={ariaLabel}
      className={
        "relative overflow-hidden rounded-xl border border-border bg-surface-1 " +
        (dragging ? "cursor-grabbing " : "cursor-grab ") +
        className
      }
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <div className="absolute inset-0 z-0">
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.url}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
            className="pointer-events-none absolute select-none"
            style={{
              left: t.left,
              top: t.top,
              width: TILE_SIZE,
              height: TILE_SIZE,
              filter: tileSource.filter,
            }}
          />
        ))}
      </div>

      <svg className="pointer-events-none absolute inset-0 z-20" width={size.w} height={size.h} aria-hidden="true">
        {circles.map((c, i) => {
          const s = toScreen(c.lat, c.lng);
          const r = ((c.radiusKm ?? 1) * 1000) / mpp;
          return (
            <g key={c.id ?? `c${i}`}>
              <circle cx={s.x} cy={s.y} r={r} fill={c.fill ?? "currentColor"} className={c.className ?? "text-risk-elevated/20"} />
              <circle
                cx={s.x}
                cy={s.y}
                r={r}
                fill="none"
                strokeWidth="1.2"
                strokeDasharray="4 4"
                className={c.strokeClassName ?? "stroke-risk-elevated/60"}
              />
            </g>
          );
        })}
        {routes.map((r, i) => (
          <polyline
            key={r.id ?? `r${i}`}
            points={r.points.map((p) => {
              const s = toScreen(p.lat, p.lng);
              return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
            }).join(" ")}
            fill="none"
            strokeWidth={r.width ?? 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={r.dashed ? "stroke-current [stroke-dasharray:8_8]" : "stroke-current"}
            style={{ color: r.color, opacity: r.dimmed ? 0.45 : 0.95 }}
          />
        ))}
      </svg>

      <div className="absolute inset-0 z-30">
        {markers.map((m) => {
          const s = toScreen(m.lat, m.lng);
          if (s.x < -80 || s.y < -80 || s.x > size.w + 80 || s.y > size.h + 80) return null;
          const tone = m.tone ?? "primary";
          return (
            <button
              key={m.id}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                m.onClick?.();
              }}
              style={{ left: s.x, top: s.y }}
              className="absolute -translate-x-1/2 -translate-y-1/2 outline-none"
              title={m.label}
            >
              {m.pulse && (
                <span
                  className={
                    "absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full ring-pulse " +
                    (DOT_CLASS[tone] ?? DOT_CLASS.primary)
                  }
                  aria-hidden="true"
                />
              )}
              <span
                className={
                  "relative flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-lg " +
                  (m.selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background " : "") +
                  (TONE_CLASS[tone] ?? TONE_CLASS.primary)
                }
              >
                {m.Icon ? <m.Icon className="h-3 w-3" /> : <span className={"h-1.5 w-1.5 rounded-full " + (DOT_CLASS[tone] ?? DOT_CLASS.primary)} />}
              </span>
              {m.label && (
                <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                  {m.label}
                </span>
              )}
            </button>
          );
        })}

        {places.map((p) => {
          const s = toScreen(p.lat, p.lng);
          if (s.x < -60 || s.y < -60 || s.x > size.w + 60 || s.y > size.h + 60) return null;
          return (
            <span
              key={p.id}
              style={{ left: s.x, top: s.y }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] text-muted-foreground"
            >
              {p.name}
            </span>
          );
        })}
      </div>

      {showControls && (
        <div className="absolute right-3 top-3 z-40 flex flex-col gap-2">
          <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-background/90 backdrop-blur">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom + 1, minZoom, maxZoom) }))}
              className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-2 hover:text-primary"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="h-px w-full bg-border" />
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setView((v) => ({ ...v, zoom: clamp(v.zoom - 1, minZoom, maxZoom) }))}
              className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-surface-2 hover:text-primary"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={resetToTn}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
            aria-label="Reset to Tamil Nadu"
            title="Reset to Tamil Nadu"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={resetToIndia}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
            aria-label="Zoom out to India"
            title="Zoom out to India"
          >
            <MapIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={cycleTileStyle}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
            aria-label={`Switch map style (current: ${tileSource.label})`}
            title={`Map style: ${tileSource.label}`}
          >
            <Layers className="h-4 w-4" />
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={locate}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/90 text-muted-foreground backdrop-blur transition-colors hover:text-primary"
            aria-label="Use my current location"
            title="Use my current location"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
          </button>
        </div>
      )}

      {locError && (
        <div className="absolute bottom-3 left-3 right-3 z-40 rounded-lg border border-risk-caution/40 bg-background/95 px-3 py-2 text-[11px] text-risk-caution">
          {locError}
        </div>
      )}

      {outsideTn && (
        <div className="absolute left-3 top-3 z-40 rounded-lg border border-border bg-background/90 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
          Outside Tamil Nadu — the hazard layers cover Tamil Nadu districts only.
        </div>
      )}

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-t from-background/90 to-transparent px-3 py-2 font-mono text-[10px] text-muted-foreground">
        <span>{tileSource.attribution}</span>
        <span>
          {view.lat.toFixed(3)}, {view.lng.toFixed(3)} · z{view.zoom} · {tileSource.label}
        </span>
      </div>
    </div>
  );
}