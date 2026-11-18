import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Activity,
  Compass,
  Layers,
  LocateFixed,
  Minus,
  Plus,
} from 'lucide-react';
import {
  ConvoyMember,
  ConvoyRouteConfig,
  DestinationEtaInfo,
  SosEmergencyState,
  StragglerAlertState,
} from '../../types/convoy';
import { LatLngPoint } from '../../utils/geo';
import {
  fetchTomTomRoute,
  getTomTomTileUrl,
} from '../../services/tomtomMapService';

interface LiveTomTomConvoyMapProps {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'RD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function LiveTomTomConvoyMap({
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
}: LiveTomTomConvoyMapProps) {
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [showTraffic, setShowTraffic] = useState(true);
  const [isAutoFollowing, setIsAutoFollowing] = useState(true);
  const [followTrigger, setFollowTrigger] = useState(0);
  const [fitAllTrigger, setFitAllTrigger] = useState(1);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const trafficLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const pickModeRef = useRef({
    isPickingDestination,
    isPickingCheckpoint,
    onPickCoordinateOnMap,
  });
  pickModeRef.current = {
    isPickingDestination,
    isPickingCheckpoint,
    onPickCoordinateOnMap,
  };

  const onRouteComputedRef = useRef(onRouteComputed);
  onRouteComputedRef.current = onRouteComputed;
  const onSelectMemberRef = useRef(onSelectMember);
  onSelectMemberRef.current = onSelectMember;

  const waypoints = routeConfig.waypoints;
  const destPoint = waypoints[waypoints.length - 1];

  const defaultCenter: [number, number] = focusedMember
    ? [focusedMember.mapPosition.latitude, focusedMember.mapPosition.longitude]
    : destPoint
      ? [destPoint.latitude, destPoint.longitude]
      : [-6.674, 106.925];

  // Initialize Leaflet map once
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: defaultCenter,
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    routeLayerGroupRef.current = L.layerGroup().addTo(map);
    markerLayerGroupRef.current = L.layerGroup().addTo(map);

    map.on('dragstart', () => {
      setIsAutoFollowing(false);
    });

    map.on('click', (ev: L.LeafletMouseEvent) => {
      const state = pickModeRef.current;
      if (!state.isPickingDestination && !state.isPickingCheckpoint) return;
      state.onPickCoordinateOnMap(ev.latlng.lat, ev.latlng.lng);
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      baseLayerRef.current = null;
      labelLayerRef.current = null;
      trafficLayerRef.current = null;
      routeLayerGroupRef.current = null;
      markerLayerGroupRef.current = null;
    };
  }, []);

  // Sync TomTom tile layers (Road Day/Night, Hybrid Satellite + Labels, Traffic Flow)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }
    if (labelLayerRef.current) {
      map.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }
    if (trafficLayerRef.current) {
      map.removeLayer(trafficLayerRef.current);
      trafficLayerRef.current = null;
    }

    if (mapType === 'hybrid') {
      baseLayerRef.current = L.tileLayer(getTomTomTileUrl('sat', 'main'), {
        maxZoom: 19,
        tileSize: 256,
      }).addTo(map);
      labelLayerRef.current = L.tileLayer(getTomTomTileUrl('labels', 'main'), {
        maxZoom: 19,
        tileSize: 256,
        pane: 'overlayPane',
      }).addTo(map);
    } else {
      const style = darkMode ? 'night' : 'main';
      baseLayerRef.current = L.tileLayer(getTomTomTileUrl('basic', style), {
        maxZoom: 19,
        tileSize: 256,
      }).addTo(map);
    }

    if (showTraffic) {
      trafficLayerRef.current = L.tileLayer(
        getTomTomTileUrl('traffic', 'relative0'),
        {
          maxZoom: 19,
          tileSize: 256,
          opacity: 0.72,
        }
      ).addTo(map);
    }
  }, [mapType, darkMode, showTraffic]);

  // Compute & render TomTom road polyline
  const routeKey = waypoints
    .map((w) => `${w.latitude.toFixed(4)},${w.longitude.toFixed(4)}`)
    .join('|');

  useEffect(() => {
    const group = routeLayerGroupRef.current;
    if (!group) return;

    const drawPolylines = (pts: [number, number][]) => {
      group.clearLayers();
      if (pts.length < 2) return;
      L.polyline(pts, {
        color: '#FFFFFF',
        weight: 8,
        opacity: 0.9,
        lineJoin: 'round',
      }).addTo(group);
      L.polyline(pts, {
        color: '#1D4ED8',
        weight: 5,
        opacity: 0.95,
        lineJoin: 'round',
      }).addTo(group);
    };

    const fallbackPts: [number, number][] = waypoints.map((w) => [
      w.latitude,
      w.longitude,
    ]);
    drawPolylines(fallbackPts);

    if (waypoints.length < 2) return;

    let cancelled = false;
    fetchTomTomRoute(waypoints, 'motorcycle').then((result) => {
      if (cancelled || !result || result.path.length < 2) return;
      drawPolylines(result.path.map((p) => [p.lat, p.lng]));
      if (onRouteComputedRef.current) {
        onRouteComputedRef.current(
          result.distanceMeters,
          result.durationMillis,
          result.path
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [routeKey]);

  // Sync checkpoints, destination ETA flag, and convoy member markers
  useEffect(() => {
    const group = markerLayerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    // Rest Area Checkpoints
    routeConfig.checkpoints.forEach((cp) => {
      const icon = L.divIcon({
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: `
          <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none;">
            <span style="padding:2px 8px;border-radius:8px;background:#0F766E;color:#fff;font-size:10px;font-weight:600;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.45);">
              ☕ ${escapeHtml(cp.name)}
            </span>
            <span style="margin-top:3px;width:24px;height:24px;border-radius:9999px;background:#0F766E;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">
              R
            </span>
          </div>
        `,
      });
      L.marker([cp.latitude, cp.longitude], { icon, interactive: false }).addTo(
        group
      );
    });

    // Final Destination Flag Marker
    if (destPoint) {
      const destIcon = L.divIcon({
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: `
          <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none;">
            <div style="padding:4px 10px;border-radius:10px;background:#0F172A;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.35);text-align:center;max-width:190px;border:1px solid rgba(255,255,255,0.2);">
              <div style="font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                Tujuan: ${escapeHtml(routeConfig.destinationName)}
              </div>
              <div style="font-size:9px;font-family:monospace;color:#86EFAC;white-space:nowrap;">
                ETA ${escapeHtml(etaInfo.arrivalClockLabel)} · ${escapeHtml(etaInfo.durationLabel)} · ${escapeHtml(etaInfo.distanceLabel)}
              </div>
            </div>
            <span style="margin-top:3px;width:28px;height:28px;border-radius:9999px;background:#16A34A;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;">
              🏁
            </span>
          </div>
        `,
      });
      L.marker([destPoint.latitude, destPoint.longitude], {
        icon: destIcon,
        interactive: false,
        zIndexOffset: 200,
      }).addTo(group);
    }

    // Convoy Member Markers
    members.forEach((member) => {
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

      const pillBg = isSosBeacon
        ? '#991B1B'
        : isOffRoute
          ? '#DC2626'
          : isStraggler
            ? '#B45309'
            : isSelected
              ? '#1D4ED8'
              : darkMode
                ? '#141C24'
                : '#FFFFFF';
      const pillText =
        isSosBeacon || isOffRoute || isStraggler || isSelected
          ? '#FFFFFF'
          : darkMode
            ? '#F1F5F9'
            : '#0F172A';
      const pillBorder =
        isSosBeacon || isOffRoute
          ? '#7F1D1D'
          : isStraggler
            ? '#92400E'
            : isSelected
              ? '#1E40AF'
              : darkMode
                ? '#334155'
                : '#CBD5E1';

      const pinBg =
        isSosBeacon || isOffRoute
          ? '#DC2626'
          : member.isCurrentUser
            ? '#EA580C'
            : member.role === 'TOUR_LEADER'
              ? '#1D4ED8'
              : '#334155';

      const vehicleEmoji = isSosBeacon
        ? '⚠️'
        : member.vehicleType === 'MOBIL'
          ? '🚗'
          : '🏍️';

      const markerIcon = L.divIcon({
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: `
          <div style="transform:translate(-50%,-88%);display:flex;flex-direction:column;align-items:center;cursor:pointer;">
            <span style="padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600;white-space:nowrap;max-width:175px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px rgba(0,0,0,0.28);background:${pillBg};color:${pillText};border:1px solid ${pillBorder};">
              ${escapeHtml(labelText)}
            </span>
            <div style="margin-top:3px;margin-bottom:-6px;z-index:2;width:26px;height:26px;border-radius:9999px;background:#1E293B;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid ${isSosBeacon || isOffRoute ? '#DC2626' : '#FFFFFF'};box-shadow:0 2px 6px rgba(0,0,0,0.3);">
              ${escapeHtml(getInitials(member.fullName))}
            </div>
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              ${isSosBeacon ? '<span style="position:absolute;width:40px;height:40px;border-radius:9999px;background:rgba(220,38,38,0.38);"></span>' : ''}
              <span style="position:relative;width:30px;height:30px;border-radius:9999px;background:${pinBg};border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:13px;">
                ${vehicleEmoji}
              </span>
            </div>
          </div>
        `,
      });

      const marker = L.marker(
        [member.mapPosition.latitude, member.mapPosition.longitude],
        {
          icon: markerIcon,
          zIndexOffset: isSosBeacon ? 600 : isSelected ? 500 : 300,
        }
      ).addTo(group);

      marker.on('click', () => {
        onSelectMemberRef.current(member.id);
        setIsAutoFollowing(true);
        setFollowTrigger((n) => n + 1);
      });
    });
  }, [
    members,
    focusedMember?.id,
    routeConfig.checkpoints,
    routeConfig.destinationName,
    routeConfig.offRouteToleranceMeters,
    etaInfo.arrivalClockLabel,
    etaInfo.durationLabel,
    etaInfo.distanceLabel,
    sosState.isActive,
    sosState.senderId,
    stragglerAlert.isTriggered,
    stragglerAlert.trailingMember?.id,
    darkMode,
  ]);

  // Camera follow focused member
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusedMember) return;
    if (!isAutoFollowing && followTrigger === 0) return;

    const targetLatLng: [number, number] = [
      focusedMember.mapPosition.latitude,
      focusedMember.mapPosition.longitude,
    ];
    const currentZoom = map.getZoom();
    if (followTrigger > 0 && currentZoom < 14) {
      map.setView(targetLatLng, 15, { animate: true });
    } else {
      map.panTo(targetLatLng, { animate: true });
    }
  }, [
    focusedMember?.id,
    focusedMember?.mapPosition.latitude,
    focusedMember?.mapPosition.longitude,
    isAutoFollowing,
    followTrigger,
  ]);

  // Fit entire route & focused member
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitAllTrigger === 0) return;

    const bounds = L.latLngBounds([]);
    waypoints.forEach((w) => bounds.extend([w.latitude, w.longitude]));
    if (focusedMember) {
      bounds.extend([
        focusedMember.mapPosition.latitude,
        focusedMember.mapPosition.longitude,
      ]);
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [46, 46], maxZoom: 15 });
    }
  }, [fitAllTrigger]);

  const adjustZoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    const next = Math.max(4, Math.min(19, map.getZoom() + delta));
    map.setZoom(next);
  };

  return (
    <div
      className={`relative w-full h-full min-h-[260px] ${
        isPickingDestination || isPickingCheckpoint ? 'cursor-crosshair' : ''
      }`}
    >
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* TomTom Attribution Pill */}
      <div className="absolute bottom-2 left-2 z-20 pointer-events-none px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-sm border border-[#E2E8F0] dark:border-[#334155] text-[9px] font-medium text-[#475569] dark:text-[#CBD5E1]">
        © TomTom Maps · Trial Mode
      </div>

      {/* Right Floating Map Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() =>
            setMapType((m) => (m === 'roadmap' ? 'hybrid' : 'roadmap'))
          }
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
          onClick={() => setShowTraffic((t) => !t)}
          aria-label="Toggle Lalu Lintas TomTom"
          title={showTraffic ? 'Sembunyikan Traffic' : 'Tampilkan Traffic Live'}
          className={`w-9 h-9 rounded-xl border shadow-sm flex items-center justify-center cursor-pointer transition-colors ${
            showTraffic
              ? 'bg-[#0F766E] text-white border-[#115E59]'
              : 'bg-white dark:bg-[#141C24] border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#F1F5F9]'
          }`}
        >
          <Activity className="w-4 h-4" />
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
          onClick={() => {
            setIsAutoFollowing(true);
            setFollowTrigger((n) => n + 1);
          }}
          aria-label="Fokus ke Peserta & Ikuti Live"
          title={
            isAutoFollowing
              ? 'Mengikuti Live (Ketuk untuk pusatkan)'
              : 'Ikuti Peserta Live'
          }
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
          onClick={() => {
            setIsAutoFollowing(false);
            setFitAllTrigger((n) => n + 1);
          }}
          aria-label="Lihat Seluruh Rute"
          title="Lihat Seluruh Rute"
          className="w-9 h-9 rounded-xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-center text-[#EA580C] cursor-pointer"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
