import { useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BadgeInfo,
  Bike,
  Car,
  ImagePlus,
  Info,
  Palette,
  Phone,
  User,
  X,
} from 'lucide-react';
import { UserRole, VehicleProfile, VehicleType } from '../../types/convoy';
import { compressAvatarImage } from '../../utils/imageCompress';
import { AVATAR_PRESET_OPTIONS, ConvoyAvatar } from '../ConvoyAvatar';

interface VehicleProfileViewProps {
  selectedRole: UserRole;
  profile: VehicleProfile;
  onUpdateProfile: (patch: Partial<VehicleProfile>) => void;
  onBack: () => void;
  onContinue: () => void;
  onOpenAboutApp: () => void;
}

export function VehicleProfileView({
  selectedRole,
  profile,
  onUpdateProfile,
  onBack,
  onContinue,
  onOpenAboutApp,
}: VehicleProfileViewProps) {
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressAvatarImage(file);
      onUpdateProfile({ avatarPhotoUrl: compressed });
    } catch {
      // Fallback ignored
    }
  };

  const nameError = showErrors && profile.fullName.trim().length < 2;
  const plateError = showErrors && profile.licensePlate.trim().length < 3;
  const contactError = showErrors && profile.emergencyContact.trim().length < 8;

  const isValid =
    profile.fullName.trim().length >= 2 &&
    profile.licensePlate.trim().length >= 3 &&
    profile.emergencyContact.trim().length >= 8;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onContinue();
    } else {
      setShowErrors(true);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col min-h-full bg-[#F8FAFC] dark:bg-[#0F1419] text-[#111827] dark:text-[#F1F5F9]"
    >
      {/* Material 3 Top App Bar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight truncate">
            Profil Kendaraan
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">
            Peran: {selectedRole === 'TOUR_LEADER' ? 'Tour Leader' : 'Anggota Konvoi'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAboutApp}
          aria-label="Tentang Aplikasi"
          className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Form Body */}
      <div className="flex-1 px-5 py-5 space-y-4">
        <p className="text-sm text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
          Lengkapi foto profil/avatar dan identitas kendaraan agar Anda mudah dikenali di peta, daftar peserta, dan chat konvoi.
        </p>

        {/* Foto Profil & Pilihan Avatar Bawaan */}
        <div className="rounded-[18px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-4 space-y-3.5">
          <div className="flex items-center gap-3.5">
            <ConvoyAvatar
              preset={profile.avatarPreset}
              photoUrl={profile.avatarPhotoUrl}
              name={profile.fullName || 'Rider'}
              sizeClass="w-16 h-16"
              ringClass="ring-2 ring-[#1D4ED8] dark:ring-[#60A5FA]"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-bold text-[#0F172A] dark:text-white">
                Foto Profil / Avatar Konvoi
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl border border-[#1D4ED8] dark:border-[#60A5FA] text-[#1D4ED8] dark:text-[#93C5FD] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/30 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Pilih Foto Galeri</span>
                </button>
                {profile.avatarPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => onUpdateProfile({ avatarPhotoUrl: undefined })}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-[#450A0A]/40 flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
              Atau pilih ikon avatar touring bawaan:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {AVATAR_PRESET_OPTIONS.map((opt) => {
                const active =
                  !profile.avatarPhotoUrl && profile.avatarPreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      onUpdateProfile({
                        avatarPreset: opt.id,
                        avatarPhotoUrl: undefined,
                      })
                    }
                    className={`p-2 rounded-[14px] border flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/50 border-[#1D4ED8] text-[#1D4ED8] dark:text-[#DBEAFE]'
                        : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                    }`}
                  >
                    <ConvoyAvatar
                      preset={opt.id}
                      name={opt.label}
                      sizeClass="w-9 h-9"
                      ringClass="ring-1 ring-white/80"
                    />
                    <span className="text-[10px] font-semibold truncate max-w-full">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Nama Lengkap */}
        <div>
          <label
            htmlFor="fullName"
            className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
          >
            Nama Lengkap
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="fullName"
              type="text"
              value={profile.fullName}
              onChange={(e) => onUpdateProfile({ fullName: e.target.value })}
              placeholder="Contoh: Budi Santoso"
              className={`w-full min-h-[46px] pl-10 pr-3.5 rounded-[14px] bg-white dark:bg-[#141C24] border text-sm outline-none transition-colors ${
                nameError
                  ? 'border-[#DC2626] focus:border-[#DC2626]'
                  : 'border-[#CBD5E1] dark:border-[#334155] focus:border-[#1D4ED8]'
              }`}
            />
          </div>
          {nameError && (
            <p className="mt-1 text-xs text-[#DC2626]">
              Nama lengkap minimal 2 karakter
            </p>
          )}
        </div>

        {/* Jenis Kendaraan Segmented Control */}
        <div>
          <span className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5">
            Jenis Kendaraan
          </span>
          <div className="grid grid-cols-2 rounded-[14px] border border-[#CBD5E1] dark:border-[#334155] overflow-hidden bg-white dark:bg-[#141C24]">
            {(['MOBIL', 'MOTOR'] as VehicleType[]).map((type, idx) => {
              const active = profile.vehicleType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onUpdateProfile({ vehicleType: type })}
                  className={`min-h-[44px] flex items-center justify-center gap-2 text-sm font-medium transition-colors cursor-pointer ${
                    idx === 0
                      ? 'border-r border-[#CBD5E1] dark:border-[#334155]'
                      : ''
                  } ${
                    active
                      ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[#1D4ED8] dark:text-[#DBEAFE]'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                  }`}
                >
                  {type === 'MOBIL' ? (
                    <Car className="w-4 h-4 shrink-0" />
                  ) : (
                    <Bike className="w-4 h-4 shrink-0" />
                  )}
                  <span>{type === 'MOBIL' ? 'Mobil' : 'Motor'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model & Warna Kendaraan (untuk Label Marker) */}
        <div>
          <label
            htmlFor="vehicleDetail"
            className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
          >
            Model & Warna Kendaraan (Opsional)
          </label>
          <div className="relative">
            <Palette className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="vehicleDetail"
              type="text"
              value={profile.vehicleDetail}
              onChange={(e) => onUpdateProfile({ vehicleDetail: e.target.value })}
              placeholder={
                profile.vehicleType === 'MOBIL'
                  ? 'Contoh: Avanza Hitam'
                  : 'Contoh: Nmax Putih'
              }
              className="w-full min-h-[46px] pl-10 pr-3.5 rounded-[14px] bg-white dark:bg-[#141C24] border border-[#CBD5E1] dark:border-[#334155] focus:border-[#1D4ED8] text-sm outline-none transition-colors"
            />
          </div>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Tampil di label marker peta, misal: Budi - Avanza Hitam.
          </p>
        </div>

        {/* Nomor Plat Kendaraan */}
        <div>
          <label
            htmlFor="licensePlate"
            className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
          >
            Nomor Plat Kendaraan
          </label>
          <div className="relative">
            <BadgeInfo className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="licensePlate"
              type="text"
              value={profile.licensePlate}
              onChange={(e) =>
                onUpdateProfile({ licensePlate: e.target.value.toUpperCase() })
              }
              placeholder="Contoh: B 1945 KNV"
              className={`w-full min-h-[46px] pl-10 pr-3.5 rounded-[14px] bg-white dark:bg-[#141C24] border text-sm font-mono uppercase outline-none transition-colors ${
                plateError
                  ? 'border-[#DC2626] focus:border-[#DC2626]'
                  : 'border-[#CBD5E1] dark:border-[#334155] focus:border-[#1D4ED8]'
              }`}
            />
          </div>
          {plateError && (
            <p className="mt-1 text-xs text-[#DC2626]">
              Masukkan nomor plat kendaraan yang valid
            </p>
          )}
        </div>

        {/* Kontak Darurat */}
        <div>
          <label
            htmlFor="emergencyContact"
            className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
          >
            Kontak Darurat (No. Telepon / WA)
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="emergencyContact"
              type="tel"
              value={profile.emergencyContact}
              onChange={(e) =>
                onUpdateProfile({ emergencyContact: e.target.value })
              }
              placeholder="Contoh: 0812-3456-7890"
              className={`w-full min-h-[46px] pl-10 pr-3.5 rounded-[14px] bg-white dark:bg-[#141C24] border text-sm font-mono outline-none transition-colors ${
                contactError
                  ? 'border-[#DC2626] focus:border-[#DC2626]'
                  : 'border-[#CBD5E1] dark:border-[#334155] focus:border-[#1D4ED8]'
              }`}
            />
          </div>
          {contactError ? (
            <p className="mt-1 text-xs text-[#DC2626]">
              Masukkan nomor kontak darurat minimal 8 digit
            </p>
          ) : (
            <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Digunakan jika terjadi kendala darurat saat konvoi.
            </p>
          )}
        </div>

        {/* Tentang Aplikasi & Kredit Pembuat */}
        <button
          type="button"
          onClick={onOpenAboutApp}
          className="w-full text-left rounded-[16px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#1D4ED8] p-3.5 flex items-center gap-3 transition-colors cursor-pointer"
        >
          <BadgeCheck className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">Tentang Aplikasi KonvoiKu</p>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
              App Created &amp; Designed by Kang Ekie
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
        </button>
      </div>

      {/* Sticky Bottom CTA with extra clearance above mobile navigation bar */}
      <div className="sticky bottom-0 mt-auto px-5 pt-3.5 pb-[calc(2rem+env(safe-area-inset-bottom))] mb-2 bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155]">
        <button
          type="submit"
          className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          <span className="whitespace-nowrap">
            {selectedRole === 'TOUR_LEADER'
              ? 'Lanjut Setup Konvoi'
              : 'Lanjut Gabung Konvoi'}
          </span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </form>
  );
}
