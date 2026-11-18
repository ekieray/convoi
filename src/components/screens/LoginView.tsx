import { useState, FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
  MapPin,
  Navigation,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
} from 'lucide-react';
import { AuthProviderId } from '../../types/convoy';
import {
  TouringCanvasBackdrop,
  TouringHeroBanner,
} from '../TouringAtmosphereBackdrop';

interface LoginViewProps {
  authUserEmail?: string | null;
  authUserName?: string | null;
  authProvider?: AuthProviderId;
  localUserName?: string | null;
  isSigningIn?: boolean;
  authError?: string | null;
  authInfoMessage?: string | null;
  initialName?: string;
  initialEmail?: string;
  onGoogleSignIn: () => void;
  onFacebookSignIn: () => void;
  onInstagramSignIn: () => void;
  onEmailAuth: (params: {
    mode: 'signin' | 'signup';
    fullName: string;
    email: string;
    password: string;
  }) => void;
  onForgotPassword: (email: string) => void;
  onLocalLogin: (fullName: string, email: string) => void;
  onContinueSession: () => void;
  onOpenCustomizeProfile: () => void;
  onOpenAboutApp: () => void;
}

const PROVIDER_LABELS: Record<AuthProviderId, string> = {
  google: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  email: 'Email',
  local: 'Sesi Lokal',
};

