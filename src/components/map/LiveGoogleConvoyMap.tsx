import { useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  Map as GoogleMap,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Bike,
  Car,
  Coffee,
  Compass,
  Flag,
  Layers,
  LocateFixed,
  Minus,
  Plus,
} from 'lucide-react';
import {
  ConvoyMember,
  ConvoyRouteConfig,
  DestinationEtaInfo,
  RoutePoint,
  SosEmergencyState,
  StragglerAlertState,
} from '../../types/convoy';
import { ConvoyAvatar } from '../ConvoyAvatar';
import { LatLngPoint } from '../../utils/geo';

interface LiveGoogleConvoyMapProps {
  members: ConvoyMember[];
  focusedMember: ConvoyMember | null;
  routeConfig: ConvoyRouteConfig;
  stragglerAlert: StragglerAlertState;
  sosState: SosEmergencyState;
  etaInfo: DestinationEtaInfo;
  darkMode?: boolean;
  isPickingDestination: boolean;
  isPickingCheckpoint: boolean;
  onSelectMember: (memberId: string) => void;
  onPickCoordinateOnMap: (lat: number, lng: number) => void;
  onRouteComputed?: (
    distanceMeters: number,
    durationMillis: number,
    path: LatLngPoint[]
  ) => void;
}

interface RouteOverlayProps {
  waypoints: RoutePoint[];
  onRouteComputed?: (
    distanceMeters: number,
    durationMillis: number,
    path: LatLngPoint[]
  ) => void;
}

function ConvoyRouteOverlay({ waypoints, onRouteComputed }: RouteOverlayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const onRouteComputedRef = useRef(onRouteComputed);
  onRouteComputedRef.current = onRouteComputed;

  const originPt = waypoints[0];
  const destPt = waypoints[waypoints.length - 1];
  const originKey = originPt
    ? `${originPt.latitude.toFixed(4)},${originPt.longitude.toFixed(4)}`
    : '';
  const destKey = destPt
    ? `${destPt.latitude.toFixed(4)},${destPt.longitude.toFixed(4)}`
    : '';

  useEffect(() => {
    if (!map || !originPt || !destPt) return;

    const clearPolylines = () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };

    const drawFallbackPolyline = () => {
      clearPolylines();
      if (waypoints.length < 2 || !window.google?.maps?.Polyline) return;
      const line = new google.maps.Polyline({
        path: waypoints.map((w) => ({ lat: w.latitude, lng: w.longitude })),
        strokeColor: '#1D4ED8',
        strokeWeight: 5,
        strokeOpacity: 0.9,
        map,
      });
      polylinesRef.current = [line];
    };

    if (!routesLib || !(routesLib as unknown as { Route?: unknown }).Route) {
      drawFallbackPolyline();
      return clearPolylines;
    }

    let cancelled = false;
    const intermediates =
      waypoints.length > 2
        ? waypoints.slice(1, -1).slice(0, 4).map((pt) => ({
            lat: pt.latitude,
            lng: pt.longitude,
          }))
        : undefined;

    const request: Record<string, unknown> = {
      origin: { lat: originPt.latitude, lng: originPt.longitude },
      destination: { lat: destPt.latitude, lng: destPt.longitude },
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
      ...(intermediates && intermediates.length > 0 ? { intermediates } : {}),
    };

    // Official promise-based Maps JS SDK Routes wrapper (no CORS issues)
    (routesLib.Route as unknown as {
      computeRoutes: (req: Record<string, unknown>) => Promise<{ routes?: any[] }>;
    })
      .computeRoutes(request)
      .then((res) => {
        if (cancelled) return;
        const primaryRoute = res?.routes?.[0];
        if (!primaryRoute) {
          drawFallbackPolyline();
          return;
        }
        clearPolylines();
        if (typeof primaryRoute.createPolylines === 'function') {
          const lines: google.maps.Polyline[] = primaryRoute.createPolylines();
          lines.forEach((p) => {
            p.setOptions({
              strokeColor: '#1D4ED8',
              strokeWeight: 6,
              strokeOpacity: 0.92,
            });
            p.setMap(map);
          });
          polylinesRef.current = lines;
        } else {
          drawFallbackPolyline();
        }

        const rawPath = Array.isArray(primaryRoute.path) ? primaryRoute.path : [];
        const pathLatLngs: LatLngPoint[] = rawPath
          .map((pt: any) => ({
            lat: typeof pt.lat === 'function' ? pt.lat() : Number(pt.lat),
            lng: typeof pt.lng === 'function' ? pt.lng() : Number(pt.lng),
          }))
          .filter((pt: LatLngPoint) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng));

        if (onRouteComputedRef.current) {
          onRouteComputedRef.current(
            Number(primaryRoute.distanceMeters || 0),
            Number(primaryRoute.durationMillis || 0),
            pathLatLngs
          );
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = String(
          err instanceof Error ? err.message : (err as { message?: string })?.message || err
        );
        if (/429|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|Quota/i.test(msg)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        drawFallbackPolyline();
      });

    return () => {
      cancelled = true;
      clearPolylines();
    };
  }, [map, routesLib, originKey, destKey]);

  return null;
}

