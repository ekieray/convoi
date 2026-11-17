import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Car,
  Check,
  Coffee,
  Copy,
  Flag,
  Gauge,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Route,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  ConvoyRouteConfig,
  DestinationPreset,
  RoutePoint,
  TourRoom,
} from '../../types/convoy';
import { ConvoyAvatar } from '../ConvoyAvatar';

interface TourLeaderViewProps {
  activeRoom: TourRoom | null;
  routeConfig: ConvoyRouteConfig;
  destinationPresets: DestinationPreset[];
  onSelectPreset: (preset: DestinationPreset) => void;
  onPickDestinationFromMap: (
    xFraction: number,
    yFraction: number,
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

interface MapLandmark {
  name: string;
  address: string;
  xFraction: number;
  yFraction: number;
}

const REGIONAL_LANDMARKS: MapLandmark[] = [
  {
    name: 'Puncak Pass Resort',
    address: 'Jl. Raya Puncak KM 90, Cisarua',
    xFraction: 0.86,
    yFraction: 0.14,
  },
  {
    name: 'Taman Safari Cisarua',
    address: 'Jl. Kapten Harun Kabir No. 724',
    xFraction: 0.58,
    yFraction: 0.3,
  },
  {
    name: 'Rest Area KM 57',
    address: 'Tol Jakarta-Cikampek KM 57',
    xFraction: 0.82,
    yFraction: 0.46,
  },
  {
    name: 'Lembang Highland',
    address: 'Jl. Raya Lembang No. 12, Bandung',
    xFraction: 0.26,
    yFraction: 0.2,
  },
  {
    name: 'Simpang Gadog',
    address: 'Jl. Raya Ciawi - Gadog KM 45',
    xFraction: 0.34,
    yFraction: 0.66,
  },
  {
    name: 'Sentul Selatan Exit',
    address: 'Jl. MH Thamrin, Babakan Madang',
    xFraction: 0.72,
    yFraction: 0.68,
  },
];

export function TourLeaderView({
  activeRoom,
  routeConfig,
  destinationPresets,
  onSelectPreset,
  onPickDestinationFromMap,
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
  const routeCanvasRef = useRef<HTMLDivElement | null>(null);

  const handleCopy = async (text: string, type: 'id' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard fallback ignored
    }
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1800);
  };

  const handleCanvasTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!routeCanvasRef.current) return;
    const rect = routeCanvasRef.current.getBoundingClientRect();
    const nx = Math.max(0.1, Math.min(0.9, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0.1, Math.min(0.9, (e.clientY - rect.top) / rect.height));
    const newPt: RoutePoint = {
      xFraction: nx,
      yFraction: ny,
      latitude: -6.71 + (1 - ny) * 0.08,
      longitude: 106.85 + nx * 0.16,
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

  const polylinePts = routeConfig.waypoints
    .map((p) => `${p.xFraction * 320},${p.yFraction * 190}`)
    .join(' ');

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
                    Ketuk kanvas peta di bawah untuk menggambar titik belok jalur baru menuju{' '}
                    {routeConfig.destinationName}.
                  </p>

                  <div
                    ref={routeCanvasRef}
                    onClick={handleCanvasTap}
                    className="relative w-full h-[190px] rounded-[16px] bg-[#EEF2F6] dark:bg-[#141B22] border border-[#CBD5E1] dark:border-[#334155] overflow-hidden cursor-crosshair select-none"
                  >
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 320 190"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <pattern
                          id="stepperGrid"
                          width="28"
                          height="28"
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d="M 28 0 L 0 0 0 28"
                            fill="none"
                            stroke="currentColor"
                            className="text-[#DCE3EC] dark:text-[#212B36]"
                            strokeWidth="1"
                          />
                        </pattern>
                      </defs>
                      <rect width="320" height="190" fill="url(#stepperGrid)" />
                      {routeConfig.waypoints.length >= 2 && (
                        <>
                          <polyline
                            points={polylinePts}
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth="11"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <polyline
                            points={polylinePts}
                            fill="none"
                            stroke="#1D4ED8"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </>
                      )}
                      {routeConfig.waypoints.map((pt, idx) => {
                        const fill =
                          idx === 0
                            ? '#EA580C'
                            : idx === routeConfig.waypoints.length - 1
                              ? '#16A34A'
                              : '#1D4ED8';
                        return (
                          <g key={`${idx}-${pt.xFraction}`}>
                            <circle
                              cx={pt.xFraction * 320}
                              cy={pt.yFraction * 190}
                              r="7"
                              fill="#FFFFFF"
                            />
                            <circle
                              cx={pt.xFraction * 320}
                              cy={pt.yFraction * 190}
                              r="4.5"
                              fill={fill}
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    {routeConfig.waypoints.length} titik jalur aktif · Oranye = Start, Hijau = Tujuan
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
                    onClick={() =>
                      onCreateRoom(
                        tourNameDraft.trim() || 'Konvoi Touring Akhir Pekan'
                      )
                    }
                    className="flex-1 min-h-[46px] rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Buat Room & Mulai</span>
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
                  <button
                    type="button"
                    onClick={onSimulateJoin}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-[#1D4ED8] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>Simulasi Anggota</span>
                  </button>
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
        <div className="sticky bottom-0 px-4 py-3.5 bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155]">
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
        <DestinationMapPickerModal
          initialPoint={
            routeConfig.waypoints[routeConfig.waypoints.length - 1] || {
              xFraction: 0.86,
              yFraction: 0.14,
              latitude: -6.645,
              longitude: 106.99,
            }
          }
          initialName={routeConfig.destinationName}
          onDismiss={() => setShowDestinationPicker(false)}
          onConfirm={(x, y, placeName, addressLabel) => {
            onPickDestinationFromMap(x, y, placeName, addressLabel);
            setShowDestinationPicker(false);
          }}
        />
      )}
    </div>
  );
}

interface DestinationMapPickerModalProps {
  initialPoint: RoutePoint;
  initialName: string;
  onDismiss: () => void;
  onConfirm: (
    xFraction: number,
    yFraction: number,
    placeName: string,
    addressLabel: string
  ) => void;
}

function DestinationMapPickerModal({
  initialPoint,
  initialName,
  onDismiss,
  onConfirm,
}: DestinationMapPickerModalProps) {
  const [scale, setScale] = useState(1.25);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pin, setPin] = useState({
    xFraction: Math.max(0.08, Math.min(0.92, initialPoint.xFraction)),
    yFraction: Math.max(0.08, Math.min(0.9, initialPoint.yFraction)),
  });
  const [placeName, setPlaceName] = useState(initialName);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    basePanX: number;
    basePanY: number;
    movedDist: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    basePanX: 0,
    basePanY: 0,
    movedDist: 0,
  });

  const lat = -6.71 + (1 - pin.yFraction) * 0.08;
  const lng = 106.85 + pin.xFraction * 0.16;

  const findNearestLandmark = (x: number, y: number) => {
    let best = REGIONAL_LANDMARKS[0];
    let bestDist = Infinity;
    for (const lm of REGIONAL_LANDMARKS) {
      const dx = lm.xFraction - x;
      const dy = lm.yFraction - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = lm;
      }
    }
    return { landmark: best, distSq: bestDist };
  };

