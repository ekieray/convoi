import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Car,
  Check,
  Cloud,
  Coffee,
  Copy,
  Flag,
  Gauge,
  Map as MapIcon,
  MapPin,
  Plus,
  RotateCcw,
  Route,
  Trash2,
  UserPlus,
} from 'lucide-react';
import {
  ConvoyRouteConfig,
  DestinationPreset,
  RoutePoint,
  TourRoom,
} from '../../types/convoy';
import { ConvoyAvatar } from '../ConvoyAvatar';
import { TomTomRoutePickerModal } from '../map/TomTomRoutePicker';
import { getTomTomTileUrl } from '../../services/tomtomMapService';
import { LatLngPoint } from '../../utils/geo';

interface TourLeaderViewProps {
  activeRoom: TourRoom | null;
  routeConfig: ConvoyRouteConfig;
  destinationPresets: DestinationPreset[];
  isAuthenticated?: boolean;
  isCreatingRoom?: boolean;
  userGpsLocation?: LatLngPoint | null;
  darkMode?: boolean;
  onGoogleSignIn?: () => void;
  onSelectPreset: (preset: DestinationPreset) => void;
  onPickDestinationLatLng: (
    lat: number,
    lng: number,
    placeName: string,
    addressLabel: string
  ) => void;
  onUpdateWaypoints: (waypoints: RoutePoint[]) => void;
  onResetDefaultWaypoints: () => void;
  onAddCheckpoint: (name: string, xFraction: number, yFraction: number) => void;
  onRemoveCheckpoint: (checkpointId: string) => void;
  onUpdateMaxStragglerDistance: (meters: number) => void;
  onToggleSoundAlert: () => void;
  onCreateRoom: (customTitle?: string) => void;
  onSimulateJoin: () => void;
  onRemoveMember: (memberId: string) => void;
  onEnterMapPlaceholder: () => void;
  onBack: () => void;
}

const STEP_LABELS = [
  { num: 1, label: 'Tujuan' },
  { num: 2, label: 'Jalur' },
  { num: 3, label: 'Istirahat' },
  { num: 4, label: 'Jarak' },
];

function TomTomStepRouteMap({
  waypoints,
  darkMode = false,
  onMapClick,
}: {
  waypoints: RoutePoint[];
  darkMode?: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const lastBoundsKeyRef = useRef<string>('');
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const first = waypoints[0];
    const center: [number, number] = first
      ? [first.latitude, first.longitude]
      : [-6.674, 106.925];

    const map = L.map(el, {
      center,
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    layerGroupRef.current = L.layerGroup().addTo(map);
    map.on('click', (ev: L.LeafletMouseEvent) => {
      onMapClickRef.current(ev.latlng.lat, ev.latlng.lng);
    });

    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    tileRef.current = L.tileLayer(
      getTomTomTileUrl('basic', darkMode ? 'night' : 'main'),
      { maxZoom: 19, tileSize: 256 }
    ).addTo(map);
  }, [darkMode]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (waypoints.length >= 2) {
      L.polyline(
        waypoints.map((pt) => [pt.latitude, pt.longitude] as [number, number]),
        { color: '#1D4ED8', weight: 5, opacity: 0.92 }
      ).addTo(group);
    }

    waypoints.forEach((pt, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === waypoints.length - 1;
      const html = isStart
        ? `<span style="transform:translate(-50%,-50%);display:inline-block;padding:2px 8px;border-radius:9999px;background:#EA580C;color:#fff;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">Start</span>`
        : isEnd
          ? `<span style="transform:translate(-50%,-50%);display:inline-block;padding:2px 8px;border-radius:9999px;background:#16A34A;color:#fff;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">Tujuan</span>`
          : `<span style="transform:translate(-50%,-50%);width:20px;height:20px;border-radius:9999px;background:#1D4ED8;color:#fff;font-size:9px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">${idx}</span>`;
      L.marker([pt.latitude, pt.longitude], {
        icon: L.divIcon({
          className: '',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          html,
        }),
        interactive: false,
      }).addTo(group);
    });

    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];
    const boundsKey =
      start && end
        ? `${start.latitude.toFixed(4)},${start.longitude.toFixed(4)}->${end.latitude.toFixed(4)},${end.longitude.toFixed(4)}`
        : '';
    if (boundsKey && boundsKey !== lastBoundsKeyRef.current) {
      lastBoundsKeyRef.current = boundsKey;
      const bounds = L.latLngBounds(
        waypoints.map((w) => [w.latitude, w.longitude] as [number, number])
      );
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
      }
    }
  }, [waypoints]);

  return <div ref={containerRef} className="w-full h-full cursor-crosshair" />;
}

