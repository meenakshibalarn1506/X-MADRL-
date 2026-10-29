import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, MapPin, Loader2, Locate, X } from "lucide-react";
import { searchPlaces, geocodePlaces } from "@/lib/server-fns";

/**
 * Search by district, city, locality, address or landmark. Uses real
 * OpenStreetMap geocoding (Nominatim) via a server-side proxy, falling back to
 * the bundled Tamil Nadu reference index if the geocoder is unavailable.
 */
export default function PlaceSearch({
  label,
  value,
  onSelect,
  district = "all",
  placeholder = "Search a district, city or locality",
  showCurrentLocation = false,
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const boxRef = useRef(null);
  const geocodeFn = useServerFn(geocodePlaces);

  const trimmed = q.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["geocode", trimmed],
    queryFn: () => geocodeFn({ data: { q: trimmed, limit: 8 } }),
    enabled: trimmed.length >= 2,
    staleTime: 60000,
  });

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (place) => {
    onSelect({
      label: place.full_name ? place.full_name.split(",").slice(0, 2).join(",") : place.name,
      lat: place.lat,
      lng: place.lng,
      district: place.district,
      place_type: place.place_type,
    });
    setQ("");
    setOpen(false);
  };

  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("This device does not expose a location sensor to the browser.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onSelect({
          label: "My current location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — search for a place instead."
            : "Position unavailable. Search for a place instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  return (
    <div ref={boxRef} className="relative">
      <label className="label-xs">{label}</label>

      {value ? (
        <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-surface-1 px-2.5 py-2">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px]">{value.label}</span>
            <span className="mono block text-[10.5px] text-muted-foreground">
              {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
              {value.accuracy ? ` · ±${Math.round(value.accuracy)} m` : ""}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-2 rounded-md border border-input bg-surface-1 px-2.5 focus-within:border-primary">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="h-8 w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {showCurrentLocation && (
            <button
              type="button"
              onClick={useCurrentLocation}
              className="rounded p-1 text-muted-foreground transition-colors hover:text-primary"
              aria-label="Use my current location"
              title="Use my current location"
            >
              {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Locate className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      )}

      {open && !value && trimmed.length >= 2 && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
          {(data?.results ?? []).length === 0 && !isFetching && (
            <li className="px-2.5 py-2 text-[12px] text-muted-foreground">
              No place matches “{trimmed}”. Try a district, city, or locality name.
            </li>
          )}
          {(data?.results ?? []).map((p, i) => (
            <li key={p.id ?? `${p.lat}-${p.lng}-${i}`}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="flex w-full flex-col items-start rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <span className="text-[13px]">{p.name}</span>
                <span className="mono text-[10.5px] text-muted-foreground">
                  {p.place_type?.replace(/_/g, " ")} · {p.district ?? "Tamil Nadu"}
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-border px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
            {data?.source === "openstreetmap_nominatim"
              ? "geocoded via OpenStreetMap Nominatim"
              : "index: bundled Tamil Nadu reference places"}
          </li>
        </ul>
      )}

      {geoError && <p className="mt-1.5 text-[11px] text-risk-caution">{geoError}</p>}
    </div>
  );
}