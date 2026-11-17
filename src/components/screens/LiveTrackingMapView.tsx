import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Bike,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  Flag,
  Gauge,
  LocateFixed,
  MapPin,
  MessageCircle,
  Mic,
  Minus,
  Pause,
  Play,
  Plus,
  Route,
  Send,
  Settings,
  Shield,
  Square,
  Trash2,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';
import {
  ConvoyMember,
  ConvoyRouteConfig,
  DestinationEtaInfo,
  DestinationPreset,
  MemberConditionStatus,
  OffRouteAlertState,
  RoomMessage,
  SosEmergencyState,
  StragglerAlertState,
  TourRoom,
  UserRole,
} from '../../types/convoy';
import { ConvoyAvatar } from '../ConvoyAvatar';

interface LiveTrackingMapViewProps {
  activeRoom: TourRoom | null;
  role: UserRole;
  selectedMemberId: string | null;
  isSimulationRunning: boolean;
  routeConfig: ConvoyRouteConfig;
  stragglerAlert: StragglerAlertState;
  offRouteAlert: OffRouteAlertState;
  sosState: SosEmergencyState;
  messages: RoomMessage[];
  isRecordingVoice: boolean;
  recordingSeconds: number;
  playingMessageId: string | null;
  isPickingDestinationOnMap: boolean;
  isPickingCheckpointOnMap: boolean;
  pendingCheckpointName: string;
  isOffRouteSimActive: boolean;
  isStragglerSimActive: boolean;
  destinationPresets: DestinationPreset[];
  onSelectMember: (memberId: string) => void;
  onToggleSimulation: () => void;
  onSelectPreset: (preset: DestinationPreset) => void;
  onPickCustomDestination: (xFraction: number, yFraction: number) => void;
  onTogglePickMode: (enabled: boolean) => void;
  onStartPickCheckpoint: (name: string) => void;
  onCancelPickCheckpoint: () => void;
  onConfirmAddCheckpoint: (
    name: string,
    xFraction: number,
    yFraction: number
  ) => void;
  onRemoveCheckpoint: (checkpointId: string) => void;
  onUpdateMaxStragglerDistance: (meters: number) => void;
  onUpdateOffRouteTolerance: (meters: number) => void;
  onToggleSoundAlert: () => void;
  onToggleOffRouteSim: () => void;
  onToggleStragglerSim: () => void;
  onTriggerSos: () => void;
  onResolveSos: () => void;
  onSendTextMessage: (text: string) => void;
  onStartVoiceRecord: () => void;
  onStopVoiceRecord: () => void;
  onToggleVoicePlay: (msg: RoomMessage) => void;
  onUpdateOwnCondition: (status: MemberConditionStatus) => void;
  onAssignSweeper: (memberId: string) => void;
  onSwitchPreviewRole: (role: UserRole) => void;
  onFinishAndSaveTrip: () => void;
  onExitRoom: () => void;
}

function getMarkerTitle(member: ConvoyMember): string {
  const detail = member.vehicleDetail.trim()
    ? member.vehicleDetail.trim()
    : member.vehicleType === 'MOBIL'
      ? 'Mobil'
      : 'Motor';
  return `${member.fullName} - ${detail}`;
}

