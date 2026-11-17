import { AvatarPreset } from '../types/convoy';

export interface AvatarPresetOption {
  id: AvatarPreset;
  label: string;
  gradient: string;
}

export const AVATAR_PRESET_OPTIONS: AvatarPresetOption[] = [
  {
    id: 'HELMET_TOURING',
    label: 'Helm Touring',
    gradient: 'from-[#EA580C] to-[#F59E0B]',
  },
  {
    id: 'HELMET_SPORT',
    label: 'Helm Sport',
    gradient: 'from-[#1D4ED8] to-[#38BDF8]',
  },
  {
    id: 'RIDER_CAPTAIN',
    label: 'Kapten Rider',
    gradient: 'from-[#1E3A8A] to-[#2563EB]',
  },
  {
    id: 'PILOT_CLASSIC',
    label: 'Pilot Klasik',
    gradient: 'from-[#0F766E] to-[#14B8A6]',
  },
  {
    id: 'RALLY_PRO',
    label: 'Rally Pro',
    gradient: 'from-[#B91C1C] to-[#F97316]',
  },
  {
    id: 'STANDARD_USER',
    label: 'Foto Standar',
    gradient: 'from-[#475569] to-[#64748B]',
  },
];

interface ConvoyAvatarProps {
  preset?: AvatarPreset;
  photoUrl?: string;
  name: string;
  sizeClass?: string;
  ringClass?: string;
}

export function ConvoyAvatar({
  preset = 'HELMET_TOURING',
  photoUrl,
  name,
  sizeClass = 'w-9 h-9',
  ringClass = 'ring-2 ring-white dark:ring-[#0B1117]',
}: ConvoyAvatarProps) {
  const option =
    AVATAR_PRESET_OPTIONS.find((o) => o.id === preset) ??
    AVATAR_PRESET_OPTIONS[0];

  if (photoUrl) {
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 ${ringClass} bg-[#E2E8F0] shadow-xs`}
      >
        <img
          src={photoUrl}
          alt={`Avatar ${name}`}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full shrink-0 ${ringClass} bg-gradient-to-br ${option.gradient} flex items-center justify-center shadow-xs overflow-hidden`}
      title={option.label}
    >
      {preset === 'HELMET_TOURING' && (
        <svg viewBox="0 0 36 36" className="w-[72%] h-[72%]" aria-hidden="true">
          <path
            d="M8 20C8 12.8 13 8 19.5 8C25.5 8 29 12.2 29 18.5V22.5C29 24.4 27.4 26 25.5 26H12.5C10 26 8 23.8 8 20Z"
            fill="#FFFFFF"
          />
          <rect x="14" y="13" width="13.5" height="6.5" rx="3" fill="#0F172A" />
          <path
            d="M7 12.5L13 10.5"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <rect x="12" y="21.5" width="10" height="2.2" rx="1.1" fill="#EA580C" />
        </svg>
      )}

      {preset === 'HELMET_SPORT' && (
        <svg viewBox="0 0 36 36" className="w-[72%] h-[72%]" aria-hidden="true">
          <path
            d="M7.5 19.5C7.5 12.2 13 7.5 19.8 7.5C26 7.5 29.5 12 29.5 18.2C29.5 22.8 27 26.2 22.5 26.8H11.5C9.2 26.8 7.5 24 7.5 19.5Z"
            fill="#FFFFFF"
          />
          <path
            d="M15 12.5H27.5C28.3 14.2 28.4 16.5 27.6 18.6H16.5C14.8 18.6 14 15.2 15 12.5Z"
            fill="#0F172A"
          />
          <path
            d="M10 22.5H21"
            stroke="#1D4ED8"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      )}

      {preset === 'RIDER_CAPTAIN' && (
        <svg viewBox="0 0 36 36" className="w-[72%] h-[72%]" aria-hidden="true">
          <path
            d="M8.5 19.5C8.5 12.8 13.2 8.2 19 8.2C24.8 8.2 28.5 12.4 28.5 18.5V24C28.5 25.3 27.4 26.4 26.1 26.4H12.2C10.1 26.4 8.5 24 8.5 19.5Z"
            fill="#FFFFFF"
          />
          <rect x="13.5" y="13" width="13.5" height="6" rx="2.8" fill="#1E293B" />
          <path
            d="M18 4.8L19.4 7.5L22.3 7.9L20.1 9.9L20.6 12.8L18 11.4L15.4 12.8L15.9 9.9L13.7 7.9L16.6 7.5Z"
            fill="#FACC15"
          />
        </svg>
      )}

      {preset === 'PILOT_CLASSIC' && (
        <svg viewBox="0 0 36 36" className="w-[72%] h-[72%]" aria-hidden="true">
          <circle cx="18" cy="18" r="9.5" fill="#FFFFFF" />
          <rect x="10.5" y="13" width="6.5" height="5" rx="2.5" fill="#0F172A" />
          <rect x="19" y="13" width="6.5" height="5" rx="2.5" fill="#0F172A" />
          <line x1="17" y1="15.5" x2="19" y2="15.5" stroke="#0F766E" strokeWidth="1.8" />
          <path
            d="M14 22.5C15.8 24 20.2 24 22 22.5"
            stroke="#0F766E"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )}

      {preset === 'RALLY_PRO' && (
        <svg viewBox="0 0 36 36" className="w-[72%] h-[72%]" aria-hidden="true">
          <path
            d="M8 19C8 12.4 13 8 19.2 8C24.8 8 28.5 12 28.5 18V22.5L25 26.5H12.5C9.8 26.5 8 23.5 8 19Z"
            fill="#FFFFFF"
          />
          <rect x="14" y="13" width="13" height="6" rx="2.5" fill="#FDE047" />
          <path
            d="M7 10.5L15 8.5"
            stroke="#FDE047"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      )}

      {preset === 'STANDARD_USER' && (
        <svg viewBox="0 0 36 36" className="w-[70%] h-[70%]" aria-hidden="true">
          <circle cx="18" cy="13.5" r="5" fill="#FFFFFF" />
          <path
            d="M8.5 28C9.8 22.6 13.4 20.2 18 20.2C22.6 20.2 26.2 22.6 27.5 28"
            fill="#FFFFFF"
          />
        </svg>
      )}
    </div>
  );
}
