import { useState, FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Cloud,
  Info,
  MapPin,
  Navigation,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import {
  TouringCanvasBackdrop,
  TouringHeroBanner,
} from '../TouringAtmosphereBackdrop';

interface LoginViewProps {
  authUserEmail?: string | null;
  authUserName?: string | null;
  localUserName?: string | null;
  isSigningIn?: boolean;
  authError?: string | null;
  initialName?: string;
  onGoogleSignIn: () => void;
  onLocalLogin: (fullName: string, email: string) => void;
  onContinueSession: () => void;
  onOpenAboutApp: () => void;
}

export function LoginView({
  authUserEmail,
  authUserName,
  localUserName,
  isSigningIn = false,
  authError,
  initialName = '',
  onGoogleSignIn,
  onLocalLogin,
  onContinueSession,
  onOpenAboutApp,
}: LoginViewProps) {
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const hasActiveAccount = Boolean(authUserEmail || localUserName);

  const handleLocalSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (cleanName.length < 2) {
      setFormError('Masukkan nama lengkap pengendara (minimal 2 karakter).');
      return;
    }
    if (cleanEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
      setFormError('Format email tidak valid atau kosongkan jika tidak dipakai.');
      return;
    }

    setFormError(null);
    onLocalLogin(cleanName, cleanEmail);
  };

  return (
    <div className="relative flex flex-col min-h-full bg-[#F4F6FA] dark:bg-[#0A0F16] text-[#0F172A] dark:text-[#F1F5F9]">
      {/* Clean Top Bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-[#131B26] border-b border-[#E2E8F0] dark:border-[#2D3A4F]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-[#1D4ED8] flex items-center justify-center text-white shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight">KonvoiKu</span>
        </div>

        <button
          type="button"
          onClick={onOpenAboutApp}
          aria-label="Tentang Aplikasi"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#1D4ED8] dark:text-[#93C5FD] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="relative flex-1 px-4 py-5 space-y-4">
        <TouringCanvasBackdrop />

        <div className="relative z-10 space-y-4">
          <TouringHeroBanner
            title="Masuk ke KonvoiKu"
            subtitle="Login terlebih dahulu sebelum membuat room konvoi, memantau GPS live, dan berkoordinasi di peta."
          />

          {hasActiveAccount && (
            <div className="rounded-[20px] bg-white dark:bg-[#131B26] border border-[#1D4ED8]/40 dark:border-[#3B82F6]/50 p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#DCFCE7] dark:bg-[#064E3B] text-[#15803D] dark:text-[#4ADE80] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">
                    {authUserName || localUserName || 'Pengendara KonvoiKu'}
                  </p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">
                    {authUserEmail
                      ? `${authUserEmail} · Cloud Sync Aktif`
                      : 'Sesi Pengendara Aktif'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onContinueSession}
                className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#1D4ED8] hover:bg-[#1E40AF] active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Lanjutkan ke Dashboard</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}

          {/* Card 1: Google Cloud Account Sign-In */}
          <div className="rounded-[22px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[14px] bg-[#EFF6FF] dark:bg-[#1E3A8A] flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-tight">
                  Akun Google (Cloud Sync)
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Sinkronisasi room real-time antar HP pengendara
                </p>
              </div>
            </div>

            {authError && (
              <div
                role="alert"
                className="rounded-xl bg-[#FEF2F2] dark:bg-[#450A0A] border border-[#FECACA] dark:border-[#991B1B] px-3 py-2.5 flex items-start gap-2 text-xs text-[#B91C1C] dark:text-[#FCA5A5]"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isSigningIn}
              onClick={onGoogleSignIn}
              className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <svg
                aria-hidden="true"
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
              >
                <path
                  fill="#FFFFFF"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>
                {isSigningIn ? 'Memverifikasi Akun...' : 'Masuk dengan Google'}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-2">
            <div className="h-px flex-1 bg-[#E2E8F0] dark:bg-[#2D3A4F]" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              atau masuk pengendara
            </span>
            <div className="h-px flex-1 bg-[#E2E8F0] dark:bg-[#2D3A4F]" />
          </div>

          {/* Card 2: Rider Account Form (Local / Demo Session) */}
          <form
            onSubmit={handleLocalSubmit}
            className="rounded-[22px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 shadow-xs space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[14px] bg-[#FFF7ED] dark:bg-[#7C2D12] flex items-center justify-center text-[#EA580C] dark:text-[#FB923C] shrink-0">
                <UserIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-tight">
                  Masuk Akun Pengendara
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Untuk uji coba lokal tanpa akun Google
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <label
                  htmlFor="login-fullname"
                  className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
                >
                  Nama Lengkap Pengendara
                </label>
                <input
                  id="login-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Contoh: Kang Ekie"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm text-[#0F172A] dark:text-[#F1F5F9] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                />
              </div>

              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
                >
                  Email (Opsional)
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="nama@email.com"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm text-[#0F172A] dark:text-[#F1F5F9] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                />
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-xl bg-[#FEF2F2] dark:bg-[#450A0A] border border-[#FECACA] dark:border-[#991B1B] px-3 py-2 flex items-start gap-2 text-xs text-[#B91C1C] dark:text-[#FCA5A5]"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Masuk ke Aplikasi</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </form>

          {/* Key Features Overview */}
          <div className="rounded-[18px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-3.5 space-y-2">
            <div className="flex items-center gap-2.5 text-xs text-[#475569] dark:text-[#CBD5E1]">
              <MapPin className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
              <span>Pantau posisi seluruh anggota secara live di Google Maps.</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-[#475569] dark:text-[#CBD5E1]">
              <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-[#FB923C] shrink-0" />
              <span>Peringatan anti-terpisah, tombol SOS & Walkie-Talkie konvoi.</span>
            </div>
          </div>

          <p className="pt-1 pb-2 text-center text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
            Created by Kang Ekie
          </p>
        </div>
      </div>
    </div>
  );
}