export function LoginView({
  authUserEmail,
  authUserName,
  authProvider = 'local',
  localUserName,
  isSigningIn = false,
  authError,
  authInfoMessage,
  initialName = '',
  initialEmail = '',
  onGoogleSignIn,
  onFacebookSignIn,
  onInstagramSignIn,
  onEmailAuth,
  onForgotPassword,
  onLocalLogin,
  onContinueSession,
  onOpenCustomizeProfile,
  onOpenAboutApp,
}: LoginViewProps) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showQuickLocal, setShowQuickLocal] = useState(false);
  const [quickName, setQuickName] = useState(initialName);
  const [quickEmail, setQuickEmail] = useState(initialEmail);

  const hasActiveAccount = Boolean(authUserEmail || localUserName);

  const handleEmailFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanName = fullName.trim();

    if (authMode === 'signup' && cleanName.length < 2) {
      setFormError('Masukkan nama lengkap pengendara (minimal 2 karakter).');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError('Masukkan alamat email yang valid (contoh: rider@email.com).');
      return;
    }
    if (password.length < 6) {
      setFormError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (authMode === 'signup' && password !== confirmPassword) {
      setFormError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setFormError(null);
    onEmailAuth({
      mode: authMode,
      fullName: cleanName,
      email: cleanEmail,
      password,
    });
  };

  const handleQuickLocalSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = quickName.trim();
    const cleanEmail = quickEmail.trim();
    if (cleanName.length < 2) {
      setFormError('Masukkan nama pengendara minimal 2 karakter.');
      return;
    }
    if (cleanEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
      setFormError('Format email tidak valid.');
      return;
    }
    setFormError(null);
    onLocalLogin(cleanName, cleanEmail);
  };

  const handleResetClick = () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Isi alamat email Anda terlebih dahulu untuk mengirim tautan reset sandi.');
      return;
    }
    setFormError(null);
    onForgotPassword(cleanEmail);
  };

  return (
    <div className="relative flex flex-col min-h-full bg-[#F4F6FA] dark:bg-[#0A0F16] text-[#0F172A] dark:text-[#F1F5F9]">
      {/* Top Bar */}
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
            title={
              authMode === 'signup'
                ? 'Daftar Akun KonvoiKu'
                : 'Masuk ke KonvoiKu'
            }
            subtitle="Sign Up atau Sign In untuk sinkronisasi profil pengendara dengan email, custom avatar, dan koordinasi konvoi real-time."
          />

          {/* Active Session Card */}
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
                      ? `${authUserEmail} · ${PROVIDER_LABELS[authProvider]}`
                      : `Sesi Aktif · ${PROVIDER_LABELS[authProvider]}`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenCustomizeProfile}
                  className="min-h-[44px] px-3 py-2.5 rounded-[12px] border border-[#1D4ED8] dark:border-[#60A5FA] text-[#1D4ED8] dark:text-[#93C5FD] text-xs font-semibold hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/30 transition-colors cursor-pointer"
                >
                  Customize Profil
                </button>
                <button
                  type="button"
                  onClick={onContinueSession}
                  className="min-h-[44px] px-3 py-2.5 rounded-[12px] bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* Main Auth Card: Sign In / Sign Up Switcher + Social Providers + Email/Password */}
          <div className="rounded-[22px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 shadow-xs space-y-4">
            {/* Segmented Control: Sign In vs Sign Up */}
            <div className="grid grid-cols-2 p-1 rounded-[14px] bg-[#F1F5F9] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setFormError(null);
                }}
                className={`min-h-[40px] rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-white dark:bg-[#1E293B] text-[#1D4ED8] dark:text-[#93C5FD] shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                Masuk (Sign In)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setFormError(null);
                }}
                className={`min-h-[40px] rounded-[10px] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-white dark:bg-[#1E293B] text-[#EA580C] dark:text-[#FB923C] shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Daftar (Sign Up)</span>
              </button>
            </div>

            {authInfoMessage && (
              <div
                role="status"
                className="rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 border border-[#A7F3D0] dark:border-[#059669] px-3 py-2.5 flex items-start gap-2 text-xs text-[#047857] dark:text-[#6EE7B7]"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authInfoMessage}</span>
              </div>
            )}

            {(authError || formError) && (
              <div
                role="alert"
                className="rounded-xl bg-[#FEF2F2] dark:bg-[#450A0A] border border-[#FECACA] dark:border-[#991B1B] px-3 py-2.5 flex items-start gap-2 text-xs text-[#B91C1C] dark:text-[#FCA5A5]"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError || authError}</span>
              </div>
            )}

            {/* Social Sign Up / Sign In Providers: Google, Facebook, Instagram */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {authMode === 'signup'
                  ? 'Daftar Cepat dengan Akun Sosial'
                  : 'Masuk Cepat dengan Akun Sosial'}
              </p>

              {/* Google */}
              <button
                type="button"
                disabled={isSigningIn}
                onClick={onGoogleSignIn}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-[13px] bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer"
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
                  {isSigningIn
                    ? 'Memverifikasi...'
                    : authMode === 'signup'
                      ? 'Daftar dengan Google'
                      : 'Masuk dengan Google'}
                </span>
              </button>

              {/* Facebook & Instagram 2-Column Row */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={onFacebookSignIn}
                  className="min-h-[44px] px-3 py-2.5 rounded-[13px] bg-[#1877F2] hover:bg-[#1565D8] disabled:opacity-60 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="#FFFFFF"
                      d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5Z"
                    />
                  </svg>
                  <span>Facebook</span>
                </button>

                <button
                  type="button"
                  disabled={isSigningIn}
                  onClick={onInstagramSignIn}
                  className="min-h-[44px] px-3 py-2.5 rounded-[13px] bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] hover:opacity-95 disabled:opacity-60 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <svg
                    aria-hidden="true"
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                  <span>Instagram</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E2E8F0] dark:bg-[#2D3A4F]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                atau sinkronisasi email
              </span>
              <div className="h-px flex-1 bg-[#E2E8F0] dark:bg-[#2D3A4F]" />
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleEmailFormSubmit} className="space-y-3">
              {authMode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-fullname"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
                  >
                    Nama Lengkap Pengendara
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setFormError(null);
                      }}
                      placeholder="Contoh: Kang Ekie"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
                >
                  Alamat Email (Sinkronisasi Profil)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="nama@email.com"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]"
                  >
                    Kata Sandi
                  </label>
                  {authMode === 'signin' && (
                    <button
                      type="button"
                      onClick={handleResetClick}
                      className="text-[11px] font-semibold text-[#1D4ED8] dark:text-[#93C5FD] hover:underline cursor-pointer"
                    >
                      Lupa kata sandi?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Minimal 6 karakter"
                    className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {authMode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
                  >
                    Konfirmasi Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setFormError(null);
                      }}
                      placeholder="Ulangi kata sandi"
                      className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSigningIn}
                className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-60 active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>
                  {isSigningIn
                    ? 'Memproses Akun...'
                    : authMode === 'signup'
                      ? 'Daftar & Sinkronkan Profil'
                      : 'Masuk dengan Email'}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </form>
          </div>

          {/* Collapsible Local Quick Entry */}
          <div className="rounded-[18px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-3.5 space-y-3">
            <button
              type="button"
              onClick={() => setShowQuickLocal((prev) => !prev)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div>
                <p className="text-xs font-bold text-[#0F172A] dark:text-white">
                  Masuk Cepat Mode Lokal / Tamu
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Simpan & pulihkan profil lokal berdasarkan email tanpa cloud
                </p>
              </div>
              <span className="text-xs font-semibold text-[#1D4ED8] dark:text-[#93C5FD]">
                {showQuickLocal ? 'Tutup' : 'Buka'}
              </span>
            </button>

            {showQuickLocal && (
              <form onSubmit={handleQuickLocalSubmit} className="space-y-2.5 pt-1">
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Nama Pengendara (mis. Kang Ekie)"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
                <input
                  type="email"
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  placeholder="Email profil lokal (opsional, untuk sinkronisasi)"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
                <button
                  type="submit"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#1D4ED8] text-[#1D4ED8] dark:text-[#93C5FD] text-xs font-semibold hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/30 transition-colors cursor-pointer"
                >
                  Lanjutkan Mode Lokal
                </button>
              </form>
            )}
          </div>

          {/* Key Features Overview */}
          <div className="rounded-[18px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-3.5 space-y-2">
            <div className="flex items-center gap-2.5 text-xs text-[#475569] dark:text-[#CBD5E1]">
              <MapPin className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
              <span>Pantau posisi seluruh anggota secara live di Google Maps.</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-[#475569] dark:text-[#CBD5E1]">
              <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-[#FB923C] shrink-0" />
              <span>Profil, avatar, klub & kendaraan tersinkronisasi otomatis per email.</span>
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
