import { RoutePoint } from '../types/convoy';

const EARTH_RADIUS_METERS = 6_371_000;

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function computePolylineLengthMeters(points: LatLngPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineMeters(points[i], points[i + 1]);
  }
  return Math.round(total);
}

/**
 * Projects lat/lng onto a local tangent plane around a reference point to compute
 * exact perpendicular distance to the route polyline in real meters + normalized route progress (0..1).
 */
export function evaluatePositionAlongRoute(
  pos: LatLngPoint,
  waypoints: RoutePoint[],
  totalRouteMetersFallback = 12000
): {
  routeProgress: number;
  distanceTraveledMeters: number;
  remainingMeters: number;
  offRouteMeters: number;
} {
  if (waypoints.length < 2) {
    const dest = waypoints[0];
    const dist = dest
      ? haversineMeters(pos, { lat: dest.latitude, lng: dest.longitude })
      : 0;
    return {
      routeProgress: 0,
      distanceTraveledMeters: 0,
      remainingMeters: Math.round(dist),
      offRouteMeters: Math.round(dist),
    };
  }

  const refLatRad = (waypoints[0].latitude * Math.PI) / 180;
  const metersPerDegLat = 111_132.92;
  const metersPerDegLng = 111_412.84 * Math.cos(refLatRad);

  const toXY = (pt: LatLngPoint) => ({
    x: (pt.lng - waypoints[0].longitude) * metersPerDegLng,
    y: (pt.lat - waypoints[0].latitude) * metersPerDegLat,
  });

  const pXY = toXY(pos);
  let cumulativeMeters = 0;
  const segStarts: number[] = [];
  const segLengths: number[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    segStarts.push(cumulativeMeters);
    const len = haversineMeters(
      { lat: waypoints[i].latitude, lng: waypoints[i].longitude },
      { lat: waypoints[i + 1].latitude, lng: waypoints[i + 1].longitude }
    );
    segLengths.push(len);
    cumulativeMeters += len;
  }

  const totalMeters = Math.max(100, cumulativeMeters || totalRouteMetersFallback);

  let minPerpMeters = Number.MAX_VALUE;
  let bestTraveledMeters = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = toXY({ lat: waypoints[i].latitude, lng: waypoints[i].longitude });
    const b = toXY({
      lat: waypoints[i + 1].latitude,
      lng: waypoints[i + 1].longitude,
    });
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abLenSq = abx * abx + aby * aby;
    const t =
      abLenSq > 0
        ? Math.max(
            0,
            Math.min(1, ((pXY.x - a.x) * abx + (pXY.y - a.y) * aby) / abLenSq)
          )
        : 0;
    const projX = a.x + t * abx;
    const projY = a.y + t * aby;
    const perpDist = Math.hypot(pXY.x - projX, pXY.y - projY);

    if (perpDist < minPerpMeters) {
      minPerpMeters = perpDist;
      bestTraveledMeters = segStarts[i] + t * segLengths[i];
    }
  }

  const routeProgress = Math.max(0, Math.min(1, bestTraveledMeters / totalMeters));
  const remainingMeters = Math.max(0, Math.round(totalMeters - bestTraveledMeters));

  return {
    routeProgress,
    distanceTraveledMeters: Math.round(bestTraveledMeters),
    remainingMeters,
    offRouteMeters: Math.round(minPerpMeters === Number.MAX_VALUE ? 0 : minPerpMeters),
  };
}

export function computeBearingDegrees(a: LatLngPoint, b: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(deg);
}

/**
 * Encodes waypoints array into Google Encoded Polyline format so routes stay compact in Firestore.
 */
export function encodePolyline(points: LatLngPoint[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = '';

  const encodeValue = (v: number) => {
    let val = v < 0 ? ~(v << 1) : v << 1;
    let out = '';
    while (val >= 0x20) {
      out += String.fromCharCode((0x20 | (val & 0x1f)) + 63);
      val >>= 5;
    }
    out += String.fromCharCode(val + 63);
    return out;
  };

  for (const pt of points) {
    const lat = Math.round(pt.lat * 1e5);
    const lng = Math.round(pt.lng * 1e5);
    result += encodeValue(lat - lastLat);
    result += encodeValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return result;
}

export function decodePolyline(encoded: string): LatLngPoint[] {
  if (!encoded) return [];
  const points: LatLngPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b = 0;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < encoded.length);
    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < encoded.length);
    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Downsamples a polyline to at most maxPoints vertices while preserving start and end points.
 */
export function downsampleRoutePoints(
  points: LatLngPoint[],
  maxPoints = 60
): RoutePoint[] {
  if (points.length === 0) return [];
  const sampled: LatLngPoint[] =
    points.length <= maxPoints
      ? points
      : points.filter(
          (_, idx) =>
            idx === 0 ||
            idx === points.length - 1 ||
            idx % Math.ceil(points.length / maxPoints) === 0
        );

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const pt of sampled) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }
  const latSpan = Math.max(0.01, maxLat - minLat);
  const lngSpan = Math.max(0.01, maxLng - minLng);

  return sampled.map((pt) => ({
    latitude: pt.lat,
    longitude: pt.lng,
    xFraction: Math.max(0.08, Math.min(0.92, 0.1 + ((pt.lng - minLng) / lngSpan) * 0.8)),
    yFraction: Math.max(0.08, Math.min(0.9, 0.9 - ((pt.lat - minLat) / latSpan) * 0.8)),
  }));
}
