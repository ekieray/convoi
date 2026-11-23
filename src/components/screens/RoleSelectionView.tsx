import { useState } from 'react';
import { ArrowRight, BadgeCheck, Bike, Car, CheckCircle2, History, Info, Link2, LogOut, Megaphone, Navigation, RotateCcw, ShieldCheck, UserCog, Users, Wrench, X } from 'lucide-react';
import { AuthProviderId, GlobalAppConfig, TourRoom, TripHistoryRecord, UserRole, VehicleProfile } from '../../types/convoy';
import { ConvoyAvatar } from '../ConvoyAvatar';
import {
  TouringCanvasBackdrop,
  TouringHeroBanner,
} from '../TouringAtmosphereBackdrop';

interface RoleSelectionViewProps {
  activeRoom: TourRoom | null;
  lastCompletedTrip?: TripHistoryRecord | null;
  destinationName: string;
  tripHistoryCount: number;
  latestTripTitle?: string;
  authUserEmail?: string | null;
  authUserName?: string | null;
  authProvider?: AuthProviderId;
  userProfile?: VehicleProfile;
  localUserName?: string | null;
  isSigningIn?: boolean;
  globalConfig?: GlobalAppConfig;
  isAdminUser?: boolean;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onOpenCustomizeProfile: () => void;
  onOpenAdminBackend?: () => void;
  onSelectRole: (role: UserRole) => void;
  onResumeCurrentConvoy: () => void;
  onRepeatTour?: (trip: TripHistoryRecord) => void;
  onOpenTripHistory: () => void;
  onOpenAboutApp: () => void;
}

const PROVIDER_TAG: Record<AuthProviderId, string> = {
  google: 'Google Sync',
  facebook: 'Facebook Sync',
  instagram: 'Instagram Sync',
  email: 'Email Sync',
  local: 'Email Lokal',
};

