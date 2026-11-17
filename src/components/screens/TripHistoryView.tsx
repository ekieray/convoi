import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Gauge,
  History,
  Route,
} from 'lucide-react';
import { TripHistoryRecord } from '../../types/convoy';
import { ConvoyAvatar } from '../ConvoyAvatar';

interface TripHistoryViewProps {
  trips: TripHistoryRecord[];
  onSelectTrip: (tripId: string) => void;
  onBack: () => void;
}

type RoleFilter = 'ALL' | 'TOUR_LEADER' | 'MEMBER';

export function TripHistoryView({
  trips,
  onSelectTrip,
  onBack,
}: TripHistoryViewProps) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  const filteredTrips = trips.filter((trip) => {
    if (roleFilter === 'ALL') return true;
    return trip.userRole === roleFilter;
  });

  const totalDistanceKm = trips.reduce((acc, t) => acc + t.distanceKm, 0);

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC] dark:bg-[#0B1117] text-[#0F172A] dark:text-[#F1F5F9]">
      {/* Top App Bar */}
      <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-2.5 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kembali"
          className="min-w-[42px] min-h-[42px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-bold truncate">Riwayat Tour</h2>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate font-mono">
            {trips.length} Perjalanan · {totalDistanceKm.toFixed(1)} km Total
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-4 space-y-3.5">
        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'ALL', label: 'Semua' },
              { id: 'TOUR_LEADER', label: 'Sebagai Leader' },
              { id: 'MEMBER', label: 'Sebagai Anggota' },
            ] as Array<{ id: RoleFilter; label: string }>
          ).map((tab) => {
            const active = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1D4ED8] border-[#1D4ED8] text-white'
                    : 'bg-white dark:bg-[#141C24] border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* History Cards */}
        {filteredTrips.length === 0 ? (
          <div className="rounded-[20px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-6 text-center space-y-2">
            <History className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-sm font-bold">Belum Ada Riwayat</p>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Selesaikan konvoi aktif untuk merekam perjalanan dan mengekspor rute GPX.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrips.map((trip) => {
              const isLeader = trip.userRole === 'TOUR_LEADER';
              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => onSelectTrip(trip.id)}
                  className="w-full text-left rounded-[20px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] hover:border-[#1D4ED8] p-4 space-y-3 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-[#1E3A8A]/60 text-[#1D4ED8] dark:text-[#93C5FD] text-[10px] font-mono font-bold">
                          {trip.roomId}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            isLeader
                              ? 'bg-[#FFF7ED] dark:bg-[#7C2D12]/60 text-[#EA580C] dark:text-[#FB923C]'
                              : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1]'
                          }`}
                        >
                          {isLeader ? 'Tour Leader' : 'Anggota'}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold truncate">
                        {trip.tourTitle}
                      </h3>

                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>
                          {trip.dateLabel} · {trip.timeRangeLabel}
                        </span>
                      </p>
                    </div>

                    <ArrowRight className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0 mt-1" />
                  </div>

                  {/* Metrics Box */}
                  <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] px-3 py-2 grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Route className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-[#64748B] dark:text-[#94A3B8]">
                          Jarak
                        </p>
                        <p className="text-xs font-bold font-mono tabular-nums truncate">
                          {trip.distanceKm.toFixed(1)} km
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-[#64748B] dark:text-[#94A3B8]">
                          Durasi
                        </p>
                        <p className="text-xs font-bold font-mono tabular-nums truncate">
                          {trip.durationLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <Gauge className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-[#64748B] dark:text-[#94A3B8]">
                          Rata-rata
                        </p>
                        <p className="text-xs font-bold font-mono tabular-nums truncate">
                          {trip.avgSpeedKmh} km/j
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Participants Avatar Strip */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center -space-x-2 shrink-0">
                      {trip.participants.slice(0, 4).map((p) => (
                        <ConvoyAvatar
                          key={p.id}
                          preset={p.avatarPreset}
                          photoUrl={p.avatarPhotoUrl}
                          name={p.fullName}
                          sizeClass="w-6 h-6"
                          ringClass="ring-2 ring-white dark:ring-[#141C24]"
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                      {trip.participants.length} Peserta:{' '}
                      {trip.participants.map((p) => p.fullName).join(', ')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
