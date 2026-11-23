import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bike,
  Car,
  Check,
  Clock,
  Code2,
  Coffee,
  Copy,
  Download,
  Flag,
  Gauge,
  ImagePlus,
  Route,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import scenicTourPhoto from '../../assets/images/touring_route_backdrop_1794562249497.jpg';
import { getTomTomTileUrl } from '../../services/tomtomMapService';
import { TripCardTheme, TripHistoryRecord } from '../../types/convoy';
import { projectTripMapViewport } from '../../utils/geo';
import { renderTripCardPngBlob } from '../../utils/tripCardRenderer';
import {
  buildTripGpxXml,
  buildTripJsonLog,
  buildTripShareSummaryText,
  triggerFileDownload,
} from '../../utils/tripExport';
import { ConvoyAvatar } from '../ConvoyAvatar';
import { TripSummaryShareCard } from '../TripSummaryShareCard';

interface TripDetailViewProps {
  trip: TripHistoryRecord | null;
  autoFinishNotice?: string | null;
  onDismissAutoFinishNotice?: () => void;
  onBack: () => void;
}

const CARD_THEME_OPTIONS: Array<{ id: TripCardTheme; label: string }> = [
  { id: 'DARK_CARBON', label: 'Mode Gelap' },
  { id: 'SATELLITE', label: 'Peta Satelit' },
  { id: 'MINIMAL_LIGHT', label: 'Minimalis' },
  { id: 'CUSTOM_PHOTO', label: 'Foto Galeri' },
];