export function RoleSelectionView({
  activeRoom,
  lastCompletedTrip = null,
  destinationName,
  tripHistoryCount,
  latestTripTitle,
  authUserEmail,
  authUserName,
  authProvider = 'local',
  userProfile,
  localUserName,
  isSigningIn,
  globalConfig,
  isAdminUser = false,
  onGoogleSignIn,
  onGoogleSignOut,
  onOpenCustomizeProfile,
  onOpenAdminBackend,
  onSelectRole,
  onResumeCurrentConvoy,
  onRepeatTour,
  onOpenTripHistory,
  onOpenAboutApp,
}: RoleSelectionViewProps) {
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const roomCreationPaused = globalConfig?.allowNewRooms === false && !isAdminUser;
  const isConvoyFinished = !activeRoom && Boolean(lastCompletedTrip);
  const activeTourName =
    activeRoom?.roomTitle ||
    lastCompletedTrip?.tourTitle ||
    'Belum ada konvoi aktif';
  const activeMemberCount =
    activeRoom?.members.length ??
    Math.max(1, lastCompletedTrip?.participants.length ?? 0);
  const hasAnySession = Boolean(authUserEmail || localUserName);
  const displayName =
    userProfile?.fullName?.trim() || authUserName || localUserName || 'Pengendara KonvoiKu';
  const displayEmail =
    userProfile?.email?.trim() || authUserEmail || '';
  const metaSubtitle = [
    userProfile?.clubName?.trim(),
    userProfile?.homeCity?.trim(),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="relative flex flex-col min-h-full bg-transparent text-[#0F172A] dark:text-[#F1F5F9]">
      {/* Clean Material 3 Top App Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-4 py-3 bg-white/90 dark:bg-[#131B26]/90 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#2D3A4F]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-[#1D4ED8] flex items-center justify-center text-white shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight">KonvoiKu</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenTripHistory}
            className="px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/70 text-[#1D4ED8] dark:text-[#93C5FD] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#DBEAFE] transition-colors cursor-pointer whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>Riwayat ({tripHistoryCount})</span>
          </button>
          <button
            type="button"
            onClick={onOpenAboutApp}
            aria-label="Tentang Aplikasi"
            className="min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-[#1D4ED8] dark:text-[#93C5FD] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 px-4 py-5 space-y-4">
        <TouringCanvasBackdrop />

        <div className="relative z-10 space-y-4">
          {/* Atmospheric Touring Header */}
          <TouringHeroBanner
            title="Dashboard Konvoi Touring"
            subtitle="Koordinasi perjalanan mobil dan motor secara real-time dengan GPS, TomTom Maps & Sinkronisasi Room."
          />

          {/* Backend Maintenance & Announcement Banners */}
          {globalConfig?.maintenanceMode && (
            <div className="rounded-[18px] bg-[#FEF3C7] dark:bg-[#451A03]/70 border border-[#F59E0B] px-3.5 py-3 flex items-start gap-2.5 text-xs text-[#92400E] dark:text-[#FCD34D]">
              <Wrench className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
              <div>
                <p className="font-bold">Mode Pemeliharaan Aktif</p>
                <p className="mt-0.5 leading-relaxed">
                  {globalConfig.maintenanceMessage ||
                    'Sistem sedang dalam pemeliharaan oleh Admin.'}
                </p>
              </div>
            </div>
          )}

          {globalConfig?.announcementActive && globalConfig?.announcementMessage && (
            <div className="rounded-[18px] bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border border-[#BFDBFE] dark:border-[#2563EB] px-3.5 py-3 flex items-start gap-2.5 text-xs text-[#1E3A8A] dark:text-[#DBEAFE]">
              <Megaphone className="w-4 h-4 shrink-0 mt-0.5 text-[#1D4ED8] dark:text-[#60A5FA]" />
              <div>
                <p className="font-bold">{globalConfig.announcementTitle || 'Info KonvoiKu'}</p>
                <p className="mt-0.5 leading-relaxed">{globalConfig.announcementMessage}</p>
              </div>
            </div>
          )}

          {/* Account & Customize Profile Card */}
          <div className="rounded-[18px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <ConvoyAvatar
                  preset={userProfile?.avatarPreset || 'HELMET_TOURING'}
                  photoUrl={userProfile?.avatarPhotoUrl}
                  name={displayName}
                  sizeClass="w-11 h-11"
                  ringClass="ring-2 ring-[#1D4ED8]/70 dark:ring-[#60A5FA]/70"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{displayName}</p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                    {displayEmail
                      ? `${displayEmail} · ${PROVIDER_TAG[authProvider]}`
                      : 'Belum terhubung email · Customize untuk sinkronisasi'}
                  </p>
                  {metaSubtitle && (
                    <p className="text-[11px] font-medium text-[#1D4ED8] dark:text-[#93C5FD] truncate">
                      {metaSubtitle}
                    </p>
                  )}
                </div>
              </div>

              {hasAnySession && (
                <button
                  type="button"
                  onClick={onGoogleSignOut}
                  aria-label="Keluar Aplikasi"
                  className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Keluar</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenCustomizeProfile}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/60 text-[#1D4ED8] dark:text-[#93C5FD] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#DBEAFE] transition-colors cursor-pointer"
              >
                <UserCog className="w-3.5 h-3.5 shrink-0" />
                <span>Customize Profil</span>
              </button>

              {!authUserEmail && (
                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={onGoogleSignIn}
                  className="px-3 min-h-[40px] py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isSigningIn ? 'Memuat...' : 'Sync Google'}
                </button>
              )}
            </div>
          </div>

          {/* Admin Backend Console Quick Access (Only for ekie.ray@gmail.com) */}
          {isAdminUser && onOpenAdminBackend && (
            <button
              type="button"
              onClick={onOpenAdminBackend}
              className="w-full text-left rounded-[20px] bg-gradient-to-r from-[#1E3A8A] to-[#0F172A] text-white border border-[#3B82F6]/50 p-4 shadow-sm flex items-center gap-3 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
            >
              <div className="w-11 h-11 rounded-[13px] bg-white/15 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#93C5FD]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">Admin Backend Console</p>
                <p className="text-[11px] text-[#CBD5E1] truncate">
                  Pantau user aktif, room berjalan, &amp; atur konfigurasi global
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#93C5FD] shrink-0" />
            </button>
          )}

          {/* Card Header 1: Mulai Konvoi Baru */}
          <div className="rounded-[22px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[14px] bg-[#EFF6FF] dark:bg-[#1E3A8A] flex items-center justify-center gap-0.5 shrink-0">
              <Car className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA]" />
              <Bike className="w-4 h-4 text-[#EA580C] dark:text-[#FB923C]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight">
                Mulai Konvoi Baru
              </h2>
              <p className="text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA]">
                Tour Leader · Rute & Room Baru
              </p>
            </div>
          </div>

          <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
            {roomCreationPaused
              ? 'Pembuatan room konvoi baru sedang dijeda sementara oleh Admin Backend.'
              : 'Tentukan tujuan akhir, gambar jalur resmi, tambah titik istirahat, dan atur jarak sweeper.'}
          </p>

          <button
            type="button"
            disabled={roomCreationPaused}
            onClick={() => onSelectRole('TOUR_LEADER')}
            className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span className="whitespace-nowrap">
              {roomCreationPaused ? 'Pembuatan Room Dijeda Admin' : 'Mulai Konvoi Baru'}
            </span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Card Header 2: Gabung Konvoi */}
        <div className="rounded-[22px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[14px] bg-[#FFF7ED] dark:bg-[#7C2D12] flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5 text-[#EA580C] dark:text-[#FB923C]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight">Gabung Konvoi</h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Anggota · Kode Room atau Link
              </p>
            </div>
          </div>

          <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
            Masukkan Room ID atau tempel tautan undangan dari Tour Leader untuk langsung ikut konvoi.
          </p>

          <button
            type="button"
            onClick={() => onSelectRole('MEMBER')}
            className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span className="whitespace-nowrap">Gabung Konvoi</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Bagian "Konvoi Anda Saat Ini" / "Status Konvoi Terakhir" */}
        <div className="pt-1 space-y-2.5">
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            {activeRoom ? 'Konvoi Anda Saat Ini' : 'Status Konvoi Terakhir'}
          </h3>

          <div
            onClick={() => {
              if (activeRoom) {
                onResumeCurrentConvoy();
              } else if (lastCompletedTrip) {
                setShowCompletedModal(true);
              } else {
                onSelectRole('TOUR_LEADER');
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (activeRoom) {
                  onResumeCurrentConvoy();
                } else if (lastCompletedTrip) {
                  setShowCompletedModal(true);
                } else {
                  onSelectRole('TOUR_LEADER');
                }
              }
            }}
            className={`rounded-[18px] bg-white dark:bg-[#131B26] border p-3.5 flex items-center gap-3 transition-colors cursor-pointer ${
              activeRoom
                ? 'border-[#16A34A] dark:border-[#22C55E]/70 hover:border-[#15803D]'
                : 'border-[#E2E8F0] dark:border-[#2D3A4F] hover:border-[#1D4ED8]'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 ${
                isConvoyFinished
                  ? 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]'
                  : 'bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[#1D4ED8] dark:text-[#60A5FA]'
              }`}
            >
              {isConvoyFinished ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Users className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{activeTourName}</p>
              <p
                className={`text-xs font-medium truncate tabular-nums ${
                  activeRoom
                    ? 'text-[#15803D] dark:text-[#4ADE80]'
                    : 'text-[#475569] dark:text-[#94A3B8]'
                }`}
              >
                {activeRoom
                  ? `${activeMemberCount} Anggota Aktif · Sedang Berjalan`
                  : lastCompletedTrip
                    ? `${activeMemberCount} Peserta · Status: Selesai (${lastCompletedTrip.timeRangeLabel})`
                    : 'Belum ada konvoi aktif'}
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                {activeRoom
                  ? `Tujuan: ${destinationName}`
                  : lastCompletedTrip
                    ? `Tujuan: ${lastCompletedTrip.destinationName} · ${lastCompletedTrip.distanceKm.toFixed(1)} km`
                    : 'Pilih Mulai Konvoi Baru atau Gabung Konvoi'}
              </p>
            </div>

            <span
              className={`px-3 py-2 rounded-[10px] text-xs font-semibold shrink-0 ${
                isConvoyFinished
                  ? 'bg-[#E2E8F0] dark:bg-[#334155] text-[#334155] dark:text-[#E2E8F0]'
                  : 'bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[#1D4ED8] dark:text-[#DBEAFE]'
              }`}
            >
              {activeRoom ? 'Buka' : isConvoyFinished ? 'Selesai' : 'Mulai'}
            </span>
          </div>
        </div>

        {/* Modal Pilihan Konvoi Selesai */}
        {showCompletedModal && lastCompletedTrip && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="completed-tour-modal-title"
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => setShowCompletedModal(false)}
          >
            <div
              className="w-full max-w-[340px] rounded-[22px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] shadow-2xl p-4 space-y-3.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4
                    id="completed-tour-modal-title"
                    className="text-base font-bold text-[#0F172A] dark:text-white"
                  >
                    Konvoi Telah Selesai
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                    Pilih langkah selanjutnya untuk perjalanan ini
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCompletedModal(false)}
                  aria-label="Tutup dialog"
                  className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#2D3A4F] p-3 space-y-1">
                <p className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                  {lastCompletedTrip.tourTitle}
                </p>
                <p className="text-xs text-[#475569] dark:text-[#CBD5E1] truncate">
                  Tujuan: {lastCompletedTrip.destinationName}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {lastCompletedTrip.distanceKm.toFixed(1)} km · {lastCompletedTrip.durationLabel} · {lastCompletedTrip.timeRangeLabel}
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={roomCreationPaused}
                  onClick={() => {
                    setShowCompletedModal(false);
                    onRepeatTour?.(lastCompletedTrip);
                  }}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>
                    {roomCreationPaused ? 'Pembuatan Room Dijeda Admin' : 'Ulangi Tour'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCompletedModal(false);
                    onOpenTripHistory();
                  }}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/50 border border-[#BFDBFE] dark:border-[#3B82F6] text-[#1D4ED8] dark:text-[#93C5FD] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#DBEAFE] transition-colors cursor-pointer"
                >
                  <History className="w-4 h-4 shrink-0" />
                  <span>Masuk ke Riwayat Perjalanan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCompletedModal(false)}
                  className="w-full py-2 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bagian "Riwayat Tour & Ekspor Log" */}
        <div className="pt-1 space-y-2.5">
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Riwayat Tour & Ekspor Log
          </h3>

          <button
            type="button"
            onClick={onOpenTripHistory}
            className="w-full text-left rounded-[18px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-3.5 flex items-center gap-3 hover:border-[#EA580C] transition-colors cursor-pointer"
          >
            <div className="w-11 h-11 rounded-[12px] bg-[#FFF7ED] dark:bg-[#7C2D12] flex items-center justify-center text-[#EA580C] dark:text-[#FB923C] shrink-0">
              <History className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">
                Riwayat Perjalanan ({tripHistoryCount})
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                {latestTripTitle
                  ? `Terakhir: ${latestTripTitle}`
                  : 'Rekam jejak rute, statistik & ekspor GPX'}
              </p>
            </div>

            <ArrowRight className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
          </button>
        </div>

        {/* Bagian "Tentang Aplikasi & Kredit Pembuat" */}
        <div className="pt-1 space-y-2.5">
          <button
            type="button"
            onClick={onOpenAboutApp}
            className="w-full text-left rounded-[18px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-3.5 flex items-center gap-3 hover:border-[#1D4ED8] transition-colors cursor-pointer"
          >
            <div className="w-11 h-11 rounded-[12px] bg-[#EFF6FF] dark:bg-[#1E3A8A] flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] shrink-0">
              <BadgeCheck className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">Tentang Aplikasi</p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                App Created &amp; Designed by Kang Ekie
              </p>
            </div>

            <ArrowRight className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
          </button>
        </div>

        {/* Quiet Footer Credit */}
        <p className="pt-1 pb-2 text-center text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
          Created by Kang Ekie
        </p>
        </div>
      </div>
    </div>
  );
}
