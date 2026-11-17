import { ArrowLeft, ClipboardPaste, Link2, LogIn } from 'lucide-react';
import { VehicleProfile } from '../../types/convoy';
import { ConvoyAvatar } from '../ConvoyAvatar';

interface JoinTourViewProps {
  joinInput: string;
  joinError: string | null;
  extractedRoomId: string;
  vehicleProfile: VehicleProfile;
  onInputChange: (val: string) => void;
  onJoinSubmit: () => void;
  onBack: () => void;
}

export function JoinTourView({
  joinInput,
  joinError,
  extractedRoomId,
  vehicleProfile,
  onInputChange,
  onJoinSubmit,
  onBack,
}: JoinTourViewProps) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onInputChange(text);
    } catch {
      onInputChange('https://konvoiku.id/join/KNV-8492');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoinSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col min-h-full bg-[#F8FAFC] dark:bg-[#0F1419] text-[#111827] dark:text-[#F1F5F9]"
    >
      {/* Top App Bar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold truncate">Gabung Konvoi</h2>
      </div>

      <div className="flex-1 px-5 py-5 flex flex-col justify-between gap-6">
        <div className="space-y-4">
          <p className="text-sm text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
            Masukkan Room ID atau tempel link undangan yang dibagikan oleh Tour Leader.
          </p>

          {/* Input Room ID / Link */}
          <div>
            <label
              htmlFor="roomInput"
              className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
            >
              Room ID atau Link Undangan
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="roomInput"
                type="text"
                value={joinInput}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="KNV-8492 atau https://konvoiku.id/join/KNV-8492"
                className={`w-full min-h-[48px] pl-10 pr-12 rounded-[14px] bg-white dark:bg-[#141C24] border text-sm font-mono outline-none transition-colors ${
                  joinError
                    ? 'border-[#DC2626] focus:border-[#DC2626]'
                    : 'border-[#CBD5E1] dark:border-[#334155] focus:border-[#1D4ED8]'
                }`}
              />
              <button
                type="button"
                onClick={handlePaste}
                aria-label="Tempel dari Clipboard"
                title="Tempel dari Clipboard"
                className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 absolute right-1.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
            </div>
            {joinError ? (
              <p className="mt-1.5 text-xs text-[#DC2626]">{joinError}</p>
            ) : extractedRoomId.length >= 4 ? (
              <p className="mt-1.5 text-xs text-[#16A34A] dark:text-[#4ADE80] font-medium">
                Terdeteksi Room ID: <span className="font-mono">{extractedRoomId}</span>
              </p>
            ) : null}
          </div>

          {/* Quick Demo Sample */}
          <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <span>Contoh cepat:</span>
            <button
              type="button"
              onClick={() => onInputChange('https://konvoiku.id/join/KNV-8492')}
              className="px-2.5 py-1.5 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[#1D4ED8] dark:text-[#DBEAFE] font-mono font-medium transition-colors cursor-pointer"
            >
              KNV-8492
            </button>
          </div>

          {/* Registered Rider Summary */}
          <div className="rounded-2xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-4 flex items-center gap-3">
            <ConvoyAvatar
              preset={vehicleProfile.avatarPreset}
              photoUrl={vehicleProfile.avatarPhotoUrl}
              name={vehicleProfile.fullName.trim() || 'Anggota Touring'}
              sizeClass="w-11 h-11"
              ringClass="ring-2 ring-[#1D4ED8] dark:ring-[#60A5FA]"
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA]">
                Profil Terdaftar
              </p>
              <p className="text-sm font-semibold truncate">
                {vehicleProfile.fullName.trim() || 'Anggota Touring'}
              </p>
              <p className="text-xs text-[#475569] dark:text-[#CBD5E1] truncate">
                {vehicleProfile.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor'} ·{' '}
                <span className="font-mono">
                  {vehicleProfile.licensePlate.trim() || '-'}
                </span>{' '}
                · Darurat:{' '}
                <span className="font-mono">
                  {vehicleProfile.emergencyContact.trim() || '-'}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          className="w-full min-h-[48px] px-4 py-3 rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] active:scale-[0.98] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <LogIn className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Masuk Konvoi</span>
        </button>
      </div>
    </form>
  );
}
