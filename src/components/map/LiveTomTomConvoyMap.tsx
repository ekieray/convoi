import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Activity,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Layers,
  LocateFixed,
  Minus,
  Navigation,
  Plus,
  RotateCcw,
} from 'lucide-react';
import {
  ConvoyMember,
  ConvoyRouteConfig,
  DestinationEtaInfo,
  RouteInstruction,
  SosEmergencyState,
  StragglerAlertState,
  VehicleType,
} from '../../types/convoy';
import {
  computeNavigationGuidance,
  LatLngPoint,
  projectAheadPoint,
} from '../../utils/geo';
import {
  fetchTomTomRoute,
  getTomTomTileUrl,
} from '../../services/tomtomMapService';

interface LiveTomTomConvoyMapProps {
  members: ConvoyMember[];
  focusedMember: ConvoyMember | null;
  routeConfig: ConvoyRouteConfig;
  vehicleType?: VehicleType;
  stragglerAlert: StragglerAlertState;
  sosState: SosEmergencyState;
  etaInfo: DestinationEtaInfo;
  darkMode?: boolean;
  isPickingDestination: boolean;
  isPickingCheckpoint: boolean;
  isNavigationMode?: boolean;
  cleanNavMode?: boolean;
  canPingTomTomRouting?: boolean;
  onToggleNavigationMode?: () => void;
  onSelectMember: (memberId: string) => void;
  onPickCoordinateOnMap: (lat: number, lng: number) => void;
  onRouteComputed?: (
    distanceMeters: number,
    durationMillis: number,
    path: LatLngPoint[],
    instructions?: RouteInstruction[]
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

function compassDirectionLabel(deg: number): string {
  const dirs = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

function ManeuverIcon({ maneuver }: { maneuver: string }) {
  const upper = maneuver.toUpperCase();
  if (upper.includes('ARRIVE') || upper.includes('GOAL')) {
    return <Flag className="w-6 h-6" />;
  }
  if (upper.includes('UTURN')) {
    return <RotateCcw className="w-6 h-6" />;
  }
  if (upper.includes('BEAR_LEFT') || upper.includes('KEEP_LEFT') || upper.includes('SLIGHT_LEFT')) {
    return <ArrowUpLeft className="w-6 h-6" />;
  }
  if (upper.includes('BEAR_RIGHT') || upper.includes('KEEP_RIGHT') || upper.includes('SLIGHT_RIGHT')) {
    return <ArrowUpRight className="w-6 h-6" />;
  }
  if (upper.includes('LEFT')) {
    return <CornerUpLeft className="w-6 h-6" />;
  }
  if (upper.includes('RIGHT')) {
    return <CornerUpRight className="w-6 h-6" />;
  }
  return <ArrowUp className="w-6 h-6" />;
}

export function LiveTomTomConvoyMap({
  members,
  focusedMember,
  routeConfig,
  vehicleType = 'MOTOR',
  stragglerAlert,
  sosState,
  etaInfo,
  darkMode = false,
  isPickingDestination,
  isPickingCheckpoint,
  isNavigationMode = false,
  cleanNavMode = false,
  canPingTomTomRouting = true,
  onToggleNavigationMode,
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
  const activeNavMode =
    Boolean(isNavigationMode) && !isPickingDestination && !isPickingCheckpoint;

  const navSubject =
    focusedMember ||
    members.find((m) => m.isCurrentUser) ||
    members[0] ||
    null;

  const navGuidance = useMemo(() => {
    const pos = navSubject
      ? {
          lat: navSubject.mapPosition.latitude,
          lng: navSubject.mapPosition.longitude,
        }
      : waypoints[0]
        ? { lat: waypoints[0].latitude, lng: waypoints[0].longitude }
        : { lat: -6.674, lng: 106.925 };
    return computeNavigationGuidance({
      pos,
      speedKmh: navSubject?.mapPosition.speedKmh ?? 0,
      gpsHeading: navSubject?.mapPosition.heading,
      waypoints,
      instructions: routeConfig.routeInstructions,
      destinationName: routeConfig.destinationName,
      totalRouteMeters: routeConfig.totalRouteMeters,
      offRouteMeters: navSubject?.offRouteMeters ?? 0,
      offRouteToleranceMeters: routeConfig.offRouteToleranceMeters,
    });
  }, [
    navSubject?.id,
    navSubject?.mapPosition.latitude,
    navSubject?.mapPosition.longitude,
    navSubject?.mapPosition.speedKmh,
    navSubject?.mapPosition.heading,
    navSubject?.offRouteMeters,
    waypoints,
    routeConfig.routeInstructions,
    routeConfig.destinationName,
    routeConfig.totalRouteMeters,
    routeConfig.offRouteToleranceMeters,
  ]);

  const navHeadingDeg = navGuidance.routeBearingDeg;

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

  // Re-measure Leaflet canvas & center camera when toggling GPS Navigation Mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeNavMode) {
      setIsAutoFollowing(true);
      setFollowTrigger((n) => n + 1);
    } else {
      setFitAllTrigger((n) => n + 1);
    }
    const t1 = window.setTimeout(() => map.invalidateSize({ animate: false }), 60);
    const t2 = window.setTimeout(() => map.invalidateSize({ animate: false }), 280);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [activeNavMode]);

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
  const routePref = routeConfig.routePreference ?? 'fastest';
  const routeKey = `${routePref}|${vehicleType}|${waypoints
    .map((w) => `${w.latitude.toFixed(4)},${w.longitude.toFixed(4)}`)
    .join('|')}`;

  useEffect(() => {
    const group = routeLayerGroupRef.current;
    if (!group) return;

    const drawPolylines = (pts: [number, number][]) => {
      group.clearLayers();
      if (pts.length < 2) return;
      L.polyline(pts, {
        color: '#FFFFFF',
        weight: 9,
        opacity: 0.92,
        lineJoin: 'round',
      }).addTo(group);
      L.polyline(pts, {
        color: activeNavMode ? '#2563EB' : '#1D4ED8',
        weight: 6,
        opacity: 0.96,
        lineJoin: 'round',
      }).addTo(group);
    };

    const fallbackPts: [number, number][] = waypoints.map((w) => [
      w.latitude,
      w.longitude,
    ]);
    drawPolylines(fallbackPts);

    if (waypoints.length < 2 || !canPingTomTomRouting) return;

    let cancelled = false;
    fetchTomTomRoute(
      waypoints,
      vehicleType === 'MOBIL' ? 'car' : 'motorcycle',
      routePref
    ).then((result) => {
      if (cancelled || !result || result.path.length < 2) return;
      drawPolylines(result.path.map((p) => [p.lat, p.lng]));
      if (onRouteComputedRef.current) {
        onRouteComputedRef.current(
          result.distanceMeters,
          result.durationMillis,
          result.path,
          result.instructions
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [routeKey, canPingTomTomRouting]);

  // Sync checkpoints, destination ETA flag, and convoy member markers
  useEffect(() => {
    const group = markerLayerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    const counterRotate = activeNavMode ? ` rotate(${navHeadingDeg}deg)` : '';

    // Rest Area Checkpoints dinonaktifkan sementara

    // Final Destination Flag Marker
    if (destPoint) {
      const destIcon = L.divIcon({
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: `
          <div style="transform:translate(-50%,-100%)${counterRotate};display:flex;flex-direction:column;align-items:center;pointer-events:none;">
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
      const isNavHero = activeNavMode && member.id === navSubject?.id;
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
        : member.isActingLeader
          ? 'Plt.Leader · '
          : member.isCoLeader && member.isSweeper
            ? member.isAutoSweeper
              ? 'Co-Ldr/Swp (Auto) · '
              : 'Co-Ldr/Swp · '
            : member.isCoLeader
              ? 'Co-Leader · '
              : member.isSweeper
                ? member.isAutoSweeper
                  ? 'Sweeper (Auto) · '
                  : 'Sweeper · '
                : '';
      const labelText = `${prefix}${member.fullName} · ${vehicleLabel}${member.isCurrentUser ? ' (Anda)' : ''}`;

      const pillBg = isSosBeacon
        ? '#991B1B'
        : isOffRoute
          ? '#DC2626'
          : isStraggler || member.isSweeper
            ? '#B45309'
            : member.isActingLeader
              ? '#0369A1'
              : member.isCoLeader
                ? '#6D28D9'
                : isSelected
                  ? '#1D4ED8'
                  : darkMode
                    ? '#141C24'
                    : '#FFFFFF';
      const pillText =
        isSosBeacon ||
        isOffRoute ||
        isStraggler ||
        member.isSweeper ||
        member.isActingLeader ||
        member.isCoLeader ||
        isSelected
          ? '#FFFFFF'
          : darkMode
            ? '#F1F5F9'
            : '#0F172A';
      const pillBorder =
        isSosBeacon || isOffRoute
          ? '#7F1D1D'
          : isStraggler || member.isSweeper
            ? '#92400E'
            : member.isActingLeader
              ? '#075985'
              : member.isCoLeader
                ? '#5B21B6'
                : isSelected
                  ? '#1E40AF'
                  : darkMode
                    ? '#334155'
                    : '#CBD5E1';

      const pinBg =
        isSosBeacon || isOffRoute
          ? '#DC2626'
          : member.isActingLeader
            ? '#0284C7'
            : member.isCoLeader
              ? '#7C3AED'
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

      const memberWorldHeading =
        typeof member.mapPosition.heading === 'number' &&
        member.mapPosition.heading > 0 &&
        member.mapPosition.speedKmh >= 5
          ? member.mapPosition.heading
          : navHeadingDeg;

      const iconHtml = isNavHero
        ? `
          <div style="transform:translate(-50%,-50%);position:relative;width:54px;height:54px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
            <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(37,99,235,0.22);border:1.5px solid rgba(96,165,250,0.6);"></span>
            <div style="transform:rotate(${memberWorldHeading}deg);width:36px;height:36px;border-radius:9999px;background:#0F172A;border:2.5px solid #FFFFFF;box-shadow:0 4px 12px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L20 20L12 16L4 20L12 2Z" fill="${isOffRoute ? '#EF4444' : '#38BDF8'}" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        `
        : `
          <div style="transform:translate(-50%,-88%)${counterRotate};display:flex;flex-direction:column;align-items:center;cursor:pointer;">
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
        `;

      const markerIcon = L.divIcon({
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: iconHtml,
      });

      const marker = L.marker(
        [member.mapPosition.latitude, member.mapPosition.longitude],
        {
          icon: markerIcon,
          zIndexOffset: isSosBeacon
            ? 600
            : isNavHero
              ? 550
              : isSelected
                ? 500
                : 300,
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
    navSubject?.id,
    activeNavMode,
    navHeadingDeg,
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

  // Camera follow focused member (with cockpit ahead look-ahead in Navigation Mode)
  useEffect(() => {
    const map = mapRef.current;
    const subject = navSubject;
    if (!map || !subject) return;
    if (!isAutoFollowing && followTrigger === 0) return;

    const rawLat = subject.mapPosition.latitude;
    const rawLng = subject.mapPosition.longitude;
    const target = activeNavMode
      ? projectAheadPoint(rawLat, rawLng, navHeadingDeg, 85)
      : { lat: rawLat, lng: rawLng };

    const targetLatLng: [number, number] = [target.lat, target.lng];
    const currentZoom = map.getZoom();

    if (activeNavMode) {
      if (currentZoom < 16 || followTrigger > 0) {
        map.setView(targetLatLng, 17, { animate: true });
      } else {
        map.panTo(targetLatLng, { animate: true });
      }
    } else if (followTrigger > 0 && currentZoom < 14) {
      map.setView(targetLatLng, 15, { animate: true });
    } else {
      map.panTo(targetLatLng, { animate: true });
    }
  }, [
    navSubject?.id,
    navSubject?.mapPosition.latitude,
    navSubject?.mapPosition.longitude,
    activeNavMode,
    navHeadingDeg,
    isAutoFollowing,
    followTrigger,
  ]);

  const lastFittedWaypointsKeyRef = useRef<string>('');

  // Fit entire route & focused member (disabled while Navigation Mode is active)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeNavMode) return;

    const wpSig = waypoints
      .map((w) => `${w.latitude.toFixed(4)},${w.longitude.toFixed(4)}`)
      .join('|');
    const shouldAutoFitOnSync =
      waypoints.length >= 2 && wpSig !== lastFittedWaypointsKeyRef.current;
    if (fitAllTrigger === 0 && !shouldAutoFitOnSync) return;
    if (waypoints.length >= 2) {
      lastFittedWaypointsKeyRef.current = wpSig;
    }

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
  }, [fitAllTrigger, activeNavMode, routeKey]);

  const adjustZoom = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    const next = Math.max(4, Math.min(19, map.getZoom() + delta));
    map.setZoom(next);
  };

  return (
    <div
      className={`relative w-full h-full min-h-[260px] overflow-hidden ${
        isPickingDestination || isPickingCheckpoint ? 'cursor-crosshair' : ''
      } ${activeNavMode ? 'bg-[#0B1117]' : ''}`}
    >
      {/* Leaflet Canvas Stage (with GPS 3D Cockpit Tilt & Heading-Up Rotation in Navigation Mode) */}
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={
          activeNavMode
            ? {
                width: '175%',
                height: '175%',
                left: '-37.5%',
                top: '-37.5%',
                transform: `perspective(900px) rotateX(34deg) rotateZ(${-navHeadingDeg}deg)`,
                transformOrigin: '50% 58%',
              }
            : undefined
        }
      >
        <div ref={mapContainerRef} className="w-full h-full z-0" />
      </div>

      {/* Subtle Horizon Depth Gradient in GPS Navigation Mode */}
      {activeNavMode && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-14 z-10 bg-gradient-to-b from-black/35 to-transparent"
        />
      )}

      {/* Top Turn-by-Turn Navigation Instruction HUD */}
      {activeNavMode && (
        <div
          role="status"
          aria-label="Instruksi Navigasi GPS"
          className={`absolute top-2.5 left-2.5 right-14 z-20 rounded-2xl px-3 py-2.5 shadow-xl border flex items-center gap-2.5 backdrop-blur-md ${
            navGuidance.isOffRoute
              ? 'bg-[#DC2626]/95 border-[#FCA5A5]/60 text-white'
              : 'bg-[#065F46]/95 border-[#34D399]/40 text-white'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <ManeuverIcon maneuver={navGuidance.maneuver} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-extrabold font-mono tabular-nums tracking-tight">
                {navGuidance.distanceToTurnLabel}
              </span>
              <span className="text-[11px] font-medium text-white/80 truncate">
                {navGuidance.isOffRoute ? 'Keluar Jalur' : navGuidance.streetName}
              </span>
            </div>
            <p className="text-xs font-semibold leading-tight truncate">
              {navGuidance.isOffRoute
                ? 'Kembali ke jalur biru konvoi terdekat'
                : navGuidance.instructionText}
            </p>
          </div>
        </div>
      )}

      {/* Bottom-Left: Digital Speedometer & Compass in Nav Mode OR Attribution */}
      {activeNavMode ? (
        <div className="absolute bottom-3 left-2.5 z-20 pointer-events-none rounded-2xl bg-[#0F172A]/90 backdrop-blur-md border border-white/15 text-white px-3 py-2 shadow-lg">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold font-mono tabular-nums leading-none">
              {navGuidance.speedKmh}
            </span>
            <span className="text-[10px] font-semibold text-white/75">
              km/j
            </span>
            {cleanNavMode && (
              <span className="ml-1.5 pl-1.5 border-l border-white/20 text-[10px] font-mono tabular-nums text-[#86EFAC] font-semibold">
                {etaInfo.arrivalClockLabel} · {etaInfo.distanceLabel}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-[#38BDF8]">
            <Navigation
              className="w-2.5 h-2.5"
              style={{ transform: `rotate(${navHeadingDeg}deg)` }}
            />
            <span>
              {navHeadingDeg}° {compassDirectionLabel(navHeadingDeg)}
            </span>
            <span className="text-white/45">· TomTom</span>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-2 left-2 z-20 pointer-events-none px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-sm border border-[#E2E8F0] dark:border-[#334155] text-[9px] font-medium text-[#475569] dark:text-[#CBD5E1]">
          © TomTom Maps · Trial Mode
        </div>
      )}

      {/* Right Floating Map Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
        {onToggleNavigationMode && (
          <button
            type="button"
            onClick={onToggleNavigationMode}
            aria-label="Toggle Mode Navigasi GPS"
            title={
              isNavigationMode
                ? 'Matikan Mode Navigasi GPS'
                : 'Aktifkan Mode Navigasi GPS Mobil/HP'
            }
            className={`w-9 h-9 rounded-xl border shadow-sm flex items-center justify-center cursor-pointer transition-colors ${
              isNavigationMode
                ? 'bg-[#EA580C] text-white border-[#C2410C]'
                : 'bg-white dark:bg-[#141C24] border-[#E2E8F0] dark:border-[#334155] text-[#EA580C]'
            }`}
          >
            <Navigation className="w-4 h-4" />
          </button>
        )}
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
        {!cleanNavMode && (
          <>
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
          </>
        )}
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
        {!cleanNavMode && (
          <button
            type="button"
            onClick={() => {
              if (isNavigationMode && onToggleNavigationMode) {
                onToggleNavigationMode();
              }
              setIsAutoFollowing(false);
              setFitAllTrigger((n) => n + 1);
            }}
            aria-label="Lihat Seluruh Rute"
            title="Lihat Seluruh Rute"
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-center text-[#EA580C] cursor-pointer"
          >
            <Compass className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
