import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapsConfig } from "@/lib/server-fns";
import TileMap from "./TileMap";
import GoogleMap from "./GoogleMap";

/**
 * Renders Google Maps when the GOOGLE_MAPS_API_KEY secret is configured,
 * and falls back to the existing OpenStreetMap TileMap when it is not.
 * This preserves the existing dashboard and route-planning features
 * without replacing them.
 */
export default function SmartMap(props) {
  const configFn = useServerFn(getMapsConfig);
  const { data } = useQuery({
    queryKey: ["maps-config"],
    queryFn: () => configFn({ data: {} }),
    staleTime: 600000,
  });

  if (data?.configured && data?.apiKey) {
    return <GoogleMap {...props} apiKey={data.apiKey} />;
  }
  return <TileMap {...props} />;
}