export function TourLeaderView({
  activeRoom,
  routeConfig,
  destinationPresets,
  isAuthenticated,
  isCreatingRoom,
  userGpsLocation,
  darkMode,
  onGoogleSignIn,
  onSelectPreset,
  onPickDestinationLatLng,
  onUpdateWaypoints,
  onResetDefaultWaypoints,
  onAddCheckpoint,
  onRemoveCheckpoint,
  onUpdateMaxStragglerDistance,
  onToggleSoundAlert,
  onCreateRoom,
  onSimulateJoin,
  onRemoveMember,
  onEnterMapPlaceholder,
  onBack,
}: TourLeaderViewProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSetupStepper, setShowSetupStepper] = useState(!activeRoom);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [tourNameDraft, setTourNameDraft] = useState(
    activeRoom?.roomTitle || 'Konvoi Puncak Pass Weekend'
  );
  const [checkpointDraft, setCheckpointDraft] = useState('');
  const [copiedType, setCopiedType] = useState<'id' | 'link' | null>(null);

  const handleCopy = async (text: string, type: 'id' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard fallback ignored
    }
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1800);
  };

  const handleStepMapClick = (lat: number, lng: number) => {
    const newPt: RoutePoint = {
      xFraction: 0.5,
      yFraction: 0.5,
      latitude: lat,
      longitude: lng,
    };
    const pts = routeConfig.waypoints;
    const updated =
      pts.length >= 2
        ? [...pts.slice(0, pts.length - 1), newPt, pts[pts.length - 1]]
        : [...pts, newPt];
    onUpdateWaypoints(updated);
  };

  const kmValue = Math.max(
    0.5,
    Math.min(5.0, routeConfig.maxStragglerDistanceMeters / 1000)
  );

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC] dark:bg-[#0B1117] text-[#0F172A] dark:text-[#F1F5F9]">
      {/* Top App Bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155]">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali"
            className="min-w-[42px] min-h-[42px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">
              {showSetupStepper ? 'Buat Konvoi Baru' : 'Ruang Tour Leader'}
            </h2>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
              {showSetupStepper
                ? `Langkah ${currentStep + 1} dari 4 · ${STEP_LABELS[currentStep].label}`
                : 'Room ID & Peserta Konvoi'}
            </p>
          </div>
        </div>

        {activeRoom && (
          <button
            type="button"
            onClick={() => setShowSetupStepper((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 cursor-pointer whitespace-nowrap shrink-0"
          >
            {showSetupStepper ? 'Lihat Room' : 'Edit Rute'}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {showSetupStepper ? (
          <>
            {/* Stepper Header */}
            <div className="rounded-[18px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-2 grid grid-cols-4 gap-1.5">
              {STEP_LABELS.map((step, idx) => {
                const isActive = idx === currentStep;
                const isDone = idx < currentStep;
                return (
                  <button
                    key={step.num}
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    className={`py-2 px-1 rounded-[12px] flex flex-col items-center transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#1D4ED8] text-white'
                        : isDone
                          ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[#1D4ED8] dark:text-[#DBEAFE]'
                          : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]'
                    }`}
                  >
                    <span className="text-[11px] font-bold">
                      {isDone ? '✓' : step.num}
                    </span>
                    <span className="text-[11px] font-semibold truncate max-w-full">
                      {step.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Step Content Card */}
            <div className="rounded-[22px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-4 space-y-4">
              {currentStep === 0 && (
                <>
                  {!isAuthenticated && onGoogleSignIn && (
                    <div className="rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border border-[#BFDBFE] dark:border-[#1E40AF] p-2.5 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-[#1E3A8A] dark:text-[#DBEAFE] flex items-center gap-1.5 min-w-0">
                        <Cloud className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          Masuk Google agar Room bisa diikuti peserta lain live
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={onGoogleSignIn}
                        className="px-2.5 py-1 rounded-lg bg-[#1D4ED8] text-white text-[10px] font-semibold cursor-pointer shrink-0"
                      >
                        Masuk
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Flag className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA]" />
                    <h3 className="text-base font-bold">
                      1. Menentukan Tujuan Akhir
                    </h3>
                  </div>

                  <div>
                    <label
                      htmlFor="tourNameInput"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                    >
                      Nama Perjalanan / Tour
                    </label>
                    <input
                      id="tourNameInput"
                      type="text"
                      value={tourNameDraft}
                      onChange={(e) => setTourNameDraft(e.target.value)}
                      placeholder="Contoh: Konvoi Puncak Pass Weekend"
                      className="w-full min-h-[44px] px-3.5 rounded-[12px] bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#CBD5E1] dark:border-[#334155] focus:border-[#1D4ED8] text-sm outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                      Pilih Destinasi Utama
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {destinationPresets.map((preset) => {
                        const active = routeConfig.destinationName === preset.name;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => onSelectPreset(preset)}
                            className={`px-3 py-2.5 rounded-xl text-xs font-semibold border text-left truncate transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A] border-[#1D4ED8] text-[#1D4ED8] dark:text-[#DBEAFE]'
                                : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                            }`}
                          >
                            {preset.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDestinationPicker(true)}
                    className="w-full min-h-[46px] px-3.5 rounded-[14px] border-2 border-[#1D4ED8] dark:border-[#60A5FA] bg-[#EFF6FF]/60 dark:bg-[#1E3A8A]/25 hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/45 text-[#1D4ED8] dark:text-[#93C5FD] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>Pilih dari Peta (Pick on Map)</span>
                  </button>

                  {(() => {
                    const destPt =
                      routeConfig.waypoints[routeConfig.waypoints.length - 1];
                    return (
                      <div className="rounded-[14px] bg-[#EFF6FF] dark:bg-[#1E3A8A]/35 border border-[#BFDBFE] dark:border-[#1E40AF] p-3 flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                            {routeConfig.destinationName}
                          </p>
                          <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] line-clamp-2">
                            {routeConfig.destinationAddress}
                          </p>
                          {destPt && (
                            <p className="text-[10px] font-mono text-[#1D4ED8] dark:text-[#93C5FD]">
                              Koordinat: {destPt.latitude.toFixed(4)},{' '}
                              {destPt.longitude.toFixed(4)} · Estimasi{' '}
                              {Math.round(routeConfig.totalRouteMeters / 1000)} km
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {currentStep === 1 && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Route className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA]" />
                      <h3 className="text-base font-bold">
                        2. Gambar / Pilih Jalur
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={onResetDefaultWaypoints}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>

                  <p className="text-xs text-[#475569] dark:text-[#CBD5E1]">
                    Ketuk peta TomTom di bawah untuk menambahkan titik belok jalur baru menuju{' '}
                    {routeConfig.destinationName}.
                  </p>

                  <div className="relative w-full h-[220px] rounded-[16px] bg-[#EEF2F6] dark:bg-[#141B22] border border-[#CBD5E1] dark:border-[#334155] overflow-hidden">
                    <TomTomStepRouteMap
                      waypoints={routeConfig.waypoints}
                      darkMode={darkMode}
                      onMapClick={handleStepMapClick}
                    />
                  </div>

                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    {routeConfig.waypoints.length} titik jalur aktif di TomTom Maps · Oranye = Start, Hijau = Tujuan
                  </p>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <div className="flex items-center gap-2">
                    <Coffee className="w-5 h-5 text-[#0F766E]" />
                    <h3 className="text-base font-bold">
                      3. Titik Istirahat (Checkpoint)
                    </h3>
                  </div>

                  <div>
                    <label
                      htmlFor="stepCheckpointInput"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                    >
                      Nama Checkpoint / Rest Area
                    </label>
                    <input
                      id="stepCheckpointInput"
                      type="text"
                      value={checkpointDraft}
                      onChange={(e) => setCheckpointDraft(e.target.value)}
                      placeholder="Misal: Rest Area KM 57"
                      className="w-full min-h-[42px] px-3 rounded-[12px] bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#CBD5E1] dark:border-[#334155] focus:border-[#0F766E] text-xs outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {['SPBU Cisarua', 'Rumah Makan Sate Pak Budi'].map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setCheckpointDraft(sample)}
                        className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] text-[11px] font-medium text-[#334155] dark:text-[#CBD5E1] cursor-pointer"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const label = checkpointDraft.trim() || 'Rest Area KM 57';
                      const factor = Math.max(
                        0.25,
                        Math.min(0.78, 0.35 + routeConfig.checkpoints.length * 0.14)
                      );
                      onAddCheckpoint(label, factor, 1 - factor);
                      setCheckpointDraft('');
                    }}
                    className="w-full min-h-[44px] px-3 rounded-[12px] bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Titik Istirahat ke Rute</span>
                  </button>

                  {routeConfig.checkpoints.length > 0 && (
                    <div className="space-y-1.5">
                      {routeConfig.checkpoints.map((cp) => (
                        <div
                          key={cp.id}
                          className="rounded-xl bg-[#F0FDFA] dark:bg-[#042F2E]/40 border border-[#99F6E4] dark:border-[#115E59] px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Coffee className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">
                                {cp.name}
                              </p>
                              <p className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                                {cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveCheckpoint(cp.id)}
                            aria-label={`Hapus ${cp.name}`}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {currentStep === 3 && (
                <>
                  <div className="flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA]" />
                    <h3 className="text-base font-bold">
                      4. Batas Jarak Tertinggal
                    </h3>
                  </div>

                  <div className="rounded-[16px] bg-[#EFF6FF] dark:bg-[#1E3A8A]/50 p-4 space-y-1">
                    <p className="text-xs font-semibold text-[#1D4ED8] dark:text-[#93C5FD]">
                      Jarak Maksimal dari Sweeper
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-[#1E3A8A] dark:text-white">
                      {kmValue.toFixed(1)} km
                    </p>
                    <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1]">
                      Peringatan otomatis muncul bila jarak peserta paling belakang melewati batas ini.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <input
                      type="range"
                      aria-label="Slider Batas Jarak Tertinggal"
                      min="0.5"
                      max="5.0"
                      step="0.5"
                      value={kmValue}
                      onChange={(e) =>
                        onUpdateMaxStragglerDistance(
                          Math.round(parseFloat(e.target.value) * 1000)
                        )
                      }
                      className="w-full accent-[#EA580C] cursor-pointer h-2 rounded-lg"
                    />
                    <div className="flex justify-between text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                      <span>0.5 km</span>
                      <span>2.5 km</span>
                      <span>5.0 km</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div>
                      <p className="text-xs font-semibold">
                        Peringatan Suara Otomatis
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        Bunyikan nada peringatan saat tertinggal atau keluar jalur.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={routeConfig.soundAlertEnabled}
                      onClick={onToggleSoundAlert}
                      className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                        routeConfig.soundAlertEnabled
                          ? 'bg-[#1D4ED8]'
                          : 'bg-[#CBD5E1] dark:bg-[#334155]'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                          routeConfig.soundAlertEnabled
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="rounded-[14px] bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] p-3 flex items-center gap-2.5">
                    <Flag className="w-4 h-4 text-[#EA580C] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">
                        Tujuan Akhir: {routeConfig.destinationName}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                        {routeConfig.destinationAddress}
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="h-px bg-[#E2E8F0] dark:bg-[#334155]" />

              {/* Stepper Footer Actions */}
              <div className="flex items-center gap-2.5">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => s - 1)}
                    className="flex-1 min-h-[46px] rounded-[14px] border border-[#CBD5E1] dark:border-[#334155] text-xs font-semibold cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                )}
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((s) => s + 1)}
                    className="flex-1 min-h-[46px] rounded-[14px] bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Berikutnya</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isCreatingRoom}
                    onClick={() =>
                      onCreateRoom(
                        tourNameDraft.trim() || 'Konvoi Touring Akhir Pekan'
                      )
                    }
                    className="flex-1 min-h-[46px] rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {isCreatingRoom
                        ? 'Membuat Room...'
                        : isAuthenticated
                          ? 'Buat Room Cloud & Mulai'
                          : 'Buat Room & Mulai'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          activeRoom && (
            <>
              {/* Active Room Info Card */}
              <div className="rounded-[20px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {activeRoom.roomTitle}
                    </p>
                    <p className="text-2xl font-bold font-mono tracking-tight text-[#1D4ED8] dark:text-[#60A5FA]">
                      {activeRoom.roomId}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeRoom.roomId, 'id')}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#CBD5E1] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedType === 'id' ? (
                      <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedType === 'id' ? 'Disalin' : 'Salin ID'}</span>
                  </button>
                </div>

                <div className="h-px bg-[#E2E8F0] dark:bg-[#334155]" />

                <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] px-3.5 py-2.5">
                  <span className="text-xs font-mono truncate">
                    {activeRoom.inviteLink}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeRoom.inviteLink, 'link')}
                    aria-label="Salin Link"
                    className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] cursor-pointer shrink-0"
                  >
                    {copiedType === 'link' ? (
                      <Check className="w-4 h-4 text-[#16A34A]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      onCreateRoom(
                        tourNameDraft.trim() || 'Konvoi Touring Akhir Pekan'
                      )
                    }
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-[#CBD5E1] dark:border-[#334155] text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Buat ID Baru
                  </button>
                  {!activeRoom.isSyncedRoom && (
                    <button
                      type="button"
                      onClick={onSimulateJoin}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1D4ED8] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <UserPlus className="w-3.5 h-3.5 shrink-0" />
                      <span>Simulasi Anggota</span>
                    </button>
                  )}
                  {activeRoom.isSyncedRoom && (
                    <div className="min-h-[44px] px-3 py-2 rounded-xl bg-[#DCFCE7] dark:bg-[#064E3B] text-[#15803D] dark:text-[#4ADE80] text-xs font-semibold flex items-center justify-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 shrink-0" />
                      <span>Sync Cloud Aktif</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Member List */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold">
                  Daftar Sementara Anggota ({activeRoom.members.length})
                </h3>
                {activeRoom.members.map((member) => {
                  const isLeader = member.role === 'TOUR_LEADER';
                  return (
                    <div
                      key={member.id}
                      className="rounded-2xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-3.5 flex items-center gap-3"
                    >
                      <div className="relative shrink-0">
                        <ConvoyAvatar
                          preset={member.avatarPreset}
                          photoUrl={member.avatarPhotoUrl}
                          name={member.fullName}
                          sizeClass="w-10 h-10"
                          ringClass={
                            isLeader
                              ? 'ring-2 ring-[#1D4ED8]'
                              : 'ring-1 ring-[#CBD5E1] dark:ring-[#334155]'
                          }
                        />
                        <span
                          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-[#141C24] flex items-center justify-center ${
                            isLeader
                              ? 'bg-[#1D4ED8] text-white'
                              : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1]'
                          }`}
                        >
                          {member.vehicleType === 'MOBIL' ? (
                            <Car className="w-2.5 h-2.5" />
                          ) : (
                            <Bike className="w-2.5 h-2.5" />
                          )}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {member.fullName}
                        </p>
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">
                          {isLeader ? 'Tour Leader' : 'Anggota'} ·{' '}
                          {member.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor'} ·{' '}
                          <span className="font-mono">{member.licensePlate}</span>
                        </p>
                      </div>

                      {!isLeader && (
                        <button
                          type="button"
                          onClick={() => onRemoveMember(member.id)}
                          aria-label="Keluarkan anggota"
                          className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#DC2626] cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )
        )}
      </div>

      {/* Bottom CTA when viewing created room */}
      {!showSetupStepper && activeRoom && (
        <div className="sticky bottom-0 mt-auto px-4 pt-3.5 pb-[calc(2rem+env(safe-area-inset-bottom))] mb-2 bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155]">
          <button
            type="button"
            onClick={onEnterMapPlaceholder}
            className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <MapIcon className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Buka Peta Konvoi Live</span>
          </button>
        </div>
      )}

      {showDestinationPicker && (
        <TomTomRoutePickerModal
          initialPoint={
            routeConfig.waypoints[routeConfig.waypoints.length - 1] || {
              xFraction: 0.86,
              yFraction: 0.14,
              latitude: -6.645,
              longitude: 106.99,
            }
          }
          initialName={routeConfig.destinationName}
          userGpsLocation={userGpsLocation}
          darkMode={darkMode}
          onDismiss={() => setShowDestinationPicker(false)}
          onConfirm={(lat, lng, placeName, addressLabel) => {
            onPickDestinationLatLng(lat, lng, placeName, addressLabel);
            setShowDestinationPicker(false);
          }}
        />
      )}
    </div>
  );
}