function MapCameraSync({
  focusedMember,
  waypoints,
  isAutoFollowing,
  followTrigger,
  fitAllTrigger,
  onUserDrag,
}: {
  focusedMember: ConvoyMember | null;
  waypoints: RoutePoint[];
  isAutoFollowing: boolean;
  followTrigger: number;
  fitAllTrigger: number;
  onUserDrag: () => void;
}) {
  const map = useMap();
  const onUserDragRef = useRef(onUserDrag);
  onUserDragRef.current = onUserDrag;

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('dragstart', () => {
      onUserDragRef.current();
    });
    return () => {
      listener.remove();
    };
  }, [map]);

  useEffect(() => {
    if (!map || !focusedMember) return;
    if (!isAutoFollowing && followTrigger === 0) return;
    map.panTo({
      lat: focusedMember.mapPosition.latitude,
      lng: focusedMember.mapPosition.longitude,
    });
    if (followTrigger > 0 && (map.getZoom() ?? 12) < 14) {
      map.setZoom(15);
    }
  }, [
    map,
    focusedMember?.id,
    focusedMember?.mapPosition.latitude,
    focusedMember?.mapPosition.longitude,
    isAutoFollowing,
    followTrigger,
  ]);

  useEffect(() => {
    if (!map || fitAllTrigger === 0 || !window.google?.maps?.LatLngBounds) return;
    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    waypoints.forEach((w) => {
      bounds.extend({ lat: w.latitude, lng: w.longitude });
      count++;
    });
    if (focusedMember) {
      bounds.extend({
        lat: focusedMember.mapPosition.latitude,
        lng: focusedMember.mapPosition.longitude,
      });
      count++;
    }
    if (count > 0) {
      map.fitBounds(bounds, 48);
    }
  }, [map, fitAllTrigger]);

  return null;
}

function ZoomControlsOverlay({
  mapType,
  isAutoFollowing,
  onToggleMapType,
  onCenterFocused,
  onFitRoute,
}: {
  mapType: 'roadmap' | 'hybrid';
  isAutoFollowing: boolean;
  onToggleMapType: () => void;
  onCenterFocused: () => void;
  onFitRoute: () => void;
}) {
  const map = useMap();

  const adjustZoom = (delta: number) => {
    if (!map) return;
    const cur = map.getZoom() ?? 13;
    map.setZoom(Math.max(4, Math.min(20, cur + delta)));
  };

  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onToggleMapType}
        aria-label="Ubah Tampilan Satelit / Peta"
        title={mapType === 'hybrid' ? 'Mode Peta Jalan' : 'Mode Satelit'}
        className={`w-9 h-9 rounded-xl border shadow-sm flex items-center justify-center cursor-pointer transition-colors ${
          mapType === 'hybrid'
            ? 'bg-[#1D4ED8] text-white border-[#1E40AF]'
            : 'bg-white dark:bg-[#141C24] border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#F1F5F9]'
        }`}
      >
        <Layers className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => adjustZoom(1)}
        aria-label="Perbesar Peta"
        className="w-9 h-9 rounded-xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-center cursor-pointer"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => adjustZoom(-1)}
        aria-label="Perkecil Peta"
        className="w-9 h-9 rounded-xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-center cursor-pointer"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onCenterFocused}
        aria-label="Fokus ke Peserta & Ikuti Live"
        title={isAutoFollowing ? 'Mengikuti Live (Ketuk untuk pusatkan)' : 'Ikuti Peserta Live'}
        className={`w-9 h-9 rounded-xl border shadow-sm flex items-center justify-center cursor-pointer transition-colors ${
          isAutoFollowing
            ? 'bg-[#1D4ED8] text-white border-[#1E40AF]'
            : 'bg-white dark:bg-[#141C24] border-[#E2E8F0] dark:border-[#334155] text-[#1D4ED8] dark:text-[#60A5FA]'
        }`}
      >
        <LocateFixed className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onFitRoute}
        aria-label="Lihat Seluruh Rute"
        title="Lihat Seluruh Rute"
        className="w-9 h-9 rounded-xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-center text-[#EA580C] cursor-pointer"
      >
        <Compass className="w-4 h-4" />
      </button>
    </div>
  );
}

