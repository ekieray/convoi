import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  AtSign,
  BadgeInfo,
  Bike,
  Car,
  CheckCircle2,
  CloudCheck,
  ImagePlus,
  Mail,
  MapPin,
  Palette,
  Phone,
  Save,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  AuthProviderId,
  VehicleProfile,
  VehicleType,
} from '../../types/convoy';
import { compressAvatarImage } from '../../utils/imageCompress';
import { AVATAR_PRESET_OPTIONS, ConvoyAvatar } from '../ConvoyAvatar';

interface CustomizeProfileViewProps {
  profile: VehicleProfile;
  authProvider: AuthProviderId;
  isCloudAuthenticated: boolean;
  isSavingProfile?: boolean;
  syncStatusMessage?: string | null;
  onSaveAndSyncProfile: (nextProfile: VehicleProfile) => Promise<void> | void;
  onBack: () => void;
}

const PROVIDER_BADGE: Record<AuthProviderId, { label: string; bg: string; text: string }> = {
  google: {
    label: 'Google Account',
    bg: 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/60',
    text: 'text-[#1D4ED8] dark:text-[#93C5FD]',
  },
  facebook: {
    label: 'Facebook',
    bg: 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/60',
    text: 'text-[#1877F2] dark:text-[#93C5FD]',
  },
  instagram: {
    label: 'Instagram OAuth',
    bg: 'bg-[#FDF2F8] dark:bg-[#831843]/40',
    text: 'text-[#DB2777] dark:text-[#F472B6]',
  },
  email: {
    label: 'Akun Email',
    bg: 'bg-[#ECFDF5] dark:bg-[#064E3B]/50',
    text: 'text-[#047857] dark:text-[#6EE7B7]',
  },
  local: {
    label: 'Profil Email Lokal',
    bg: 'bg-[#FFF7ED] dark:bg-[#7C2D12]/50',
    text: 'text-[#EA580C] dark:text-[#FB923C]',
  },
};

