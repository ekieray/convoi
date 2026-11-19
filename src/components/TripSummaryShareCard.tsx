import { useEffect, useRef, useState } from 'react';
import { Coffee, Navigation } from 'lucide-react';
import { getTomTomTileUrl } from '../services/tomtomMapService';
import { TripCardTheme, TripHistoryRecord } from '../types/convoy';
import { projectTripMapViewport } from '../utils/geo';
import { ConvoyAvatar } from './ConvoyAvatar';

interface TripSummaryShareCardProps {
  trip: TripHistoryRecord;
  theme: TripCardTheme;
  customPhotoUrl?: string;
  defaultScenicPhotoUrl: string;
}

export function TripSummaryShareCard({
  trip,
  theme,
  customPhotoUrl,
  defaultScenicPhotoUrl,
}: TripSummaryShareCardProps) {
  const [imgError, setImgError] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapSize, setMapSize] = useState({ width: 300, height: 185 });

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setMapSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isLight = theme === 'MINIMAL_LIGHT';
  const primaryText = isLight ? 'text-[#0F172A]' : 'text-white';
  const secondaryText = isLight ? 'text-[#475569]' : 'text-[#CBD5E1]';
  const borderClass =
    theme === 'MINIMAL_LIGHT'
      ? 'border-[#CBD5E1]'
      : theme === 'SATELLITE'
        ? 'border-[#1E4E45]'
        : 'border-[#334155]';

  const leader =
    trip.participants.find((p) => p.role === 'TOUR_LEADER') ??
    trip.participants[0];

  const projection = projectTripMapViewport(
    trip.waypoints,
    trip.visitedCheckpoints,
    mapSize.width,
    mapSize.height,
    0.13
  );
  const polylinePts = projection.waypoints
    .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ');
  const startPt = projection.waypoints[0];
  const endPt = projection.waypoints[projection.waypoints.length - 1];
  const activePhotoSrc = customPhotoUrl || defaultScenicPhotoUrl;

  // Compute full-card Satellite backdrop projection so TomTom Sat tiles cover entire SATELLITE card cleanly
  const satCardW = 320;
  const satCardH = 400;
  const satBackdropProjection = projectTripMapViewport(
    trip.waypoints,
    trip.visitedCheckpoints,
    satCardW,
    satCardH,
    0.22
  );
  const satTileTpl = getTomTomTileUrl('sat', 'main');
  const labelsTileTpl = getTomTomTileUrl('labels', 'main');

  return (
    <div
      className={`relative w-full aspect-[4/5] rounded-[22px] border overflow-hidden shadow-md select-none ${borderClass}`}
    >
      {/* 1. Background Layer per Theme */}
      {theme === 'DARK_CARBON' && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(145deg, #090E17 0%, #111827 55%, #172133 100%)',
          }}
        >
          <svg className="w-full h-full opacity-100" viewBox="0 0 320 400">
            <defs>
              <pattern
                id="darkCarbonGrid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="320" height="400" fill="url(#darkCarbonGrid)" />
            <circle
              cx="275"
              cy="62"
              r="110"
              fill="rgba(234,88,12,0.16)"
            />
          </svg>
        </div>
      )}

      {theme === 'SATELLITE' && (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            background:
              'linear-gradient(155deg, #0B1F1D 0%, #112A2B 52%, #0B1821 100%)',
          }}
        >
          <svg className="w-full h-full" viewBox="0 0 320 400">
            {[1, 2, 3, 4, 5, 6].map((ring) => (
              <circle
                key={ring}
                cx="230"
                cy="168"
                r={ring * 52}
                fill="none"
                stroke="rgba(45,212,191,0.11)"
                strokeWidth="1.2"
              />
            ))}
          </svg>
          {projection.hasGeo &&
            projection.tiles.map((tile) => {
              const satSrc = satTileTpl
                .replace('{z}', String(tile.z))
                .replace('{x}', String(tile.x))
                .replace('{y}', String(tile.y));
              const lblSrc = labelsTileTpl
                .replace('{z}', String(tile.z))
                .replace('{x}', String(tile.x))
                .replace('{y}', String(tile.y));
              const tileStyle = {
                left: `${((tile.left + 16) / (mapSize.width + 32)) * 100}%`,
                top: `${((tile.top + 96) / (mapSize.height + 215)) * 100}%`,
                width: `${(tile.size / (mapSize.width + 32)) * 100}%`,
                height: `${(tile.size / (mapSize.height + 215)) * 100}%`,
              };
              return (
                <div key={tile.key} style={tileStyle} className="absolute pointer-events-none">
                  <img
                    src={satSrc}
                    alt=""
                    loading="lazy"
                    onError={(ev) => {
                      ev.currentTarget.style.display = 'none';
                    }}
                    className="w-full h-full object-cover"
                  />
                  <img
                    src={lblSrc}
                    alt=""
                    loading="lazy"
                    onError={(ev) => {
                      ev.currentTarget.style.display = 'none';
                    }}
                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                  />
                </div>
              );
            })}
          {!projection.hasGeo && satBackdropProjection.tiles.length === 0 && null}
          <div className="absolute inset-0 bg-gradient-to-b from-[#071315]/85 via-[#071315]/35 to-[#071315]/90" />
        </div>
      )}

      {theme === 'MINIMAL_LIGHT' && (
        <div className="absolute inset-0 bg-gradient-to-b from-white to-[#F8FAFC]">
          <svg className="w-full h-full" viewBox="0 0 320 400">
            <defs>
              <pattern
                id="minimalLightGrid"
                width="26"
                height="26"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 26 0 L 0 0 0 26"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="320" height="400" fill="url(#minimalLightGrid)" />
          </svg>
        </div>
      )}

      {theme === 'CUSTOM_PHOTO' && (
        <>
          {!imgError ? (
            <img
              key={activePhotoSrc}
              src={activePhotoSrc}
              alt="Foto latar belakang perjalanan touring"
              referrerPolicy="no-referrer"
              onLoad={() => setImgError(false)}
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, #312E81 0%, #9A3412 48%, #090D16 100%)',
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/90" />
        </>
      )}

      {/* 2. Foreground Content Layer */}
      <div className="relative z-10 h-full p-4 flex flex-col justify-between">
        {/* Brand Header & Tour Leader Avatar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-[9px] bg-[#EA580C] text-white flex items-center justify-center shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-extrabold leading-tight ${primaryText}`}>
                KonvoiKu
              </p>
              <p className={`text-[10px] font-mono leading-tight ${secondaryText}`}>
                {trip.roomId}
              </p>
            </div>
          </div>

          {leader && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-right min-w-0">
                <p
                  className={`text-[11px] font-semibold truncate max-w-[100px] ${primaryText}`}
                >
                  {leader.fullName}
                </p>
                <p
                  className={`text-[10px] font-medium ${
                    isLight ? 'text-[#1D4ED8]' : 'text-[#FDBA74]'
                  }`}
                >
                  Tour Leader
                </p>
              </div>
              <ConvoyAvatar
                preset={leader.avatarPreset}
                photoUrl={leader.avatarPhotoUrl}
                name={leader.fullName}
                sizeClass="w-8 h-8"
                ringClass="ring-2 ring-[#EA580C]"
              />
            </div>
          )}
        </div>

        {/* Title & Date Metadata */}
        <div className="mt-2 space-y-0.5">
          <h3
            className={`text-base font-bold leading-snug line-clamp-2 ${primaryText}`}
          >
            {trip.tourTitle}
          </h3>
          <p className={`text-[11px] truncate ${secondaryText}`}>
            {trip.dateLabel} · {trip.destinationName}
          </p>
        </div>

        {/* Center Real-Shape Polyline Path */}
        <div
          ref={mapContainerRef}
          className={`relative flex-1 my-2 min-h-[135px] overflow-hidden ${
            theme === 'SATELLITE'
              ? 'rounded-2xl border border-white/15 bg-black/25'
              : ''
          }`}
        >
          {theme === 'SATELLITE' &&
            projection.hasGeo &&
            projection.tiles.map((tile) => {
              const satSrc = satTileTpl
                .replace('{z}', String(tile.z))
                .replace('{x}', String(tile.x))
                .replace('{y}', String(tile.y));
              const lblSrc = labelsTileTpl
                .replace('{z}', String(tile.z))
                .replace('{x}', String(tile.x))
                .replace('{y}', String(tile.y));
              return (
                <div
                  key={`box-${tile.key}`}
                  style={{
                    left: `${tile.left}px`,
                    top: `${tile.top}px`,
                    width: `${tile.size}px`,
                    height: `${tile.size}px`,
                  }}
                  className="absolute pointer-events-none"
                >
                  <img
                    src={satSrc}
                    alt=""
                    loading="lazy"
                    onError={(ev) => {
                      ev.currentTarget.style.display = 'none';
                    }}
                    className="w-full h-full max-w-none select-none"
                  />
                  <img
                    src={lblSrc}
                    alt=""
                    loading="lazy"
                    onError={(ev) => {
                      ev.currentTarget.style.display = 'none';
                    }}
                    className="absolute inset-0 w-full h-full max-w-none select-none opacity-85"
                  />
                </div>
              );
            })}

          <svg
            className="relative z-[1] w-full h-full"
            viewBox={`0 0 ${mapSize.width} ${mapSize.height}`}
          >
            {projection.waypoints.length >= 2 && (
              <>
                <polyline
                  points={polylinePts}
                  fill="none"
                  stroke={
                    isLight
                      ? 'rgba(147,197,253,0.55)'
                      : 'rgba(234,88,12,0.42)'
                  }
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={polylinePts}
                  fill="none"
                  stroke={isLight ? '#1D4ED8' : '#FB923C'}
                  strokeWidth="4.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {startPt && (
              <g>
                <circle cx={startPt.x} cy={startPt.y} r="7" fill="#FFFFFF" />
                <circle cx={startPt.x} cy={startPt.y} r="4.5" fill="#EA580C" />
              </g>
            )}

            {endPt && (
              <g>
                <circle cx={endPt.x} cy={endPt.y} r="7" fill="#FFFFFF" />
                <circle cx={endPt.x} cy={endPt.y} r="4.5" fill="#16A34A" />
              </g>
            )}
          </svg>

          {trip.visitedCheckpoints.map((cp, idx) => {
            const projectedCp = projection.checkpoints[idx];
            if (!projectedCp) return null;
            return (
              <div
                key={cp.id}
                style={{
                  left: `${(projectedCp.x / mapSize.width) * 100}%`,
                  top: `${(projectedCp.y / mapSize.height) * 100}%`,
                }}
                title={cp.name}
                className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#0F766E] border-2 border-white flex items-center justify-center text-white"
              >
                <Coffee className="w-2.5 h-2.5" />
              </div>
            );
          })}
        </div>

        {/* Bottom Stats Grid & Participants */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-4 gap-1.5">
            <div className="min-w-0">
              <p className={`text-[9px] ${secondaryText}`}>Jarak</p>
              <p
                className={`text-xs font-bold font-mono tabular-nums truncate ${primaryText}`}
              >
                {trip.distanceKm.toFixed(1)} km
              </p>
            </div>
            <div className="min-w-0">
              <p className={`text-[9px] ${secondaryText}`}>Durasi</p>
              <p
                className={`text-xs font-bold font-mono tabular-nums truncate ${primaryText}`}
              >
                {trip.durationLabel}
              </p>
            </div>
            <div className="min-w-0">
              <p className={`text-[9px] ${secondaryText}`}>Rata-rata</p>
              <p
                className={`text-xs font-bold font-mono tabular-nums truncate ${primaryText}`}
              >
                {trip.avgSpeedKmh} km/j
              </p>
            </div>
            <div className="min-w-0">
              <p className={`text-[9px] ${secondaryText}`}>Checkpoint</p>
              <p
                className={`text-xs font-bold font-mono tabular-nums truncate ${primaryText}`}
              >
                {trip.visitedCheckpoints.length} titik
              </p>
            </div>
          </div>

          <div
            className={`pt-2 border-t text-[10px] truncate ${
              isLight ? 'border-[#CBD5E1]' : 'border-white/20'
            } ${secondaryText}`}
          >
            {trip.participants.length} Peserta ·{' '}
            {trip.participants.map((p) => p.fullName).join(', ')}
          </div>
        </div>
      </div>
    </div>
  );
}
