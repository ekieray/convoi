import { ArrowRight, BadgeCheck, Bike, Car, History, Info, Link2, Navigation, Users } from 'lucide-react';
import { TourRoom, UserRole } from '../../types/convoy';
import {
  TouringCanvasBackdrop,
  TouringHeroBanner,
} from '../TouringAtmosphereBackdrop';

interface RoleSelectionViewProps {
  activeRoom: TourRoom | null;
  destinationName: string;
  tripHistoryCount: number;
  latestTripTitle?: string;
  onSelectRole: (role: UserRole) => void;
  onResumeCurrentConvoy: () => void;
  onOpenTripHistory: () => void;
  onOpenAboutApp: () => void;
}

export function RoleSelectionView({
  activeRoom,
  destinationName,
  tripHistoryCount,
  latestTripTitle,
  onSelectRole,
  onResumeCurrentConvoy,
  onOpenTripHistory,
  onOpenAboutApp,
}: RoleSelectionViewProps) {
  const activeTourName = activeRoom?.roomTitle || 'Konvoi Puncak Pass Weekend';
  const activeMemberCount = activeRoom?.members.length ?? 4;
  const activeStatus = activeRoom ? 'Sedang Berjalan' : 'Siap Bergabung';

  return (
    <div className="relative flex flex-col min-h-full bg-[#F4F6FA] dark:bg-[#0A0F16] text-[#0F172A] dark:text-[#F1F5F9]">
      {/* Clean Material 3 Top App Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-[#131B26] border-b border-[#E2E8F0] dark:border-[#2D3A4F]">
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
            subtitle="Koordinasi perjalanan mobil dan motor secara real-time dalam satu layar bersih."
          />

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
            Tentukan tujuan akhir, gambar jalur resmi, tambah titik istirahat, dan atur jarak sweeper.
          </p>

          <button
            type="button"
            onClick={() => onSelectRole('TOUR_LEADER')}
            className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span className="whitespace-nowrap">Mulai Konvoi Baru</span>
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

        {/* Bagian "Konvoi Anda Saat Ini" */}
        <div className="pt-1 space-y-2.5">
          <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Konvoi Anda Saat Ini
          </h3>

          <div
            onClick={onResumeCurrentConvoy}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onResumeCurrentConvoy();
              }
            }}
            className="rounded-[18px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-3.5 flex items-center gap-3 hover:border-[#1D4ED8] transition-colors cursor-pointer"
          >
            <div className="w-11 h-11 rounded-[12px] bg-[#EFF6FF] dark:bg-[#1E3A8A] flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] shrink-0">
              <Users className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{activeTourName}</p>
              <p className="text-xs font-medium text-[#15803D] dark:text-[#4ADE80] truncate tabular-nums">
                {activeMemberCount} Anggota Aktif · {activeStatus}
              </p>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                Tujuan: {destinationName}
              </p>
            </div>

            <span className="px-3 py-2 rounded-[10px] bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[#1D4ED8] dark:text-[#DBEAFE] text-xs font-semibold shrink-0">
              Buka
            </span>
          </div>
        </div>

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