export function LiveGoogleConvoyMap({
  members,
  focusedMember,
  routeConfig,
  stragglerAlert,
  sosState,
  etaInfo,
  darkMode = false,
  isPickingDestination,
  isPickingCheckpoint,
  onSelectMember,
  onPickCoordinateOnMap,
  onRouteComputed,
}: LiveGoogleConvoyMapProps) {
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [isAutoFollowing, setIsAutoFollowing] = useState(true);
  const [followTrigger, setFollowTrigger] = useState(0);
  const [fitAllTrigger, setFitAllTrigger] = useState(1);
  const loadingStatus = useApiLoadingStatus();

  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const waypoints = routeConfig.waypoints;
  const destPoint = waypoints[waypoints.length - 1];

  const defaultCenter = focusedMember
    ? {
        lat: focusedMember.mapPosition.latitude,
        lng: focusedMember.mapPosition.longitude,
      }
    : destPoint
      ? { lat: destPoint.latitude, lng: destPoint.longitude }
      : { lat: -6.674, lng: 106.925 };

  if (!apiKey) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#E9EFF5] dark:bg-[#141B22] p-6 text-center space-y-2">
        <AlertTriangle className="w-7 h-7 text-[#D97706]" />
        <p className="text-xs font-bold">Google Maps API Key Belum Aktif</p>
        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] max-w-xs">
          Konfigurasi kunci Google Maps diperlukan agar peta Google Maps live dan rute jalan nyata tampil di perangkat Anda.
        </p>
      </div>
    );
  }

  if (
    loadingStatus === APILoadingStatus.FAILED ||
    loadingStatus === APILoadingStatus.AUTH_FAILURE
  ) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#E9EFF5] dark:bg-[#141B22] p-6 text-center space-y-2">
        <AlertTriangle className="w-7 h-7 text-[#DC2626]" />
        <p className="text-xs font-bold">Gagal Memuat Google Maps</p>
        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] max-w-xs">
          Periksa koneksi internet, kuota Google Maps Platform, atau pembatasan domain pada API Key Anda.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full min-h-[260px] ${
        isPickingDestination || isPickingCheckpoint ? 'cursor-crosshair' : ''
      }`}
    >
      <GoogleMap
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={defaultCenter}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI
        mapTypeId={mapType}
        colorScheme={darkMode ? 'DARK' : 'LIGHT'}
        style={{ width: '100%', height: '100%' }}
        onClick={(ev) => {
          if (!isPickingDestination && !isPickingCheckpoint) return;
          const latLng = ev.detail.latLng;
          if (latLng) {
            onPickCoordinateOnMap(latLng.lat, latLng.lng);
          }
        }}
      >
        <ConvoyRouteOverlay
          waypoints={waypoints}
          onRouteComputed={onRouteComputed}
        />

        <MapCameraSync
          focusedMember={focusedMember}
          waypoints={waypoints}
          isAutoFollowing={isAutoFollowing}
          followTrigger={followTrigger}
          fitAllTrigger={fitAllTrigger}
          onUserDrag={() => setIsAutoFollowing(false)}
        />

        <ZoomControlsOverlay
          mapType={mapType}
          isAutoFollowing={isAutoFollowing}
          onToggleMapType={() =>
            setMapType((m) => (m === 'roadmap' ? 'hybrid' : 'roadmap'))
          }
          onCenterFocused={() => {
            setIsAutoFollowing(true);
            setFollowTrigger((n) => n + 1);
          }}
          onFitRoute={() => {
            setIsAutoFollowing(false);
            setFitAllTrigger((n) => n + 1);
          }}
        />

        {/* Rest Area Checkpoint Markers */}
        {routeConfig.checkpoints.map((cp) => (
          <AdvancedMarker
            key={cp.id}
            position={{ lat: cp.latitude, lng: cp.longitude }}
            zIndex={15}
          >
            <div className="flex flex-col items-center pointer-events-none">
              <span className="px-2 py-0.5 rounded-lg bg-[#0F766E] text-white text-[10px] font-semibold whitespace-nowrap max-w-[160px] truncate shadow-md border border-white/40">
                {cp.name}
              </span>
              <span className="mt-1 w-7 h-7 rounded-full bg-[#0F766E] border-2 border-white shadow-md flex items-center justify-center text-white">
                <Coffee className="w-3.5 h-3.5" />
              </span>
            </div>
          </AdvancedMarker>
        ))}

        {/* Final Destination Flag Marker */}
        {destPoint && (
          <AdvancedMarker
            position={{ lat: destPoint.latitude, lng: destPoint.longitude }}
            zIndex={18}
          >
            <div className="flex flex-col items-center pointer-events-none">
              <div className="px-2.5 py-1 rounded-xl bg-[#0F172A] text-white shadow-lg text-center max-w-[185px] border border-white/20">
                <p className="text-[10px] font-semibold truncate">
                  Tujuan: {routeConfig.destinationName}
                </p>
                <p className="text-[9px] font-mono text-[#86EFAC] whitespace-nowrap">
                  {`ETA ${etaInfo.arrivalClockLabel} · ${etaInfo.durationLabel} · ${etaInfo.distanceLabel}`}
                </p>
              </div>
              <span className="mt-1 w-7 h-7 rounded-full bg-[#16A34A] border-2 border-white shadow-md flex items-center justify-center text-white">
                <Flag className="w-3.5 h-3.5" />
              </span>
            </div>
          </AdvancedMarker>
        )}

        {/* Convoy Member Markers */}
        {members.map((member) => {
          const isSelected = member.id === focusedMember?.id;
          const isSosBeacon =
            member.conditionStatus === 'SOS' ||
            (sosState.isActive && sosState.senderId === member.id);
          const isOffRoute =
            member.offRouteMeters > routeConfig.offRouteToleranceMeters;
          const isStraggler =
            stragglerAlert.isTriggered &&
            stragglerAlert.trailingMember?.id === member.id;
          const vehicleLabel =
            member.vehicleDetail.trim() ||
            (member.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor');
          const prefix = isSosBeacon
            ? 'SOS · '
            : member.isSweeper
              ? 'Sweeper · '
              : '';
          const labelText = `${prefix}${member.fullName} · ${vehicleLabel}${member.isCurrentUser ? ' (Anda)' : ''}`;

          return (
            <AdvancedMarker
              key={member.id}
              position={{
                lat: member.mapPosition.latitude,
                lng: member.mapPosition.longitude,
              }}
              zIndex={isSosBeacon ? 60 : isSelected ? 50 : 30}
              onClick={() => {
                onSelectMember(member.id);
                setIsAutoFollowing(true);
                setFollowTrigger((n) => n + 1);
              }}
            >
              <div className="flex flex-col items-center cursor-pointer group">
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap max-w-[175px] truncate shadow-md border ${
                    isSosBeacon
                      ? 'bg-[#991B1B] text-white border-[#7F1D1D]'
                      : isOffRoute
                        ? 'bg-[#DC2626] text-white border-[#991B1B]'
                        : isStraggler
                          ? 'bg-[#B45309] text-white border-[#92400E]'
                          : isSelected
                            ? 'bg-[#1D4ED8] text-white border-[#1E40AF]'
                            : 'bg-white dark:bg-[#141C24] text-[#0F172A] dark:text-[#F1F5F9] border-[#CBD5E1] dark:border-[#334155]'
                  }`}
                >
                  {labelText}
                </span>

                <div className="mt-1 -mb-1.5 z-10">
                  <ConvoyAvatar
                    preset={member.avatarPreset}
                    photoUrl={member.avatarPhotoUrl}
                    name={member.fullName}
                    sizeClass="w-7 h-7"
                    ringClass={
                      isSosBeacon || isOffRoute
                        ? 'ring-2 ring-[#DC2626]'
                        : 'ring-2 ring-white'
                    }
                  />
                </div>

                <span className="relative flex items-center justify-center">
                  {isSosBeacon && (
                    <span className="absolute w-11 h-11 rounded-full bg-[#DC2626]/45 animate-ping" />
                  )}
                  <span
                    className={`relative w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform group-hover:scale-110 ${
                      isSosBeacon || isOffRoute
                        ? 'bg-[#DC2626] text-white'
                        : member.isCurrentUser
                          ? 'bg-[#EA580C] text-white'
                          : member.role === 'TOUR_LEADER'
                            ? 'bg-[#1D4ED8] text-white'
                            : 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F1F5F9]'
                    }`}
                  >
                    {isSosBeacon ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : member.vehicleType === 'MOBIL' ? (
                      <Car className="w-4 h-4" />
                    ) : (
                      <Bike className="w-4 h-4" />
                    )}
                  </span>
                </span>
              </div>
            </AdvancedMarker>
          );
        })}
      </GoogleMap>
    </div>
  );
}