function formatDistanceLabel(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km % 1 === 0 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`;
  }
  return `${meters} m`;
}

function formatClockHHmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function calculateDestinationEta(
  member: ConvoyMember | null,
  routeConfig: ConvoyRouteConfig,
  nowMs = Date.now()
): DestinationEtaInfo {
  const progress = Math.max(0, Math.min(1, member?.mapPosition.routeProgress ?? 0));
  const traveledMeters = Math.round(progress * routeConfig.totalRouteMeters);
  const remainingMeters = Math.max(0, routeConfig.totalRouteMeters - traveledMeters);
  const speedKmh = Math.max(0, member?.mapPosition.speedKmh ?? 0);
  const distanceLabel =
    remainingMeters >= 1000
      ? `${(remainingMeters / 1000).toFixed(1)} km`
      : `${remainingMeters} m`;

  if (remainingMeters <= 50) {
    return {
      remainingMeters: 0,
      speedKmh,
      etaMinutes: 0,
      isStopped: false,
      isArrived: true,
      durationLabel: 'Tiba',
      arrivalClockLabel: formatClockHHmm(new Date(nowMs)),
      distanceLabel: '0 m',
    };
  }

  if (speedKmh <= 0) {
    return {
      remainingMeters,
      speedKmh: 0,
      etaMinutes: null,
      isStopped: true,
      isArrived: false,
      durationLabel: 'Berhenti',
      arrivalClockLabel: '--:--',
      distanceLabel,
    };
  }

  const etaMinutes = Math.max(
    1,
    Math.round((remainingMeters / 1000 / speedKmh) * 60)
  );
  const durationLabel =
    etaMinutes >= 60
      ? (() => {
          const hours = Math.floor(etaMinutes / 60);
          const mins = etaMinutes % 60;
          return mins > 0 ? `${hours}j ${mins}m` : `${hours} jam`;
        })()
      : `${etaMinutes} mnt`;

  const arrivalClockLabel = formatClockHHmm(
    new Date(nowMs + etaMinutes * 60_000)
  );

  return {
    remainingMeters,
    speedKmh,
    etaMinutes,
    isStopped: false,
    isArrived: false,
    durationLabel,
    arrivalClockLabel,
    distanceLabel,
  };
}

function conditionLabel(status: MemberConditionStatus): string {
  switch (status) {
    case 'AMAN':
      return 'Aman';
    case 'ISTIRAHAT':
      return 'Istirahat';
    case 'MOGOK':
      return 'Mogok';
    case 'SOS':
      return 'Darurat SOS';
  }
}

function playAlertTone(isUrgent = false) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isUrgent ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isUrgent ? 880 : 740, ctx.currentTime);
    osc.frequency.setValueAtTime(isUrgent ? 660 : 580, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.34);
  } catch {
    // Ignore AudioContext restriction
  }
}

const WAVE_BARS = [10, 20, 14, 28, 18, 32, 22, 16, 26, 14, 20, 12];

export function LiveTrackingMapView({
  activeRoom,
  role,
  selectedMemberId,
  isSimulationRunning,
  routeConfig,
  stragglerAlert,
  offRouteAlert,
  sosState,
  messages,
  isRecordingVoice,
  recordingSeconds,
  playingMessageId,
  isPickingDestinationOnMap,
  isPickingCheckpointOnMap,
  pendingCheckpointName,
  isOffRouteSimActive,
  isStragglerSimActive,
  destinationPresets,
  onSelectMember,
  onToggleSimulation,
  onSelectPreset,
  onPickCustomDestination,
  onTogglePickMode,
  onStartPickCheckpoint,
  onCancelPickCheckpoint,
  onConfirmAddCheckpoint,
  onRemoveCheckpoint,
  onUpdateMaxStragglerDistance,
  onUpdateOffRouteTolerance,
  onToggleSoundAlert,
  onToggleOffRouteSim,
  onToggleStragglerSim,
  onTriggerSos,
  onResolveSos,
  onSendTextMessage,
  onStartVoiceRecord,
  onStopVoiceRecord,
  onToggleVoicePlay,
  onUpdateOwnCondition,
  onAssignSweeper,
  onSwitchPreviewRole,
  onFinishAndSaveTrip,
  onExitRoom,
}: LiveTrackingMapViewProps) {
  const [mapScale, setMapScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [showChatSheet, setShowChatSheet] = useState(false);
  const [showLeaderSettings, setShowLeaderSettings] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [showFinishTripConfirm, setShowFinishTripConfirm] = useState(false);
  const [chatText, setChatText] = useState('');
  const [checkpointNameInput, setCheckpointNameInput] = useState('');
  const [pendingTapCoord, setPendingTapCoord] = useState<{
    xFraction: number;
    yFraction: number;
  } | null>(null);
  const [tapCheckpointNameInput, setTapCheckpointNameInput] = useState('');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const prevAlertKeyRef = useRef('');

  const members = [...(activeRoom?.members ?? [])].sort(
    (a, b) => a.convoyOrderRank - b.convoyOrderRank
  );
  const focusedMember =
    members.find((m) => m.id === selectedMemberId) || members[0] || null;
  const currentUser = members.find((m) => m.isCurrentUser) || members[0] || null;
  const trackedMember = focusedMember || currentUser;
  const etaInfo = calculateDestinationEta(trackedMember, routeConfig);

  useEffect(() => {
    const key = `${offRouteAlert.isOffRoute}-${stragglerAlert.isTriggered}-${sosState.isActive}`;
    if (
      routeConfig.soundAlertEnabled &&
      (offRouteAlert.isOffRoute || stragglerAlert.isTriggered || sosState.isActive) &&
      key !== prevAlertKeyRef.current
    ) {
      playAlertTone(sosState.isActive);
    }
    prevAlertKeyRef.current = key;
  }, [
    offRouteAlert.isOffRoute,
    stragglerAlert.isTriggered,
    sosState.isActive,
    routeConfig.soundAlertEnabled,
  ]);

  useEffect(() => {
    if (showChatSheet && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages.length, showChatSheet]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragOriginRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: panOffset.x,
      startY: panOffset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      !dragOriginRef.current ||
      isPickingDestinationOnMap ||
      isPickingCheckpointOnMap
    ) {
      return;
    }
    const dx = e.clientX - dragOriginRef.current.x;
    const dy = e.clientY - dragOriginRef.current.y;
    setPanOffset({
      x: Math.max(-130, Math.min(130, dragOriginRef.current.startX + dx)),
      y: Math.max(-130, Math.min(130, dragOriginRef.current.startY + dy)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      (isPickingDestinationOnMap || isPickingCheckpointOnMap) &&
      mapContainerRef.current &&
      !(e.target as HTMLElement).closest('button')
    ) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      const xFrac =
        0.5 +
        (e.clientX - rect.left - rect.width / 2 - panOffset.x) /
          (rect.width * mapScale);
      const yFrac =
        0.5 +
        (e.clientY - rect.top - rect.height / 2 - panOffset.y) /
          (rect.height * mapScale);
      const clampedX = Math.max(0.08, Math.min(0.92, xFrac));
      const clampedY = Math.max(0.08, Math.min(0.9, yFrac));

      if (isPickingCheckpointOnMap) {
        if (pendingCheckpointName.trim()) {
          onConfirmAddCheckpoint(
            pendingCheckpointName.trim(),
            clampedX,
            clampedY
          );
        } else {
          setPendingTapCoord({ xFraction: clampedX, yFraction: clampedY });
          setTapCheckpointNameInput('');
        }
      } else if (isPickingDestinationOnMap) {
        onPickCustomDestination(clampedX, clampedY);
      }
    }
    dragOriginRef.current = null;
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendTextMessage(chatText);
    setChatText('');
  };

  const waypoints = routeConfig.waypoints;
  const destPoint = waypoints[waypoints.length - 1];
  const polylinePoints = waypoints
    .map((pt) => `${pt.xFraction * 380},${pt.yFraction * 440}`)
    .join(' ');
  const sliderKm = Math.max(
    0.5,
    Math.min(5.0, routeConfig.maxStragglerDistanceMeters / 1000)
  );

  return (
    <div className="relative flex flex-col h-[680px] bg-[#F8FAFC] dark:bg-[#0B1117] text-[#0F172A] dark:text-[#F1F5F9] overflow-hidden">
      {/* Top App Bar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155]">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={onExitRoom}
            aria-label="Keluar Room"
            className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold font-mono truncate">
              {activeRoom?.roomId || 'KNV-8492'} · Konvoi Live
            </h2>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
              Tujuan: {routeConfig.destinationName} · {routeConfig.checkpoints.length} Rest Area
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowFinishTripConfirm(true)}
            className="px-2 py-1.5 rounded-lg bg-[#DCFCE7] dark:bg-[#064E3B] text-[10px] font-semibold text-[#15803D] dark:text-[#4ADE80] transition-colors cursor-pointer whitespace-nowrap"
          >
            Selesai
          </button>

          <button
            type="button"
            onClick={() =>
              onSwitchPreviewRole(
                role === 'TOUR_LEADER' ? 'MEMBER' : 'TOUR_LEADER'
              )
            }
            className="px-2 py-1.5 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[10px] font-semibold text-[#1D4ED8] dark:text-[#DBEAFE] transition-colors cursor-pointer whitespace-nowrap"
          >
            {role === 'TOUR_LEADER' ? 'Mode: Leader' : 'Mode: Anggota'}
          </button>

          {role === 'TOUR_LEADER' && (
            <button
              type="button"
              onClick={() => setShowLeaderSettings(true)}
              aria-label="Pengaturan Rute & Batas Tertinggal"
              className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 text-[#1D4ED8] dark:text-[#60A5FA] transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Top Participant Strip & Expanded Drawer */}
      <div className="shrink-0 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155] z-20">
        <button
          type="button"
          onClick={() => setParticipantsExpanded((prev) => !prev)}
          className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA] cursor-pointer"
        >
          <span>Peserta Konvoi ({members.length}) · Geser / Ketuk</span>
          {participantsExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {!participantsExpanded ? (
          <div className="px-3.5 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
            {members.map((member) => {
              const selected = member.id === focusedMember?.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    onSelectMember(member.id);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className={`shrink-0 px-2.5 py-1.5 rounded-[14px] border flex items-center gap-2 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/60 border-[#1D4ED8]'
                      : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                  }`}
                >
                  <ConvoyAvatar
                    preset={member.avatarPreset}
                    photoUrl={member.avatarPhotoUrl}
                    name={member.fullName}
                    sizeClass="w-7 h-7"
                    ringClass={
                      member.isCurrentUser
                        ? 'ring-2 ring-[#EA580C]'
                        : 'ring-2 ring-white dark:ring-[#1E293B]'
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold truncate max-w-[78px]">
                      {member.fullName}
                    </p>
                    <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1">
                      {member.vehicleType === 'MOBIL' ? (
                        <Car className="w-3 h-3 shrink-0" />
                      ) : (
                        <Bike className="w-3 h-3 shrink-0" />
                      )}
                      <span>
                        {member.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor'}
                      </span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="px-3.5 pb-3 space-y-2.5">
            {/* Self Condition Quick Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { status: 'AMAN', label: 'Aman' },
                  { status: 'ISTIRAHAT', label: 'Istirahat' },
                  { status: 'MOGOK', label: 'Mogok' },
                ] as Array<{ status: MemberConditionStatus; label: string }>
              ).map((item) => {
                const active = currentUser?.conditionStatus === item.status;
                return (
                  <button
                    key={item.status}
                    type="button"
                    onClick={() => onUpdateOwnCondition(item.status)}
                    className={`py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                      active
                        ? item.status === 'MOGOK'
                          ? 'bg-[#FEF2F2] dark:bg-[#450A0A] border-[#DC2626] text-[#DC2626] dark:text-[#F87171]'
                          : item.status === 'ISTIRAHAT'
                            ? 'bg-[#FFFBEB] dark:bg-[#451A03] border-[#D97706] text-[#B45309] dark:text-[#FBBF24]'
                            : 'bg-[#ECFDF5] dark:bg-[#064E3B] border-[#16A34A] text-[#15803D] dark:text-[#4ADE80]'
                        : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[168px] overflow-y-auto space-y-1.5">
              {members.map((member) => {
                const selected = member.id === focusedMember?.id;
                const condColor =
                  member.conditionStatus === 'AMAN'
                    ? 'text-[#16A34A] dark:text-[#4ADE80]'
                    : member.conditionStatus === 'ISTIRAHAT'
                      ? 'text-[#D97706] dark:text-[#FBBF24]'
                      : 'text-[#DC2626] dark:text-[#F87171]';

                return (
                  <div
                    key={member.id}
                    onClick={() => {
                      onSelectMember(member.id);
                      setPanOffset({ x: 0, y: 0 });
                      setParticipantsExpanded(false);
                    }}
                    className={`rounded-xl border px-3 py-2 flex items-center gap-2.5 cursor-pointer ${
                      selected
                        ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border-[#1D4ED8]'
                        : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                    }`}
                  >
                    <ConvoyAvatar
                      preset={member.avatarPreset}
                      photoUrl={member.avatarPhotoUrl}
                      name={member.fullName}
                      sizeClass="w-9 h-9"
                      ringClass={
                        member.isCurrentUser
                          ? 'ring-2 ring-[#EA580C]'
                          : 'ring-2 ring-[#1D4ED8]'
                      }
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">
                        {getMarkerTitle(member)}
                        {member.isCurrentUser ? ' (Anda)' : ''}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                        {member.isSweeper
                          ? 'Sweeper'
                          : member.role === 'TOUR_LEADER'
                            ? 'Leader'
                            : 'Anggota'}{' '}
                        · {member.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor'} ·{' '}
                        {member.lastLocationText}
                      </p>
                      {role === 'TOUR_LEADER' && member.role !== 'TOUR_LEADER' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssignSweeper(member.id);
                          }}
                          className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                        >
                          <Shield className="w-3 h-3" />
                          <span>
                            {member.isSweeper
                              ? 'Sweeper Aktif'
                              : 'Jadikan Sweeper'}
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`flex items-center justify-end gap-1 text-[11px] font-semibold ${condColor}`}
                      >
                        {member.conditionStatus === 'AMAN' && (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {member.conditionStatus === 'ISTIRAHAT' && (
                          <Coffee className="w-3 h-3" />
                        )}
                        {member.conditionStatus === 'MOGOK' && (
                          <Wrench className="w-3 h-3" />
                        )}
                        {member.conditionStatus === 'SOS' && (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        <span>{conditionLabel(member.conditionStatus)}</span>
                      </div>
                      {(() => {
                        const memberEta = calculateDestinationEta(member, routeConfig);
                        return (
                          <>
                            <p className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                              {member.mapPosition.speedKmh} km/j · ETA{' '}
                              {memberEta.durationLabel}
                            </p>
                            <p className="text-[10px] font-mono text-[#1D4ED8] dark:text-[#60A5FA] tabular-nums">
                              Sisa {memberEta.distanceLabel}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SOS Emergency Banner */}
      {sosState.isActive && (
        <div
          role="alert"
          className="shrink-0 bg-[#991B1B] text-white px-3.5 py-2 flex items-center gap-2.5"
        >
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">
              DARURAT SOS · {sosState.senderName} ({sosState.senderVehicle})
            </p>
            <p className="text-[11px] text-white/90 truncate font-mono">
              {sosState.locationText} ({sosState.latitude.toFixed(4)},{' '}
              {sosState.longitude.toFixed(4)}) · {sosState.triggeredAtLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onResolveSos}
            className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] font-semibold cursor-pointer shrink-0"
          >
            Selesai
          </button>
        </div>
      )}

      {/* Off-Route Banner */}
      {offRouteAlert.isOffRoute && (
        <div
          role="alert"
          className="shrink-0 bg-[#DC2626] text-white px-3.5 py-2 flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-[11px] font-semibold truncate">
            KELUAR JALUR · Menyimpang {offRouteAlert.deviationMeters} m dari rute resmi (batas {offRouteAlert.toleranceMeters} m)
          </p>
        </div>
      )}

      {/* Straggler Alert Banner */}
      {stragglerAlert.isTriggered &&
        stragglerAlert.trailingMember &&
        stragglerAlert.aheadMember && (
          <div
            role="alert"
            className="shrink-0 bg-[#B45309] text-white px-3.5 py-2 flex items-center gap-2"
          >
            <BellRing className="w-4 h-4 shrink-0" />
            <p className="text-[11px] font-semibold truncate flex-1">
              TERTINGGAL {formatDistanceLabel(stragglerAlert.gapMeters)} ·{' '}
              {stragglerAlert.trailingMember.fullName} di belakang{' '}
              {stragglerAlert.aheadMember.fullName}
            </p>
            {routeConfig.soundAlertEnabled && (
              <Volume2 className="w-4 h-4 shrink-0" />
            )}
          </div>
        )}

      {/* Full Live Map Viewport */}
      <div
        ref={mapContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          dragOriginRef.current = null;
        }}
        className={`relative flex-1 overflow-hidden select-none touch-none bg-[#EEF2F6] dark:bg-[#141B22] ${
          isPickingDestinationOnMap || isPickingCheckpointOnMap
            ? 'cursor-crosshair'
            : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <div
          className="absolute inset-0 transition-transform duration-150 ease-out"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${mapScale})`,
            transformOrigin: 'center center',
          }}
        >
          <svg
            aria-hidden="true"
            className="w-full h-full"
            viewBox="0 0 380 440"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern
                id="m3Grid"
                width="42"
                height="42"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 42 0 L 0 0 0 42"
                  fill="none"
                  stroke="currentColor"
                  className="text-[#DCE3EC] dark:text-[#212B36]"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="380" height="440" fill="url(#m3Grid)" />

            <path
              d="M 15 160 L 365 265"
              fill="none"
              stroke="currentColor"
              className="text-white dark:text-[#273240]"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M 90 410 L 145 45"
              fill="none"
              stroke="currentColor"
              className="text-white dark:text-[#273240]"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {waypoints.length >= 2 && (
              <>
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="currentColor"
                  className="text-white dark:text-[#2F3D4D]"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke="#1D4ED8"
                  strokeWidth="5"
                  strokeDasharray="11 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
          </svg>

          {/* Rest Area Checkpoints */}
          {routeConfig.checkpoints.map((cp) => (
            <div
              key={cp.id}
              style={{
                left: `${cp.xFraction * 100}%`,
                top: `${cp.yFraction * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-[85%] flex flex-col items-center pointer-events-none z-10"
            >
              <span className="px-2 py-0.5 rounded-lg bg-[#0F766E] text-white text-[10px] font-semibold whitespace-nowrap max-w-[165px] truncate shadow-sm">
                {cp.name}
              </span>
              <span className="mt-1 w-7 h-7 rounded-full bg-[#0F766E] border-2 border-white shadow-md flex items-center justify-center text-white">
                <Coffee className="w-3.5 h-3.5" />
              </span>
            </div>
          ))}

          {/* Final Destination Flag with Live ETA */}
          {destPoint && (
            <div
              style={{
                left: `${destPoint.xFraction * 100}%`,
                top: `${destPoint.yFraction * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-[85%] flex flex-col items-center pointer-events-none z-10"
            >
              <div className="px-2.5 py-1 rounded-xl bg-[#0F172A] text-white shadow-md text-center max-w-[185px]">
                <p className="text-[10px] font-semibold truncate">
                  Tujuan: {routeConfig.destinationName}
                </p>
                <p className="text-[9px] font-mono text-[#86EFAC] whitespace-nowrap">
                  {etaInfo.isStopped
                    ? `ETA --:-- · ${etaInfo.distanceLabel}`
                    : `ETA ${etaInfo.arrivalClockLabel} · ${etaInfo.durationLabel} · ${etaInfo.distanceLabel}`}
                </p>
              </div>
              <span className="mt-1 w-7 h-7 rounded-full bg-[#16A34A] border-2 border-white shadow-md flex items-center justify-center text-white">
                <Flag className="w-3.5 h-3.5" />
              </span>
            </div>
          )}

          {/* Convoy Member Markers */}
          {members.map((member) => {
            const isSelected = member.id === focusedMember?.id;
            const isSosBeacon =
              member.conditionStatus === 'SOS' ||
              (sosState.isActive && sosState.senderId === member.id);
            const isOffRoute =
              member.offRouteMeters > routeConfig.offRouteToleranceMeters;
            const isStraggler =
              stragglerAlert.isTriggered &&
              stragglerAlert.trailingMember?.id === member.id;
            const title = getMarkerTitle(member);
            const prefix = isSosBeacon
              ? 'SOS · '
              : member.isSweeper
                ? 'Sweeper · '
                : '';
            const displayLabel =
              prefix + (member.isCurrentUser ? `${title} (Anda)` : title);

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectMember(member.id)}
                style={{
                  left: `${member.mapPosition.xFraction * 100}%`,
                  top: `${member.mapPosition.yFraction * 100}%`,
                }}
                className="absolute -translate-x-1/2 -translate-y-[82%] flex flex-col items-center group cursor-pointer focus:outline-none z-20 transition-all duration-700 ease-linear"
              >
                <span
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap max-w-[180px] truncate shadow-sm border transition-colors ${
                    isSosBeacon
                      ? 'bg-[#991B1B] text-white border-[#7F1D1D]'
                      : isOffRoute
                        ? 'bg-[#DC2626] text-white border-[#991B1B]'
                        : isStraggler
                          ? 'bg-[#B45309] text-white border-[#92400E]'
                          : isSelected
                            ? 'bg-[#1D4ED8] text-white border-[#1E40AF]'
                            : 'bg-white dark:bg-[#141C24] text-[#0F172A] dark:text-[#F1F5F9] border-[#CBD5E1] dark:border-[#334155]'
                  }`}
                >
                  {displayLabel}
                </span>

                {/* Circular Avatar perched right above the Vehicle Icon */}
                <div className="mt-1 -mb-1.5 z-10">
                  <ConvoyAvatar
                    preset={member.avatarPreset}
                    photoUrl={member.avatarPhotoUrl}
                    name={member.fullName}
                    sizeClass="w-7 h-7"
                    ringClass={
                      isSosBeacon || isOffRoute
                        ? 'ring-2 ring-[#DC2626]'
                        : 'ring-2 ring-white dark:ring-[#0B1117]'
                    }
                  />
                </div>

                <span className="relative flex items-center justify-center">
                  {isSosBeacon && (
                    <span className="absolute w-11 h-11 rounded-full bg-[#DC2626]/45 animate-ping" />
                  )}
                  <span
                    className={`relative w-8 h-8 rounded-full border-2 border-white dark:border-[#0B1117] shadow-md flex items-center justify-center transition-transform group-hover:scale-110 ${
                      isSosBeacon || isOffRoute
                        ? 'bg-[#DC2626] text-white'
                        : member.isCurrentUser
                          ? 'bg-[#EA580C] text-white'
                          : member.role === 'TOUR_LEADER'
                            ? 'bg-[#1D4ED8] text-white'
                            : 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F1F5F9]'
                    }`}
                  >
                    {isSosBeacon ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : member.vehicleType === 'MOBIL' ? (
                      <Car className="w-4 h-4" />
                    ) : (
                      <Bike className="w-4 h-4" />
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Simulation Quick Controls (Top-Left) */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onToggleOffRouteSim}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border shadow-sm transition-colors cursor-pointer whitespace-nowrap ${
              isOffRouteSimActive
                ? 'bg-[#DC2626] text-white border-[#991B1B]'
                : 'bg-white/95 dark:bg-[#141C24]/95 text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#334155]'
            }`}
          >
            {isOffRouteSimActive ? 'Keluar Jalur: Aktif' : 'Uji Keluar Jalur'}
          </button>

          <button
            type="button"
            onClick={onToggleStragglerSim}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border shadow-sm transition-colors cursor-pointer whitespace-nowrap ${
              isStragglerSimActive
                ? 'bg-[#B45309] text-white border-[#92400E]'
                : 'bg-white/95 dark:bg-[#141C24]/95 text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#334155]'
            }`}
          >
            {isStragglerSimActive ? 'Tertinggal: Aktif' : 'Uji Tertinggal'}
          </button>
        </div>

        {/* Map Controls (Top-Right) */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onToggleSimulation}
            aria-label={isSimulationRunning ? 'Jeda Simulasi' : 'Lanjut Simulasi'}
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-center text-[#1D4ED8] dark:text-[#60A5FA] cursor-pointer"
          >
            {isSimulationRunning ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMapScale((s) => Math.min(1.9, +(s + 0.2).toFixed(1)))}
            aria-label="Perbesar Peta"
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-center cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setMapScale((s) => Math.max(0.85, +(s - 0.2).toFixed(1)))}
            aria-label="Perkecil Peta"
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-center cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMapScale(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            aria-label="Pusatkan Peta"
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] shadow-sm flex items-center justify-center cursor-pointer"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        </div>

        {/* Custom Destination / Checkpoint Placement Hint */}
        {(isPickingDestinationOnMap || isPickingCheckpointOnMap) && (
          <div className="absolute bottom-24 left-3 right-3 z-30 rounded-xl bg-[#0F172A] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-lg">
            <span className="text-xs">
              {isPickingCheckpointOnMap
                ? pendingCheckpointName
                  ? `Ketuk di peta untuk menempatkan "${pendingCheckpointName}"`
                  : 'Ketuk di peta untuk lokasi Titik Istirahat baru'
                : 'Ketuk di peta untuk menetapkan Titik Tujuan baru'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (isPickingCheckpointOnMap) onCancelPickCheckpoint();
                else onTogglePickMode(false);
              }}
              className="text-xs font-semibold text-[#F59E0B] cursor-pointer shrink-0"
            >
              Batal
            </button>
          </div>
        )}

        {/* Bottom-Right Floating Action Buttons: Chat (Blue), Voice PTT (Orange/Amber), SOS (Vivid Red) */}
        <div className="absolute bottom-4 right-3 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowChatSheet(true)}
            className="min-h-[48px] px-3.5 rounded-[16px] bg-[#1D4ED8] hover:bg-[#1E40AF] text-white shadow-lg flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Chat ({messages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isRecordingVoice) {
                onStopVoiceRecord();
                setShowChatSheet(true);
              } else {
                onStartVoiceRecord();
              }
            }}
            aria-label="Rekam Voice Message"
            className={`min-h-[48px] px-3.5 rounded-[16px] text-white shadow-lg flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              isRecordingVoice
                ? 'bg-[#DC2626]'
                : 'bg-[#EA580C] hover:bg-[#C2410C]'
            }`}
          >
            {isRecordingVoice ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span className="font-mono tabular-nums">
                  0:{recordingSeconds.toString().padStart(2, '0')}
                </span>
              </>
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowSosConfirm(true)}
            className="min-h-[50px] px-4 rounded-[18px] bg-[#DC2626] hover:bg-[#B91C1C] active:scale-[0.97] text-white shadow-xl flex items-center gap-1.5 text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>SOS</span>
          </button>
        </div>
      </div>

      {/* Docked Destination ETA Telemetry Bar */}
      <div
        aria-label="Estimasi Waktu Tiba (ETA)"
        className="shrink-0 bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155] px-3.5 py-2.5 flex items-center justify-between gap-2 z-20"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              etaInfo.isArrived
                ? 'bg-[#DCFCE7] dark:bg-[#064E3B] text-[#16A34A] dark:text-[#4ADE80]'
                : 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/60 text-[#1D4ED8] dark:text-[#60A5FA]'
            }`}
          >
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">
              {routeConfig.destinationName}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate">
              <span>
                {!trackedMember || trackedMember.id === currentUser?.id
                  ? 'Posisi Anda'
                  : trackedMember.fullName}
              </span>
              {currentUser && trackedMember && trackedMember.id !== currentUser.id && (
                <button
                  type="button"
                  onClick={() => onSelectMember(currentUser.id)}
                  className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer shrink-0"
                >
                  · Fokus Anda
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p
              className={`text-xs font-bold font-mono tabular-nums ${
                etaInfo.isArrived
                  ? 'text-[#16A34A] dark:text-[#4ADE80]'
                  : etaInfo.isStopped
                    ? 'text-[#D97706] dark:text-[#FBBF24]'
                    : 'text-[#1D4ED8] dark:text-[#60A5FA]'
              }`}
            >
              ETA {etaInfo.arrivalClockLabel}
            </p>
            <p
              className={`text-[10px] font-semibold ${
                etaInfo.isStopped
                  ? 'text-[#D97706] dark:text-[#FBBF24]'
                  : 'text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              {etaInfo.durationLabel}
            </p>
          </div>

          <div className="text-right border-l border-[#E2E8F0] dark:border-[#334155] pl-3">
            <p className="text-xs font-bold font-mono tabular-nums">
              {etaInfo.distanceLabel}
            </p>
            <p className="text-[10px] font-mono tabular-nums text-[#64748B] dark:text-[#94A3B8] flex items-center justify-end gap-1">
              <Gauge className="w-3 h-3 shrink-0" />
              <span>{etaInfo.speedKmh} km/j</span>
            </p>
          </div>
        </div>
      </div>

      {/* Modern Messenger Chat & Interactive Waveform PTT Sheet */}
      {showChatSheet && (
        <div className="absolute inset-0 z-40 bg-black/45 backdrop-blur-[2px] flex items-end">
          <div className="w-full h-[80%] rounded-t-[24px] bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155] flex flex-col shadow-2xl overflow-hidden">
            {/* Sheet Header */}
            <div className="shrink-0 px-4 py-3 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Komunikasi Konvoi</h3>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {activeRoom?.roomId || 'KNV-8492'} · {members.length} Anggota Terhubung
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChatSheet(false)}
                aria-label="Tutup Chat"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messenger Bubbles */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 bg-[#F8FAFC] dark:bg-[#0B1117]"
            >
              {messages.map((msg) => {
                if (msg.type === 'SYSTEM') {
                  return (
                    <p
                      key={msg.id}
                      className="text-center text-[11px] text-[#64748B] dark:text-[#94A3B8] py-0.5"
                    >
                      {msg.timestampLabel} · {msg.textContent}
                    </p>
                  );
                }

                const matchedMember = members.find((m) => m.id === msg.senderId);
                const msgPreset =
                  matchedMember?.avatarPreset ??
                  msg.senderAvatarPreset ??
                  'HELMET_TOURING';
                const msgPhoto =
                  matchedMember?.avatarPhotoUrl ?? msg.senderAvatarPhotoUrl;

                if (msg.type === 'SOS_ALERT') {
                  return (
                    <div
                      key={msg.id}
                      className="rounded-2xl bg-[#FEF2F2] dark:bg-[#450A0A]/50 border border-[#DC2626] p-3 flex items-center gap-2.5"
                    >
                      <ConvoyAvatar
                        preset={msgPreset}
                        photoUrl={msgPhoto}
                        name={msg.senderName}
                        sizeClass="w-8 h-8"
                        ringClass="ring-2 ring-[#DC2626]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-[#991B1B] dark:text-[#FCA5A5]">
                          DARURAT SOS · {msg.senderName} · {msg.timestampLabel}
                        </p>
                        <p className="text-xs text-[#7F1D1D] dark:text-[#FECACA] mt-0.5">
                          {msg.textContent}
                        </p>
                      </div>
                    </div>
                  );
                }

                const isMine = Boolean(msg.isFromCurrentUser);
                const playing = playingMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${
                      isMine ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isMine && (
                      <ConvoyAvatar
                        preset={msgPreset}
                        photoUrl={msgPhoto}
                        name={msg.senderName}
                        sizeClass="w-7 h-7"
                        ringClass="ring-1 ring-[#1D4ED8]"
                      />
                    )}

                    <div
                      className={`max-w-[74%] px-3.5 py-2.5 shadow-xs ${
                        isMine
                          ? 'bg-[#1D4ED8] text-white rounded-[18px] rounded-br-[4px]'
                          : 'bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] rounded-[18px] rounded-bl-[4px]'
                      }`}
                    >
                      {!isMine && (
                        <p className="text-[11px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA] mb-0.5">
                          {msg.senderName} · {msg.senderVehicle}
                        </p>
                      )}

                      {msg.type === 'VOICE' ? (
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => onToggleVoicePlay(msg)}
                            aria-label="Putar Voice Note"
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer ${
                              isMine
                                ? 'bg-white/20 text-white'
                                : 'bg-[#1D4ED8] text-white'
                            }`}
                          >
                            {playing ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-0.5">
                              {[5, 9, 6, 12, 7, 10, 6, 8].map((h, i) => (
                                <span
                                  key={i}
                                  style={{ height: `${h}px` }}
                                  className={`w-0.5 rounded-full ${
                                    isMine
                                      ? 'bg-white/85'
                                      : playing
                                        ? 'bg-[#1D4ED8]'
                                        : 'bg-[#94A3B8]'
                                  }`}
                                />
                              ))}
                            </div>
                            <p
                              className={`text-[10px] font-mono tabular-nums mt-0.5 ${
                                isMine
                                  ? 'text-white/80'
                                  : 'text-[#64748B] dark:text-[#94A3B8]'
                              }`}
                            >
                              0:{String(msg.voiceDurationSec || 2).padStart(2, '0')} ·{' '}
                              {msg.timestampLabel}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs leading-relaxed">
                            {msg.textContent}
                          </p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isMine
                                ? 'text-white/75 text-right'
                                : 'text-[#64748B] dark:text-[#94A3B8]'
                            }`}
                          >
                            {msg.timestampLabel}
                          </p>
                        </>
                      )}
                    </div>

                    {isMine && (
                      <ConvoyAvatar
                        preset={msgPreset}
                        photoUrl={msgPhoto}
                        name={msg.senderName}
                        sizeClass="w-7 h-7"
                        ringClass="ring-1 ring-[#EA580C]"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Large Interactive Waveform PTT Button + Text Composer */}
            <div className="shrink-0 p-3 border-t border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#141C24] space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  if (isRecordingVoice) onStopVoiceRecord();
                  else onStartVoiceRecord();
                }}
                className={`w-full min-h-[60px] px-4 rounded-[18px] text-white shadow-md flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  isRecordingVoice
                    ? 'bg-[#DC2626]'
                    : 'bg-[#EA580C] hover:bg-[#C2410C]'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left min-w-0">
                  {isRecordingVoice ? (
                    <Square className="w-5 h-5 fill-current shrink-0" />
                  ) : (
                    <Mic className="w-5 h-5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      {isRecordingVoice
                        ? 'Sedang Merekam · Ketuk Kirim'
                        : 'Tekan untuk Bicara (Walkie-Talkie)'}
                    </p>
                    <p className="text-[11px] text-white/85 truncate font-mono tabular-nums">
                      {isRecordingVoice
                        ? `0:${recordingSeconds.toString().padStart(2, '0')} · Audio konvoi aktif`
                        : 'Pesan suara instan ke semua anggota'}
                    </p>
                  </div>
                </div>

                {/* Interactive Waveform Audio Bars */}
                <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
                  {WAVE_BARS.map((h, i) => {
                    const barHeight = isRecordingVoice
                      ? Math.min(30, 8 + ((h + recordingSeconds * 7 + i * 5) % 22))
                      : Math.round(h * 0.55) + 4;
                    return (
                      <span
                        key={i}
                        style={{ height: `${barHeight}px` }}
                        className="w-1 rounded-full bg-white/90 transition-all duration-150"
                      />
                    );
                  })}
                </div>
              </button>

              <form onSubmit={handleSendChat} className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Tulis pesan ke rombongan..."
                  className="flex-1 min-w-0 min-h-[42px] px-3.5 rounded-[14px] bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#CBD5E1] dark:border-[#334155] text-xs outline-none focus:border-[#1D4ED8]"
                />
                <button
                  type="submit"
                  aria-label="Kirim Pesan"
                  className="w-11 h-11 rounded-[14px] bg-[#1D4ED8] hover:bg-[#1E40AF] text-white flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Finish & Save Trip Confirmation Modal */}
      {showFinishTripConfirm && (
        <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-5">
          <div className="w-full max-w-[320px] rounded-[22px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#DCFCE7] dark:bg-[#064E3B] text-[#16A34A] dark:text-[#4ADE80] flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Akhiri & Simpan Tour?</h3>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Rekam jejak akan disimpan untuk ekspor GPX.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
              Rute menuju <span className="font-semibold">{routeConfig.destinationName}</span>, titik istirahat, dan daftar peserta akan ditambahkan ke Riwayat Tour.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFinishTripConfirm(false)}
                className="flex-1 min-h-[42px] rounded-xl border border-[#CBD5E1] dark:border-[#334155] text-xs font-semibold cursor-pointer"
              >
                Lanjut Tour
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFinishTripConfirm(false);
                  onFinishAndSaveTrip();
                }}
                className="flex-1 min-h-[42px] rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold cursor-pointer"
              >
                Simpan Riwayat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOS Confirmation Dialog */}
      {showSosConfirm && (
        <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-5">
          <div className="w-full max-w-[320px] rounded-[24px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-5 space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-[#FEF2F2] dark:bg-[#450A0A] flex items-center justify-center mx-auto text-[#DC2626]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold">Kirim Sinyal Darurat SOS?</h3>
              <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                Koordinat Anda (
                <span className="font-mono">
                  {(currentUser?.mapPosition.latitude ?? -6.674).toFixed(4)},{' '}
                  {(currentUser?.mapPosition.longitude ?? 106.925).toFixed(4)}
                </span>
                ) akan dikirim ke seluruh peserta room beserta penanda SOS di peta.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowSosConfirm(false)}
                className="min-h-[44px] rounded-xl border border-[#CBD5E1] dark:border-[#334155] text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSosConfirm(false);
                  onTriggerSos();
                }}
                className="min-h-[44px] rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold cursor-pointer"
              >
                Kirim SOS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leader Route, Checkpoints & Slider Settings Sheet */}
      {showLeaderSettings && role === 'TOUR_LEADER' && (
        <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-[2px] flex items-end">
          <div className="w-full rounded-t-[24px] bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155] p-5 space-y-4 max-h-[86%] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Route className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA]" />
                <h3 className="text-base font-bold">
                  Pengaturan Rute & Peringatan Leader
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaderSettings(false)}
                aria-label="Tutup Pengaturan"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                Titik Tujuan Akhir & Garis Rute Resmi
              </p>
              <div className="grid grid-cols-2 gap-2">
                {destinationPresets.map((preset) => {
                  const active = routeConfig.destinationName === preset.name;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => onSelectPreset(preset)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-left truncate transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A] border-[#1D4ED8] text-[#1D4ED8] dark:text-[#DBEAFE]'
                          : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  onTogglePickMode(true);
                  setShowLeaderSettings(false);
                }}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#CBD5E1] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-[#1D4ED8]" />
                <span>Ketuk Peta untuk Tujuan Kustom</span>
              </button>
            </div>

            <div className="h-px bg-[#E2E8F0] dark:bg-[#334155]" />

            {/* Titik Istirahat (Checkpoint / Rest Area) */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Coffee className="w-4 h-4 text-[#0F766E]" />
                <p className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                  Titik Istirahat (Checkpoint / Rest Area)
                </p>
              </div>

              {routeConfig.checkpoints.length > 0 && (
                <div className="space-y-1.5">
                  {routeConfig.checkpoints.map((cp) => (
                    <div
                      key={cp.id}
                      className="rounded-xl bg-[#F0FDFA] dark:bg-[#042F2E]/40 border border-[#99F6E4] dark:border-[#115E59] px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Coffee className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {cp.name}
                          </p>
                          <p className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                            {cp.latitude.toFixed(4)}, {cp.longitude.toFixed(4)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveCheckpoint(cp.id)}
                        aria-label={`Hapus ${cp.name}`}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={checkpointNameInput}
                onChange={(e) => setCheckpointNameInput(e.target.value)}
                placeholder="Nama titik (mis. Rest Area KM 57)"
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#CBD5E1] dark:border-[#334155] text-xs outline-none focus:border-[#0F766E]"
              />

              <button
                type="button"
                onClick={() => {
                  const chosen = checkpointNameInput.trim();
                  setCheckpointNameInput('');
                  setShowLeaderSettings(false);
                  onStartPickCheckpoint(chosen);
                }}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Coffee className="w-4 h-4" />
                <span>Tambah Titik Istirahat (Pilih di Peta)</span>
              </button>
            </div>

            <div className="h-px bg-[#E2E8F0] dark:bg-[#334155]" />

            {/* Interactive Slider for Max Straggler Distance */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                Batas Jarak Maksimal Tertinggal:{' '}
                <span className="text-[#1D4ED8] dark:text-[#60A5FA] font-mono tabular-nums">
                  {sliderKm.toFixed(1)} km
                </span>
              </p>
              <input
                type="range"
                aria-label="Batas Jarak Maksimal Tertinggal"
                min="0.5"
                max="5.0"
                step="0.5"
                value={sliderKm}
                onChange={(e) =>
                  onUpdateMaxStragglerDistance(
                    Math.round(parseFloat(e.target.value) * 1000)
                  )
                }
                className="w-full accent-[#EA580C] cursor-pointer h-2 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
                <span>0.5 km</span>
                <span>2.5 km</span>
                <span>5.0 km</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                Toleransi Keluar Jalur:{' '}
                <span className="text-[#1D4ED8] dark:text-[#60A5FA] font-mono">
                  {routeConfig.offRouteToleranceMeters} m
                </span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[30, 50, 100].map((meters) => {
                  const active = routeConfig.offRouteToleranceMeters === meters;
                  return (
                    <button
                      key={meters}
                      type="button"
                      onClick={() => onUpdateOffRouteTolerance(meters)}
                      className={`min-h-[38px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                          : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                      }`}
                    >
                      {meters} m
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <p className="text-xs font-semibold">
                  Peringatan Suara (Audio Alert)
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Bunyikan nada peringatan saat SOS, keluar jalur, atau tertinggal.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={routeConfig.soundAlertEnabled}
                onClick={onToggleSoundAlert}
                className={`w-12 h-7 rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                  routeConfig.soundAlertEnabled
                    ? 'bg-[#1D4ED8]'
                    : 'bg-[#CBD5E1] dark:bg-[#334155]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    routeConfig.soundAlertEnabled
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowLeaderSettings(false)}
              className="w-full min-h-[46px] rounded-[14px] bg-[#EA580C] hover:bg-[#C2410C] text-white text-sm font-semibold cursor-pointer"
            >
              Terapkan ke Room
            </button>
          </div>
        </div>
      )}

      {/* Fallback Dialog if Leader Tapped Map Without Entering Checkpoint Name */}
      {pendingTapCoord && (
        <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-5">
          <div className="w-full max-w-[320px] rounded-[24px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center gap-2 text-[#0F766E]">
              <Coffee className="w-5 h-5" />
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                Beri Nama Titik Istirahat
              </h3>
            </div>
            <input
              type="text"
              value={tapCheckpointNameInput}
              onChange={(e) => setTapCheckpointNameInput(e.target.value)}
              placeholder="Contoh: Rest Area KM 57"
              autoFocus
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#CBD5E1] dark:border-[#334155] text-xs outline-none focus:border-[#0F766E]"
            />
            <div className="flex flex-wrap gap-1.5">
              {['Rest Area KM 57', 'SPBU Cisarua'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setTapCheckpointNameInput(sample)}
                  className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] text-[11px] font-medium text-[#334155] dark:text-[#CBD5E1] cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPendingTapCoord(null);
                  onCancelPickCheckpoint();
                }}
                className="min-h-[42px] rounded-xl border border-[#CBD5E1] dark:border-[#334155] text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirmAddCheckpoint(
                    tapCheckpointNameInput.trim() || 'Rest Area Konvoi',
                    pendingTapCoord.xFraction,
                    pendingTapCoord.yFraction
                  );
                  setPendingTapCoord(null);
                  setTapCheckpointNameInput('');
                }}
                className="min-h-[42px] rounded-xl bg-[#0F766E] hover:bg-[#0D9488] text-white text-xs font-semibold cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
