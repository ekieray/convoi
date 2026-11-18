import { LatLngPoint } from '../utils/geo';

export interface TomTomRouteResult {
  distanceMeters: number;
  durationMillis: number;
  trafficDelaySeconds: number;
  path: LatLngPoint[];
}

export interface TomTomPlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export function getTomTomTileUrl(
  layer: 'basic' | 'sat' | 'labels' | 'traffic',
  style: 'main' | 'night' | 'relative0' = 'main'
): string {
  return `/api/tomtom/tile/${layer}/${style}/{z}/{x}/{y}`;
}

export async function fetchTomTomRoute(
  waypoints: Array<{ latitude: number; longitude: number }>,
  travelMode: 'motorcycle' | 'car' = 'motorcycle'
): Promise<TomTomRouteResult | null> {
  if (waypoints.length < 2) return null;

  // Limit intermediate waypoints to max 8 points so URL stays concise & fast
  const sampled =
    waypoints.length <= 8
      ? waypoints
      : [
          waypoints[0],
          ...waypoints
            .slice(1, -1)
            .filter((_, idx) => idx % Math.ceil((waypoints.length - 2) / 6) === 0)
            .slice(0, 6),
          waypoints[waypoints.length - 1],
        ];

  const pointsParam = sampled
    .map((pt) => `${pt.latitude.toFixed(6)},${pt.longitude.toFixed(6)}`)
    .join(':');

  const res = await fetch(
    `/api/tomtom/route?points=${encodeURIComponent(pointsParam)}&travelMode=${travelMode}`
  );

  if (res.status === 429) {
    window.dispatchEvent(new CustomEvent('tomtom-quota-exceeded'));
    return null;
  }

  if (!res.ok) return null;
  const data = (await res.json()) as Partial<TomTomRouteResult>;
  if (!Array.isArray(data.path) || data.path.length === 0) return null;

  return {
    distanceMeters: Number(data.distanceMeters ?? 0),
    durationMillis: Number(data.durationMillis ?? 0),
    trafficDelaySeconds: Number(data.trafficDelaySeconds ?? 0),
    path: data.path,
  };
}

export async function searchTomTomPlaces(
  query: string
): Promise<TomTomPlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const res = await fetch(
      `/api/tomtom/search?q=${encodeURIComponent(trimmed)}`
    );
    if (res.status === 429) {
      window.dispatchEvent(new CustomEvent('tomtom-quota-exceeded'));
      return [];
    }
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: TomTomPlaceResult[] };
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

export async function reverseGeocodeTomTom(
  lat: number,
  lng: number
): Promise<{ name: string; address: string }> {
  try {
    const res = await fetch(
      `/api/tomtom/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    );
    if (!res.ok) {
      return {
        name: `Titik Peta (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
        address: `Koordinat GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
    }
    const data = (await res.json()) as { name?: string; address?: string };
    return {
      name: data.name || `Titik Peta (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
      address: data.address || `Koordinat GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  } catch {
    return {
      name: `Titik Peta (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
      address: `Koordinat GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  }
}
