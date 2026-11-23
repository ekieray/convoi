import {
  ArrowLeft,
  BadgeCheck,
  Code2,
  MapPinned,
  Navigation,
  Radio,
  Route,
  ShieldAlert,
} from 'lucide-react';
import {
  TouringCanvasBackdrop,
  TouringHeroBanner,
} from '../TouringAtmosphereBackdrop';

interface AboutAppViewProps {
  onBack: () => void;
}

const FEATURES = [
  {
    icon: MapPinned,
    title: 'Pelacakan Peta Real-Time & ETA',
    description:
      'Pantau posisi seluruh peserta konvoi, avatar rider, jarak, dan estimasi waktu tiba.',
  },
  {
    icon: ShieldAlert,
    title: 'Deteksi Keluar Jalur, Tertinggal & SOS',
    description:
      'Peringatan cerdas jika peserta menyimpang, tertinggal di belakang Sweeper, atau darurat.',
  },
  {
    icon: Radio,
    title: 'Walkie-Talkie & Chat Grup Room',
    description:
      'Komunikasi cepat suara Push-to-Talk dan pesan teks antar peserta dalam satu room.',
  },
  {
    icon: Route,
    title: 'Riwayat Tour, Ekspor GPX & Kartu Rute',
    description:
      'Simpan jejak perjalanan ke GPX/JSON dan bagikan kartu rute visual ke media sosial.',
  },
];

export function AboutAppView({ onBack }: AboutAppViewProps) {
  return (
    <div className="relative flex flex-col min-h-full bg-transparent text-[#0F172A] dark:text-[#F1F5F9]">
      {/* Top App Bar */}
      <div className="sticky top-0 z-20 flex items-center gap-1.5 px-3 py-2.5 bg-white/90 dark:bg-[#131B26]/90 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#2D3A4F]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-bold truncate">Tentang Aplikasi</h2>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
            Informasi & Kredit Pengembang
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 px-4 py-4 space-y-4">
        <TouringCanvasBackdrop />

        <div className="relative z-10 space-y-4">
          <TouringHeroBanner
            title="KonvoiKu Touring"
            subtitle="Aplikasi pendamping konvoi mobil & motor dengan pelacakan langsung, peringatan keselamatan, walkie-talkie, dan kartu rute."
          />

          {/* Features Summary Card */}
          <div className="rounded-[20px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 space-y-3">
            <h3 className="text-sm font-bold">Fitur Utama Konvoi</h3>

            <div className="divide-y divide-[#E2E8F0] dark:divide-[#2D3A4F]">
              {FEATURES.map((item) => {
                const IconComp = item.icon;
                return (
                  <div
                    key={item.title}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[#1D4ED8] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-snug">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#475569] dark:text-[#CBD5E1] leading-relaxed mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Creator Credits Card */}
          <div className="rounded-[22px] bg-white dark:bg-[#131B26] border border-[#1D4ED8]/35 dark:border-[#60A5FA]/40 p-5 text-center space-y-2.5 shadow-xs">
            <div className="w-13 h-13 mx-auto rounded-full bg-[#EFF6FF] dark:bg-[#1E3A8A]/70 border-2 border-[#1D4ED8] dark:border-[#60A5FA] flex items-center justify-center text-[#1D4ED8] dark:text-[#93C5FD]">
              <BadgeCheck className="w-6 h-6" />
            </div>

            <div className="flex items-center justify-center gap-1.5">
              <Code2 className="w-4 h-4 text-[#EA580C] dark:text-[#FB923C] shrink-0" />
              <p className="text-sm font-bold tracking-tight text-[#0F172A] dark:text-white">
                App Created &amp; Designed by Kang Ekie
              </p>
            </div>

            <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
              Dirancang dengan Material Design 3 untuk kenyamanan dan keselamatan perjalanan konvoi bersama.
            </p>

            <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              <Navigation className="w-3.5 h-3.5 text-[#EA580C] dark:text-[#FB923C]" />
              <span>KonvoiKu Touring · Android Kotlin &amp; Jetpack Compose</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