export function TripDetailView({
  trip,
  autoFinishNotice,
  onDismissAutoFinishNotice,
  onBack,
}: TripDetailViewProps) {
  const [showGpxPreview, setShowGpxPreview] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [sharePreviewText, setSharePreviewText] = useState<string | null>(null);
  const [cardTheme, setCardTheme] = useState<TripCardTheme>('DARK_CARBON');
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | undefined>(
    undefined
  );
  const [isRenderingCard, setIsRenderingCard] = useState(false);
  const [renderedCardModalUrl, setRenderedCardModalUrl] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (renderedCardModalUrl) {
        URL.revokeObjectURL(renderedCardModalUrl);
      }
    };
  }, [renderedCardModalUrl]);

  if (!trip) {
    return (
      <div className="flex flex-col min-h-full bg-[#F8FAFC] dark:bg-[#0B1117] text-[#0F172A] dark:text-[#F1F5F9]">
        <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-2.5 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kembali"
            className="min-w-[42px] min-h-[42px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-bold">Rekapitulasi Tour</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 text-xs text-[#64748B]">
          Data perjalanan tidak ditemukan.
        </div>
      </div>
    );
  }

  const gpxXml = buildTripGpxXml(trip);
  const jsonLog = buildTripJsonLog(trip);
  const shareSummary = buildTripShareSummaryText(trip);
  const mapWidth = 320;
  const mapHeight = 180;
  const projection = projectTripMapViewport(
    trip.waypoints,
    trip.visitedCheckpoints,
    mapWidth,
    mapHeight,
    0.15
  );
  const polylinePts = projection.waypoints
    .map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`)
    .join(' ');
  const startPt = projection.waypoints[0];
  const endPt = projection.waypoints[projection.waypoints.length - 1];
  const isDarkDocument =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');
  const roadTileTemplate = getTomTomTileUrl(
    'basic',
    isDarkDocument ? 'night' : 'main'
  );

  const showToast = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleExportGpx = () => {
    triggerFileDownload(
      `konvoiku-${trip.roomId.toLowerCase()}.gpx`,
      gpxXml,
      'application/gpx+xml'
    );
    showToast(
      `File konvoiku-${trip.roomId.toLowerCase()}.gpx diunduh (kompatibel Google Earth & Garmin).`
    );
  };

  const handleExportJson = () => {
    triggerFileDownload(
      `konvoiku-${trip.roomId.toLowerCase()}.json`,
      jsonLog,
      'application/json'
    );
    showToast(`Log konvoiku-${trip.roomId.toLowerCase()}.json berhasil diunduh.`);
  };

  const handleUploadGalleryPhoto = (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomPhotoUrl(reader.result);
        setCardTheme('CUSTOM_PHOTO');
        showToast('Foto perjalanan diterapkan ke kartu.');
      }
    };
    reader.readAsDataURL(file);
    ev.target.value = '';
  };

  const generatePngCardBlob = async () => {
    return renderTripCardPngBlob({
      trip,
      theme: cardTheme,
      customPhotoUrl,
      defaultScenicPhotoUrl: scenicTourPhoto,
    });
  };

  const handleShareCardImage = async () => {
    setIsRenderingCard(true);
    try {
      const blob = await generatePngCardBlob();
      const fileName = `konvoiku-card-${trip.roomId.toLowerCase()}.png`;
      const pngFile = new File([blob], fileName, { type: 'image/png' });

      const caption = `🏁 ${trip.tourTitle} (${trip.roomId})\nJarak: ${trip.distanceKm.toFixed(1)} km · Durasi: ${trip.durationLabel} · Kec. Rata-rata: ${trip.avgSpeedKmh} km/j`;

      if (
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [pngFile] })
      ) {
        try {
          await navigator.share({
            files: [pngFile],
            title: `Kartu Tour ${trip.tourTitle}`,
            text: caption,
          });
          showToast('Kartu PNG berhasil dibagikan.');
          return;
        } catch {
          // User dismissed or iframe denied Web Share; show in-app Share Sheet Preview
        }
      }

      if (renderedCardModalUrl) {
        URL.revokeObjectURL(renderedCardModalUrl);
      }
      setRenderedCardModalUrl(URL.createObjectURL(blob));
    } catch {
      showToast('Gagal merender kartu gambar PNG.');
    } finally {
      setIsRenderingCard(false);
    }
  };

  const handleDownloadCardPng = async () => {
    setIsRenderingCard(true);
    try {
      const blob = await generatePngCardBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `konvoiku-card-${trip.roomId.toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(
        `Kartu konvoiku-card-${trip.roomId.toLowerCase()}.png (1080×1350) tersimpan.`
      );
    } catch {
      showToast('Gagal menyimpan file PNG.');
    } finally {
      setIsRenderingCard(false);
    }
  };

  const handleShareSummary = async () => {
    try {
      await navigator.clipboard.writeText(shareSummary);
    } catch {
      // Clipboard fallback handled by preview modal
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rekap Tour ${trip.tourTitle}`,
          text: shareSummary,
        });
        showToast('Ringkasan tour dibagikan.');
        return;
      } catch {
        // User cancelled or share unavailable in iframe
      }
    }
    setSharePreviewText(shareSummary);
    showToast(
      'Ringkasan tour disalin & siap dibagikan ke WhatsApp / Sosial Media.'
    );
  };

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC] dark:bg-[#0B1117] text-[#0F172A] dark:text-[#F1F5F9]">
      {/* Top App Bar */}
      <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-2.5 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className="min-w-[42px] min-h-[42px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-bold truncate">{trip.tourTitle}</h2>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate font-mono">
            {trip.roomId} · {trip.dateLabel}
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div className="px-4 py-2 bg-[#ECFDF5] dark:bg-[#064E3B] border-b border-[#A7F3D0] dark:border-[#047857] text-[#065F46] dark:text-[#A7F3D0] text-[11px] font-medium flex items-center gap-2">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {autoFinishNotice && (
          <div className="rounded-[16px] bg-[#ECFDF5] dark:bg-[#064E3B]/60 border border-[#A7F3D0] dark:border-[#047857] px-3.5 py-2.5 flex items-center gap-2.5 text-[#065F46] dark:text-[#A7F3D0]">
            <Flag className="w-4 h-4 shrink-0 text-[#15803D] dark:text-[#4ADE80]" />
            <span className="text-[11px] font-medium flex-1 leading-relaxed">
              {autoFinishNotice}
            </span>
            {onDismissAutoFinishNotice && (
              <button
                type="button"
                onClick={onDismissAutoFinishNotice}
                className="text-[11px] font-semibold text-[#047857] dark:text-[#6EE7B7] cursor-pointer shrink-0"
              >
                Tutup
              </button>
            )}
          </div>
        )}
        {/* 0. Strava-Style Trip Summary Card & Social Share Studio */}
        <div className="rounded-[20px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-4 space-y-3.5">
          <div>
            <h3 className="text-sm font-bold">Kartu Rute Perjalanan</h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
              Kustomisasi latar belakang kartu lalu ekspor sebagai gambar PNG (1080×1350) untuk Instagram Story, WhatsApp, atau TikTok.
            </p>
          </div>

          <TripSummaryShareCard
            trip={trip}
            theme={cardTheme}
            customPhotoUrl={customPhotoUrl}
            defaultScenicPhotoUrl={scenicTourPhoto}
          />

          {/* Theme Customization Selector */}
          <div className="grid grid-cols-2 gap-1.5">
            {CARD_THEME_OPTIONS.map((opt) => {
              const active = cardTheme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCardTheme(opt.id)}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white'
                      : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155] text-[#334155] dark:text-[#CBD5E1] hover:border-[#1D4ED8]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Custom Gallery Photo Picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUploadGalleryPhoto}
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 min-h-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ImagePlus className="w-4 h-4 shrink-0 text-[#1D4ED8] dark:text-[#60A5FA]" />
              <span>
                {customPhotoUrl ? 'Ganti Foto Galeri' : 'Tambah Foto Galeri'}
              </span>
            </button>

            {customPhotoUrl && (
              <button
                type="button"
                aria-label="Hapus foto kustom"
                onClick={() => {
                  setCustomPhotoUrl(undefined);
                  showToast('Foto kustom dihapus, kembali ke foto bawaan.');
                }}
                className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#334155] hover:bg-[#FEE2E2] hover:border-[#FCA5A5] text-[#DC2626] flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Primary CTA: Bagikan Kartu Tour (Share Image) */}
          <button
            type="button"
            disabled={isRenderingCard}
            onClick={handleShareCardImage}
            className="w-full min-h-[48px] px-4 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 shrink-0" />
            <span>
              {isRenderingCard
                ? 'Merender Kartu PNG...'
                : 'Bagikan Kartu Tour (Share Image)'}
            </span>
          </button>

          <button
            type="button"
            disabled={isRenderingCard}
            onClick={handleDownloadCardPng}
            className="w-full min-h-[44px] px-4 rounded-[14px] border border-[#CBD5E1] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] disabled:opacity-60 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Simpan Kartu ke Galeri (.PNG)</span>
          </button>
        </div>

        {/* 1. Mini Polyline Track Replay Map */}
        <div className="rounded-[20px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Peta Rekam Jejak Rute</h3>
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                {projection.hasGeo
                  ? 'Mengikuti jalur nyata yang ditempuh di atas peta TomTom'
                  : 'Rekaman jalur perjalanan'}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-[#1E3A8A]/60 text-[#1D4ED8] dark:text-[#93C5FD] text-[10px] font-mono font-semibold shrink-0">
              {trip.waypoints.length} Titik GPS
            </span>
          </div>

          <div className="relative w-full aspect-[16/9] rounded-[16px] bg-[#EEF2F6] dark:bg-[#141B22] border border-[#CBD5E1] dark:border-[#334155] overflow-hidden">
            {/* Fallback topographic grid underneath tiles */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 320 180"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <pattern
                  id="tripReplayGrid"
                  width="26"
                  height="26"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 26 0 L 0 0 0 26"
                    fill="none"
                    stroke="currentColor"
                    className="text-[#DCE3EC] dark:text-[#212B36]"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="320" height="180" fill="url(#tripReplayGrid)" />
            </svg>

            {/* Real TomTom Map Tiles aligned 1:1 with the traveled GPS route */}
            {projection.hasGeo &&
              projection.tiles.map((tile) => {
                const tileSrc = roadTileTemplate
                  .replace('{z}', String(tile.z))
                  .replace('{x}', String(tile.x))
                  .replace('{y}', String(tile.y));
                return (
                  <img
                    key={tile.key}
                    src={tileSrc}
                    alt=""
                    loading="lazy"
                    onError={(ev) => {
                      ev.currentTarget.style.display = 'none';
                    }}
                    style={{
                      left: `${(tile.left / mapWidth) * 100}%`,
                      top: `${(tile.top / mapHeight) * 100}%`,
                      width: `${(tile.size / mapWidth) * 100}%`,
                      height: `${(tile.size / mapHeight) * 100}%`,
                    }}
                    className="absolute max-w-none pointer-events-none select-none"
                  />
                );
              })}

            {/* Route Polyline SVG Overlay */}
            <svg
              className="relative z-[1] w-full h-full"
              viewBox="0 0 320 180"
              preserveAspectRatio="xMidYMid meet"
            >
              {projection.waypoints.length >= 2 && (
                <>
                  <polyline
                    points={polylinePts}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="8.5"
                    strokeOpacity="0.92"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={polylinePts}
                    fill="none"
                    stroke="#EA580C"
                    strokeWidth="4.2"
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

            {/* Checkpoint Coffee Pins */}
            {trip.visitedCheckpoints.map((cp, idx) => {
              const projectedCp = projection.checkpoints[idx];
              if (!projectedCp) return null;
              return (
                <div
                  key={cp.id}
                  style={{
                    left: `${(projectedCp.x / mapWidth) * 100}%`,
                    top: `${(projectedCp.y / mapHeight) * 100}%`,
                  }}
                  title={cp.name}
                  className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0F766E] border-2 border-white shadow-sm flex items-center justify-center text-white"
                >
                  <Coffee className="w-3 h-3" />
                </div>
              );
            })}

            <div className="absolute z-[2] bottom-2 left-2 px-2 py-0.5 rounded-md bg-[#0F172A]/80 text-white text-[9px] font-medium">
              Oranye: Start · Hijau: Finish · Teal: Rest Area
            </div>
          </div>

          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
            Tujuan: <span className="font-semibold text-[#0F172A] dark:text-white">{trip.destinationName}</span> · {trip.destinationAddress}
          </p>
        </div>

        {/* 2. Statistics Grid */}
        <div className="rounded-[20px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-4 space-y-3">
          <h3 className="text-sm font-bold">Statistik Kecepatan & Jarak</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                <Route className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Total Jarak</span>
              </div>
              <p className="mt-1 text-base font-bold font-mono tabular-nums">
                {trip.distanceKm.toFixed(1)} km
              </p>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                <Clock className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Durasi Total</span>
              </div>
              <p className="mt-1 text-base font-bold font-mono tabular-nums">
                {trip.durationLabel}
              </p>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                <Gauge className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Kec. Rata-rata</span>
              </div>
              <p className="mt-1 text-base font-bold font-mono tabular-nums">
                {trip.avgSpeedKmh} km/j
              </p>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                <Flag className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Kec. Puncak</span>
              </div>
              <p className="mt-1 text-base font-bold font-mono tabular-nums">
                {trip.maxSpeedKmh} km/j
              </p>
            </div>
          </div>
        </div>

        {/* 3. Export GPX / JSON & Share Tour Summary */}
        <div className="rounded-[20px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-4 space-y-3">
          <div>
            <h3 className="text-sm font-bold">Ekspor Data & Bagikan</h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              Unduh file GPX/JSON untuk Google Earth, Maps, atau Garmin, atau bagikan rekap konvoi ke WhatsApp.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportGpx}
            className="w-full min-h-[46px] px-4 rounded-[14px] bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Ekspor Rute (.GPX)</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportJson}
              className="min-h-[44px] px-3 rounded-[14px] border border-[#CBD5E1] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Code2 className="w-4 h-4 shrink-0" />
              <span>Ekspor JSON</span>
            </button>

            <button
              type="button"
              onClick={handleShareSummary}
              className="min-h-[44px] px-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Bagikan Tour</span>
            </button>
          </div>

          {sharePreviewText && (
            <div className="rounded-xl bg-[#FFF7ED] dark:bg-[#431407]/50 border border-[#FDBA74] dark:border-[#9A3412] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#9A3412] dark:text-[#FDBA74]">
                  Teks Ringkasan Siap Kirim (WhatsApp / Sosmed)
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(sharePreviewText);
                    } catch {
                      // ignore
                    }
                    showToast('Teks ringkasan disalin.');
                  }}
                  className="text-[10px] font-semibold text-[#EA580C] flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin</span>
                </button>
              </div>
              <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-sans text-[#431407] dark:text-[#FED7AA]">
                {sharePreviewText}
              </pre>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowGpxPreview((prev) => !prev)}
            className="text-[11px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
          >
            {showGpxPreview ? 'Sembunyikan Pratinjau GPX' : 'Lihat Pratinjau GPX 1.1 XML'}
          </button>

          {showGpxPreview && (
            <pre className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] p-3 text-[10px] font-mono overflow-x-auto leading-relaxed">
              {gpxXml}
            </pre>
          )}
        </div>

        {/* 4. Checkpoints Visited */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold">
            Titik Istirahat Dikunjungi ({trip.visitedCheckpoints.length})
          </h3>
          {trip.visitedCheckpoints.length === 0 ? (
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Tidak ada titik istirahat tercatat pada tour ini.
            </p>
          ) : (
            <div className="space-y-2">
              {trip.visitedCheckpoints.map((cp) => (
                <div
                  key={cp.id}
                  className="rounded-2xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-[#F0FDFA] dark:bg-[#042F2E] text-[#0F766E] dark:text-[#2DD4BF] flex items-center justify-center shrink-0">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{cp.name}</p>
                    <p className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                      {cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-[#0F766E] dark:text-[#2DD4BF] shrink-0">
                    {cp.arrivedAtLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Participants */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold">
            Peserta Konvoi ({trip.participants.length})
          </h3>
          <div className="space-y-2">
            {trip.participants.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-3 flex items-center gap-3"
              >
                <ConvoyAvatar
                  preset={p.avatarPreset}
                  photoUrl={p.avatarPhotoUrl}
                  name={p.fullName}
                  sizeClass="w-9 h-9"
                  ringClass={
                    p.role === 'TOUR_LEADER'
                      ? 'ring-2 ring-[#1D4ED8]'
                      : 'ring-1 ring-[#CBD5E1] dark:ring-[#334155]'
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{p.fullName}</p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                    {p.isSweeper
                      ? 'Sweeper'
                      : p.role === 'TOUR_LEADER'
                        ? 'Tour Leader'
                        : 'Anggota'}{' '}
                    · {p.vehicleDetail} ·{' '}
                    <span className="font-mono">{p.licensePlate}</span>
                  </p>
                </div>
                {p.vehicleType === 'MOBIL' ? (
                  <Car className="w-4 h-4 text-[#64748B] shrink-0" />
                ) : (
                  <Bike className="w-4 h-4 text-[#64748B] shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rendered PNG Share Sheet Preview Modal */}
      {renderedCardModalUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bagikan Kartu Tour"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
        >
          <div className="w-full max-w-[360px] rounded-[24px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold">Kartu Siap Dibagikan</h4>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  PNG 1080×1350 · Instagram Story · WhatsApp · TikTok
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => setRenderedCardModalUrl(null)}
                className="min-w-[40px] min-h-[40px] rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-[18px] overflow-hidden border border-[#E2E8F0] dark:border-[#334155] bg-[#0B1117]">
              <img
                src={renderedCardModalUrl}
                alt="Pratinjau PNG Kartu Rute KonvoiKu"
                className="w-full max-h-[340px] object-contain mx-auto"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = renderedCardModalUrl;
                  a.download = `konvoiku-card-${trip.roomId.toLowerCase()}.png`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  showToast('Gambar PNG diunduh ke perangkat Anda.');
                }}
                className="min-h-[44px] px-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Unduh PNG</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareSummary);
                  } catch {
                    // Ignore
                  }
                  showToast('Caption tour disalin ke clipboard.');
                }}
                className="min-h-[44px] px-3 rounded-xl border border-[#CBD5E1] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-4 h-4 shrink-0" />
                <span>Salin Caption</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