  const { landmark: nearest } = findNearestLandmark(pin.xFraction, pin.yFraction);
  const resolvedAddress = `${nearest.address} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  const clampPan = (nx: number, ny: number, currentScale: number) => {
    const el = viewportRef.current;
    if (!el) return { x: 0, y: 0 };
    const maxX = (el.clientWidth * (currentScale - 1)) / 2 + 40;
    const maxY = (el.clientHeight * (currentScale - 1)) / 2 + 40;
    return {
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    };
  };

  const updatePinFromClientXY = (clientX: number, clientY: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const mapX = ((relX - cx - pan.x) / scale + cx) / rect.width;
    const mapY = ((relY - cy - pan.y) / scale + cy) / rect.height;
    const clampedX = Math.max(0.08, Math.min(0.92, mapX));
    const clampedY = Math.max(0.08, Math.min(0.9, mapY));
    setPin({ xFraction: clampedX, yFraction: clampedY });

    const { landmark, distSq } = findNearestLandmark(clampedX, clampedY);
    setPlaceName(distSq < 0.025 ? landmark.name : `Area ${landmark.name}`);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      basePanX: pan.x,
      basePanY: pan.y,
      movedDist: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.movedDist = Math.max(
      dragRef.current.movedDist,
      Math.hypot(dx, dy)
    );
    setPan(clampPan(dragRef.current.basePanX + dx, dragRef.current.basePanY + dy, scale));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const moved = dragRef.current.movedDist;
    dragRef.current.active = false;
    if (moved < 6) {
      updatePinFromClientXY(e.clientX, e.clientY);
    }
  };

  const adjustZoom = (delta: number) => {
    setScale((prev) => {
      const next = Math.max(1, Math.min(3, Number((prev + delta).toFixed(2))));
      setPan((p) => (next === 1 ? { x: 0, y: 0 } : clampPan(p.x, p.y, next)));
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[390px] h-[640px] max-h-[92vh] rounded-[24px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-2xl overflow-hidden flex flex-col">
        {/* Top Modal Header */}
        <div className="px-3.5 py-2.5 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate">
              Pilih Tujuan Akhir di Peta
            </h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
              Geser, perbesar, lalu ketuk peta untuk menaruh pin
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Tutup Peta"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Pan & Zoom Map Canvas */}
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={(e) => {
            e.preventDefault();
            adjustZoom(e.deltaY < 0 ? 0.25 : -0.25);
          }}
          className="relative flex-1 bg-[#E9EFF5] dark:bg-[#0F172A] overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
        >
          {/* Zoom Indicator */}
          <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-[#0F172A]/80 text-white text-[10px] font-medium pointer-events-none">
            Zoom {scale.toFixed(1)}x · Ketuk untuk taruh pin
          </div>

          {/* Zoom & Reset Controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => adjustZoom(0.35)}
              aria-label="Perbesar peta"
              className="w-9 h-9 rounded-xl bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] shadow-md flex items-center justify-center hover:bg-[#F8FAFC] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(-0.35)}
              aria-label="Perkecil peta"
              className="w-9 h-9 rounded-xl bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] shadow-md flex items-center justify-center hover:bg-[#F8FAFC] cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setScale(1);
                setPan({ x: 0, y: 0 });
              }}
              aria-label="Reset tampilan peta"
              className="w-9 h-9 rounded-xl bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] shadow-md flex items-center justify-center hover:bg-[#F8FAFC] cursor-pointer"
            >
              <LocateFixed className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA]" />
            </button>
          </div>

          {/* Transformed Map Surface */}
          <div
            className="absolute inset-0 origin-center transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            <svg
              className="w-full h-full"
              viewBox="0 0 360 380"
              preserveAspectRatio="none"
            >
              <defs>
                <pattern
                  id="pickerGrid"
                  width="32"
                  height="32"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 32 0 L 0 0 0 32"
                    fill="none"
                    stroke="currentColor"
                    className="text-[#D4DFEA] dark:text-[#1E293B]"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="360" height="380" fill="url(#pickerGrid)" />

              {/* Major Corridor */}
              <polyline
                points="43,334 122,250 208,114 310,53"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="43,334 122,250 208,114 310,53"
                fill="none"
                stroke="#93C5FD"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Secondary Corridor */}
              <polyline
                points="122,250 259,258 295,175"
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Regional Landmarks */}
            {REGIONAL_LANDMARKS.map((lm) => (
              <button
                key={lm.name}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPin({ xFraction: lm.xFraction, yFraction: lm.yFraction });
                  setPlaceName(lm.name);
                }}
                style={{
                  left: `${lm.xFraction * 100}%`,
                  top: `${lm.yFraction * 100}%`,
                }}
                className="absolute -translate-x-1/2 translate-y-2 px-1.5 py-0.5 rounded-md bg-white/95 dark:bg-[#1E293B]/95 border border-[#CBD5E1] dark:border-[#475569] shadow-xs text-[9px] font-semibold text-[#1E293B] dark:text-[#F1F5F9] whitespace-nowrap cursor-pointer hover:border-[#1D4ED8]"
              >
                {lm.name}
              </button>
            ))}

            {/* Dropped Destination Pin Marker */}
            <div
              style={{
                left: `${pin.xFraction * 100}%`,
                top: `${pin.yFraction * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-full pointer-events-none flex flex-col items-center"
            >
              <div className="w-8 h-8 rounded-full bg-[#DC2626] border-2 border-white shadow-lg flex items-center justify-center">
                <Flag className="w-4 h-4 text-white" />
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-[#DC2626] -mt-0.5 border border-white" />
            </div>
          </div>
        </div>

        {/* Bottom Confirmation Sheet */}
        <div className="p-3.5 bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155] space-y-2.5">
          <div>
            <label
              htmlFor="pickerPlaceName"
              className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1] mb-1"
            >
              Nama Lokasi Tujuan
            </label>
            <input
              id="pickerPlaceName"
              type="text"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="Contoh: Puncak Pass Resort"
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#CBD5E1] dark:border-[#334155] focus:border-[#1D4ED8] text-xs outline-none"
            />
          </div>

          <p className="text-[10px] font-mono text-[#1D4ED8] dark:text-[#60A5FA] truncate">
            {resolvedAddress}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 min-h-[44px] rounded-xl border border-[#CBD5E1] dark:border-[#334155] text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() =>
                onConfirm(
                  pin.xFraction,
                  pin.yFraction,
                  placeName.trim() || 'Titik Tujuan Peta',
                  resolvedAddress
                )
              }
              className="flex-[1.6] min-h-[44px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Gunakan Lokasi Ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