export function CustomizeProfileView({
  profile,
  authProvider,
  isCloudAuthenticated,
  isSavingProfile = false,
  syncStatusMessage,
  onSaveAndSyncProfile,
  onBack,
}: CustomizeProfileViewProps) {
  const [draft, setDraft] = useState<VehicleProfile>(profile);
  const [formError, setFormError] = useState<string | null>(null);
  const [localSavedBanner, setLocalSavedBanner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  const badge = PROVIDER_BADGE[authProvider] || PROVIDER_BADGE.local;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressAvatarImage(file);
      setDraft((prev) => ({ ...prev, avatarPhotoUrl: compressed }));
      setFormError(null);
    } catch {
      setFormError('Gagal memproses foto dari galeri.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = draft.fullName.trim();
    const cleanEmail = (draft.email || '').trim().toLowerCase();

    if (cleanName.length < 2) {
      setFormError('Nama lengkap pengendara minimal 2 karakter.');
      return;
    }
    if (cleanEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
      setFormError('Format email sinkronisasi tidak valid.');
      return;
    }

    setFormError(null);
    const cleanedProfile: VehicleProfile = {
      ...draft,
      fullName: cleanName,
      email: cleanEmail,
      authProvider: draft.authProvider || authProvider,
      clubName: (draft.clubName || '').trim(),
      homeCity: (draft.homeCity || '').trim(),
      bio: (draft.bio || '').trim(),
      instagramHandle: (draft.instagramHandle || '').trim(),
      vehicleDetail: draft.vehicleDetail.trim(),
      licensePlate: draft.licensePlate.trim().toUpperCase(),
      emergencyContact: draft.emergencyContact.trim(),
    };

    await onSaveAndSyncProfile(cleanedProfile);
    setLocalSavedBanner(
      cleanEmail
        ? `Profil berhasil disimpan & disinkronkan ke ${cleanEmail}`
        : 'Profil berhasil disimpan.'
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col min-h-full bg-[#F4F6FA] dark:bg-[#0A0F16] text-[#0F172A] dark:text-[#F1F5F9]"
    >
      {/* Top App Bar */}
      <div className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#131B26] border-b border-[#E2E8F0] dark:border-[#2D3A4F]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-tight truncate">
            Customize Profil Pengguna
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">
            Identitas Touring, Avatar & Sinkronisasi Email
          </p>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 px-4 py-4 space-y-4">
        {/* Email Sync & Provider Card */}
        <div className="rounded-[20px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CloudCheck className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
              <span className="text-xs font-bold">Status Sinkronisasi Akun</span>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
            {isCloudAuthenticated
              ? 'Perubahan profil akan disimpan ke akun Cloud Firestore dan diindeks dengan email Anda.'
              : 'Profil tersimpan dan dapat dipulihkan otomatis saat Anda masuk kembali menggunakan alamat email yang sama.'}
          </p>
          {(syncStatusMessage || localSavedBanner) && (
            <div className="rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 border border-[#A7F3D0] dark:border-[#059669] px-3 py-2 flex items-center gap-2 text-xs text-[#047857] dark:text-[#6EE7B7]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{syncStatusMessage || localSavedBanner}</span>
            </div>
          )}
        </div>

        {/* Avatar & Photo Section */}
        <div className="rounded-[20px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <ConvoyAvatar
              preset={draft.avatarPreset}
              photoUrl={draft.avatarPhotoUrl}
              name={draft.fullName || 'Rider'}
              sizeClass="w-16 h-16"
              ringClass="ring-2 ring-[#1D4ED8] dark:ring-[#60A5FA]"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-bold">Foto Profil / Avatar Rider</p>
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
                  <span>Unggah Foto</span>
                </button>
                {draft.avatarPhotoUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, avatarPhotoUrl: undefined }))
                    }
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
              Pilih karakter avatar touring:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {AVATAR_PRESET_OPTIONS.map((opt) => {
                const active =
                  !draft.avatarPhotoUrl && draft.avatarPreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        avatarPreset: opt.id,
                        avatarPhotoUrl: undefined,
                      }))
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

        {/* Personal & Community Identity */}
        <div className="rounded-[20px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 space-y-3 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Identitas Pengguna & Komunitas
          </p>

          <div>
            <label
              htmlFor="custom-fullname"
              className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
            >
              Nama Lengkap / Panggilan Touring
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="custom-fullname"
                type="text"
                value={draft.fullName}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, fullName: e.target.value }))
                }
                placeholder="Contoh: Kang Ekie"
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="custom-email"
              className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
            >
              Email Sinkronisasi Profil
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="custom-email"
                type="email"
                value={draft.email || ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="nama@email.com"
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="custom-club"
                className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
              >
                Klub / Komunitas
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="custom-club"
                  type="text"
                  value={draft.clubName || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, clubName: e.target.value }))
                  }
                  placeholder="Nmax Riders"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="custom-city"
                className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
              >
                Kota Asal
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="custom-city"
                  type="text"
                  value={draft.homeCity || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, homeCity: e.target.value }))
                  }
                  placeholder="Bandung"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="custom-ig"
              className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
            >
              Username Instagram (Opsional)
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="custom-ig"
                type="text"
                value={draft.instagramHandle || ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, instagramHandle: e.target.value }))
                }
                placeholder="kangekie.touring"
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="custom-bio"
              className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
            >
              Bio Singkat / Catatan Touring
            </label>
            <textarea
              id="custom-bio"
              rows={2}
              maxLength={240}
              value={draft.bio || ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, bio: e.target.value }))
              }
              placeholder="Hobi sunset ride jalur selatan & safety first."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] resize-none"
            />
          </div>
        </div>

        {/* Default Vehicle & Emergency Contact */}
        <div className="rounded-[20px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-4 space-y-3 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            Kendaraan Default & Kontak Darurat
          </p>

          <div className="grid grid-cols-2 rounded-xl border border-[#CBD5E1] dark:border-[#334155] overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A]">
            {(['MOBIL', 'MOTOR'] as VehicleType[]).map((type, idx) => {
              const active = draft.vehicleType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, vehicleType: type }))
                  }
                  className={`min-h-[42px] flex items-center justify-center gap-2 text-xs font-semibold transition-colors cursor-pointer ${
                    idx === 0
                      ? 'border-r border-[#CBD5E1] dark:border-[#334155]'
                      : ''
                  } ${
                    active
                      ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[#1D4ED8] dark:text-[#DBEAFE]'
                      : 'text-[#475569] dark:text-[#CBD5E1]'
                  }`}
                >
                  {type === 'MOBIL' ? (
                    <Car className="w-4 h-4" />
                  ) : (
                    <Bike className="w-4 h-4" />
                  )}
                  <span>{type === 'MOBIL' ? 'Mobil' : 'Motor'}</span>
                </button>
              );
            })}
          </div>

          <div>
            <label
              htmlFor="custom-vehicle"
              className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
            >
              Model & Warna Kendaraan
            </label>
            <div className="relative">
              <Palette className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="custom-vehicle"
                type="text"
                value={draft.vehicleDetail}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, vehicleDetail: e.target.value }))
                }
                placeholder={
                  draft.vehicleType === 'MOBIL'
                    ? 'Contoh: Avanza Hitam'
                    : 'Contoh: Nmax Putih'
                }
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="custom-plate"
                className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
              >
                Plat Nomor
              </label>
              <div className="relative">
                <BadgeInfo className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="custom-plate"
                  type="text"
                  value={draft.licensePlate}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      licensePlate: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="B 1945 KNV"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="custom-contact"
                className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1"
              >
                Kontak Darurat
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="custom-contact"
                  type="tel"
                  value={draft.emergencyContact}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      emergencyContact: e.target.value,
                    }))
                  }
                  placeholder="0812-3456-7890"
                  className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>
            </div>
          </div>
        </div>

        {formError && (
          <div
            role="alert"
            className="rounded-xl bg-[#FEF2F2] dark:bg-[#450A0A] border border-[#FECACA] dark:border-[#991B1B] px-3 py-2.5 text-xs text-[#B91C1C] dark:text-[#FCA5A5]"
          >
            {formError}
          </div>
        )}
      </div>

      {/* Sticky Bottom Save CTA */}
      <div className="sticky bottom-0 mt-auto px-4 pt-3.5 pb-[calc(2rem+env(safe-area-inset-bottom))] mb-2 bg-white dark:bg-[#131B26] border-t border-[#E2E8F0] dark:border-[#2D3A4F]">
        <button
          type="submit"
          disabled={isSavingProfile}
          className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-60 active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          <Save className="w-4 h-4 shrink-0" />
          <span>
            {isSavingProfile
              ? 'Menyinkronkan Profil...'
              : 'Simpan & Sinkronkan Profil'}
          </span>
        </button>
      </div>
    </form>
  );
}
