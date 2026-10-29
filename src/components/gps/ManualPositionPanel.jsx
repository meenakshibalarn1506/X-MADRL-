import { useState } from "react";
import { MapPin, Search, X, Crosshair } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { geocodePlaces } from "@/lib/server-fns";

/**
 * Manual position selection. Lets the user click the map, search a place, or
 * enter coordinates to establish a non-GPS reference point. The position is
 * always labelled "Manually Selected" — never presented as GPS-confirmed.
 */
export default function ManualPositionPanel({ manual, onMapSelectMode, onClear, onPlaceSelect }) {
  const [query, setQuery] = useState("");
  const geocodeFn = useServerFn(geocodePlaces);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await geocodeFn({ data: { q: query.trim(), limit: 6 } });
      setResults(res?.results ?? []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-[12px] leading-relaxed text-primary">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Click the map to set a manual reference point. This is <strong>not</strong> a GPS fix — it is a point you chose,
          labelled accordingly.
        </span>
      </div>

      {manual ? (
        <div className="rounded-lg border border-border bg-surface-1/60 p-3">
          <div className="flex items-center justify-between">
            <span className="chip border-primary/40 bg-primary/10 text-primary">
              <MapPin className="h-3 w-3" /> Manually Selected
            </span>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={onClear}>
              <X className="h-3 w-3" /> Clear
            </Button>
          </div>
          <p className="mono mt-2 text-[13px] text-foreground">
            {manual.lat.toFixed(5)}, {manual.lng.toFixed(5)}
          </p>
          {manual.label && <p className="mt-1 text-[11.5px] text-muted-foreground">{manual.label}</p>}
          <p className="mono mt-1 text-[10.5px] text-muted-foreground">
            set at {String(manual.at).slice(11, 19)}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface-1/40 p-4 text-center">
          <p className="text-[12px] text-muted-foreground">No manual position set.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={onMapSelectMode}>
          <Crosshair className="h-3.5 w-3.5" />
          {manual ? "Pick a new point" : "Set position on map"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-2"
          onClick={() => setShowSearch((s) => !s)}
        >
          <Search className="h-3.5 w-3.5" />
          Search a place
        </Button>
      </div>

      {showSearch && (
        <div className="space-y-2 rounded-lg border border-border bg-surface-1/60 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Place, landmark or address"
              value={query}
              maxLength={80}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="h-9 flex-1 rounded-md border border-input bg-surface-2 px-2.5 text-[13px] outline-none focus:border-primary"
            />
            <Button size="sm" onClick={search} disabled={searching}>
              {searching ? "…" : "Find"}
            </Button>
          </div>
          {results.length > 0 && (
            <ul className="max-h-44 space-y-1 overflow-y-auto">
              {results.map((r, i) => (
                <li key={r.id ?? i}>
                  <button
                    type="button"
                    onClick={() => {
                      onPlaceSelect({
                        lat: r.lat,
                        lng: r.lng,
                        label: r.name || r.label || `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`,
                      });
                      setShowSearch(false);
                      setResults([]);
                      setQuery("");
                    }}
                    className="flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[12px] transition-colors hover:border-border hover:bg-surface-2"
                  >
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.name || r.label}</span>
                      <span className="mono block text-[10.5px] text-muted-foreground">
                        {r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.length === 0 && query && !searching && (
            <p className="text-[11px] text-muted-foreground">No matches found. Try a different name.</p>
          )}
        </div>
      )}
    </div>
  );
}