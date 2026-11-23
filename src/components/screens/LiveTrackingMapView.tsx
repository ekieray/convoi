import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Bike,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Cloud,
  Coffee,
  Copy,
  Eye,
  EyeOff,
  Flag,
  Gauge,
  Info,
  Link2,
  Loader2,
  LocateFixed,
  MapPin,
  MessageCircle,
  Mic,
  Navigation,
  Pause,
  Play,
  Route,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  Square,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts';
import {
  ConvoyMember,
  ConvoyRouteConfig,
  DestinationEtaInfo,
  DestinationPreset,
  MemberConditionStatus,
  OffRouteAlertState,
  RoomMessage,
  RouteInstruction,
  SosEmergencyState,
  StragglerAlertState,
  TourRoom,
  UserRole,
  VehicleType,
} from '../../types/convoy';
import { ConvoyAvatar } from '../ConvoyAvatar';
import { LiveTomTomConvoyMap } from '../map/LiveTomTomConvoyMap';
import { GpsPermissionStatus } from '../../hooks/useDeviceGps';
import {
  searchTomTomPlaces,
  TomTomPlaceResult,
} from '../../services/tomtomMapService';
import { LatLngPoint } from '../../utils/geo';

interface LiveTrackingMapViewProps {
  activeRoom: TourRoom | null;
  role: UserRole;
  selectedMemberId: string | null;
  isSimulationRunning: boolean;
  routeConfig: ConvoyRouteConfig;
  vehicleType?: VehicleType;
  stragglerAlert: StragglerAlertState;
  offRouteAlert: OffRouteAlertState;
  sosState: SosEmergencyState;
  messages: RoomMessage[];
  isRecordingVoice: boolean;
  recordingSeconds: number;
  playingMessageId: string | null;
  voiceStatusMessage?: string | null;
  isPickingDestinationOnMap: boolean;
  isPickingCheckpointOnMap: boolean;
  pendingCheckpointName: string;
  isOffRouteSimActive: boolean;
  isStragglerSimActive: boolean;
  isLeaderTroubleSimActive: boolean;
  canPingTomTomRouting: boolean;
  isEffectiveLeader: boolean;
  destinationPresets: DestinationPreset[];
  darkMode?: boolean;
  gpsStatus: GpsPermissionStatus;
  gpsAccuracyMeters?: number;
  gpsErrorMessage?: string | null;
  onRetryGps: () => void;
  onRouteComputed?: (
    distanceMeters: number,
    durationMillis: number,
    path: LatLngPoint[],
    instructions?: RouteInstruction[]
  ) => void;
  onSelectMember: (memberId: string) => void;
  onToggleSimulation: () => void;
  onSelectPreset: (preset: DestinationPreset) => void;
  onPickDestinationLatLng: (
    lat: number,
    lng: number,
    placeName?: string,
    addressLabel?: string
  ) => void;
  onTogglePickMode: (enabled: boolean) => void;
  onStartPickCheckpoint: (name: string) => void;
  onCancelPickCheckpoint: () => void;
  onConfirmAddCheckpointLatLng: (
    name: string,
    lat: number,
    lng: number
  ) => void;
  onRemoveCheckpoint: (checkpointId: string) => void;
  onUpdateMaxStragglerDistance: (meters: number) => void;
  onUpdateOffRouteTolerance: (meters: number) => void;
  onToggleSoundAlert: () => void;
  onToggleOffRouteSim: () => void;
  onToggleStragglerSim: () => void;
  onToggleLeaderTroubleSim: () => void;
  onReclaimLeader: () => void;
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

  const formatDurationText = (mins: number) => {
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return remMins > 0 ? `${hours}j ${remMins}m` : `${hours} jam`;
    }
    return `${mins} mnt`;
  };

  if (speedKmh <= 0) {
    const remainingFraction = Math.max(0.02, 1 - progress);
    const routeApiMinutes =
      routeConfig.estimatedDurationMillis && routeConfig.estimatedDurationMillis > 0
        ? Math.round((routeConfig.estimatedDurationMillis * remainingFraction) / 60_000)
        : 0;
    const estMinutes = Math.max(
      1,
      routeApiMinutes > 0
        ? routeApiMinutes
        : Math.round((remainingMeters / 1000 / 45) * 60)
    );
    const estArrivalClock = `~${formatClockHHmm(new Date(nowMs + estMinutes * 60_000))}`;

    return {
      remainingMeters,
      speedKmh: 0,
      etaMinutes: estMinutes,
      isStopped: true,
      isArrived: false,
      durationLabel: `Est. ${formatDurationText(estMinutes)} · Diam`,
      arrivalClockLabel: estArrivalClock,
      distanceLabel,
    };
  }

  const etaMinutes = Math.max(
    1,
    Math.round((remainingMeters / 1000 / speedKmh) * 60)
  );
  const durationLabel = formatDurationText(etaMinutes);

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

interface SpeedHistoryPoint {
  bucketMinute: number;
  timeLabel: string;
  avgSpeed: number;
}

function buildInitialSpeedHistory(baseSpeed: number, nowMs = Date.now()): SpeedHistoryPoint[] {
  const safeBase = Math.max(0, Math.round(baseSpeed));
  const offsets = [-4, -2, 1, -1, 3, 2, -2, 1, 2, 0];
  return offsets.map((delta, idx) => {
    const minutesAgo = 9 - idx;
    const tMs = nowMs - minutesAgo * 60_000;
    const d = new Date(tMs);
    const val = safeBase === 0 ? 0 : Math.max(12, Math.min(130, safeBase + delta));
    return {
      bucketMinute: Math.floor(tMs / 60_000),
      timeLabel: minutesAgo === 0 ? 'Skgr' : formatClockHHmm(d),
      avgSpeed: val,
    };
  });
}

export function LiveTrackingMapView({
  activeRoom,
  role,
  selectedMemberId,
  isSimulationRunning,
  routeConfig,
  vehicleType,
  stragglerAlert,
  offRouteAlert,
  sosState,
  messages,
  isRecordingVoice,
  recordingSeconds,
  playingMessageId,
  voiceStatusMessage,
  isPickingDestinationOnMap,
  isPickingCheckpointOnMap,
  pendingCheckpointName,
  isOffRouteSimActive,
  isStragglerSimActive,
  isLeaderTroubleSimActive,
  canPingTomTomRouting,
  isEffectiveLeader,
  destinationPresets,
  darkMode,
  gpsStatus,
  gpsAccuracyMeters,
  gpsErrorMessage,
  onRetryGps,
  onRouteComputed,
  onSelectMember,
  onToggleSimulation,
  onSelectPreset,
  onPickDestinationLatLng,
  onTogglePickMode,
  onStartPickCheckpoint,
  onCancelPickCheckpoint,
  onConfirmAddCheckpointLatLng,
  onRemoveCheckpoint,
  onUpdateMaxStragglerDistance,
  onUpdateOffRouteTolerance,
  onToggleSoundAlert,
  onToggleOffRouteSim,
  onToggleStragglerSim,
  onToggleLeaderTroubleSim,
  onReclaimLeader,
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
  const [isNavigationMode, setIsNavigationMode] = useState(true);
  const [isNavInfoHidden, setIsNavInfoHidden] = useState(true);
  const [showSideInfoDrawer, setShowSideInfoDrawer] = useState(false);
  const [sideInfoTouchTick, setSideInfoTouchTick] = useState(0);
  const [sideInfoSecondsLeft, setSideInfoSecondsLeft] = useState(7);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [showChatSheet, setShowChatSheet] = useState(false);
  const [showLeaderSettings, setShowLeaderSettings] = useState(false);
  const [showShareRoomModal, setShowShareRoomModal] = useState(false);
  const [shareCopiedType, setShareCopiedType] = useState<
    'id' | 'web' | 'link' | null
  >(null);
  const [destSearchQuery, setDestSearchQuery] = useState('');
  const [destSearchResults, setDestSearchResults] = useState<
    TomTomPlaceResult[]
  >([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);
  const [showFinishTripConfirm, setShowFinishTripConfirm] = useState(false);
  const [chatText, setChatText] = useState('');
  const [dismissedSosKey, setDismissedSosKey] = useState('');
  const [sosFlashSecondsLeft, setSosFlashSecondsLeft] = useState(10);

  const currentSosKey = sosState.isActive
    ? `${sosState.senderId}|${sosState.triggeredAtLabel}`
    : '';
  const showSosFlashOverlay =
    Boolean(currentSosKey) && currentSosKey !== dismissedSosKey;

  useEffect(() => {
    if (!currentSosKey) {
      setDismissedSosKey('');
      setSosFlashSecondsLeft(10);
      return;
    }
    if (currentSosKey === dismissedSosKey) return;
    setSosFlashSecondsLeft(10);
    const intervalId = window.setInterval(() => {
      setSosFlashSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          setDismissedSosKey(currentSosKey);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [currentSosKey, dismissedSosKey]);

  useEffect(() => {
    if (!showLeaderSettings) return;
    const trimmed = destSearchQuery.trim();
    if (trimmed.length < 2) {
      setDestSearchResults([]);
      setIsSearchingDest(false);
      return;
    }
    let cancelled = false;
    setIsSearchingDest(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await searchTomTomPlaces(trimmed);
        if (!cancelled) setDestSearchResults(res);
      } catch {
        if (!cancelled) setDestSearchResults([]);
      } finally {
        if (!cancelled) setIsSearchingDest(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [destSearchQuery, showLeaderSettings]);

  const getWebRoomShareLink = (roomId: string) => {
    if (typeof window === 'undefined') {
      return `https://konvoiku.id/join/${encodeURIComponent(roomId)}`;
    }
    return `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
  };

  const handleCopyShare = async (
    text: string,
    type: 'id' | 'web' | 'link'
  ) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard failure
    }
    setShareCopiedType(type);
    window.setTimeout(() => setShareCopiedType(null), 1800);
  };

  const handleNativeShareRoom = async () => {
    if (!activeRoom) return;
    const webLink = getWebRoomShareLink(activeRoom.roomId);
    const shareText = `Gabung konvoi "${activeRoom.roomTitle}" di KonvoiKu!\nKode Room: ${activeRoom.roomId}\nLink Browser: ${webLink}\nLink APK: ${activeRoom.inviteLink}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Undangan Konvoi ${activeRoom.roomId}`,
          text: shareText,
          url: webLink,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyShare(webLink, 'web');
  };

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const prevAlertKeyRef = useRef('');

  // Auto-transition to Clean Turn-by-Turn GPS Navigation Mode whenever a convoy starts/opens
  useEffect(() => {
    if (activeRoom?.roomId) {
      setIsNavigationMode(true);
      setIsNavInfoHidden(true);
      setShowSideInfoDrawer(false);
    }
  }, [activeRoom?.roomId]);

  // Auto-hide Side Info Drawer after 7 seconds of inactivity
  useEffect(() => {
    if (!showSideInfoDrawer) return;
    setSideInfoSecondsLeft(7);
    const intervalId = window.setInterval(() => {
      setSideInfoSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          setShowSideInfoDrawer(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [showSideInfoDrawer, sideInfoTouchTick]);

  const touchSideDrawer = () => setSideInfoTouchTick((t) => t + 1);
  const openSideDrawer = () => {
    setShowSideInfoDrawer(true);
    setSideInfoTouchTick((t) => t + 1);
  };

  const members = [...(activeRoom?.members ?? [])].sort(
    (a, b) => a.convoyOrderRank - b.convoyOrderRank
  );
  const focusedMember =
    members.find((m) => m.id === selectedMemberId) || members[0] || null;
  const currentUser = members.find((m) => m.isCurrentUser) || members[0] || null;
  const trackedMember = focusedMember || currentUser;
  const actingLeaderMember =
    members.find((m) => m.isActingLeader) ||
    members.find((m) => m.id === activeRoom?.actingLeaderUid) ||
    null;
  const coLeaderMember =
    members.find((m) => m.isCoLeader) ||
    members.find((m) => m.id === activeRoom?.coLeaderUid) ||
    null;
  const sweeperMember = members.find((m) => m.isSweeper) || null;
  const etaInfo = calculateDestinationEta(trackedMember, routeConfig);

  const activeSpeedValues = members
    .filter((m) => m.conditionStatus !== 'MOGOK' && m.conditionStatus !== 'SOS')
    .map((m) => Math.max(0, m.mapPosition.speedKmh));
  const convoyAvgSpeedKmh =
    activeSpeedValues.length > 0
      ? Math.round(
          activeSpeedValues.reduce((sum, v) => sum + v, 0) /
            activeSpeedValues.length
        )
      : 0;

  const [speedHistory, setSpeedHistory] = useState<SpeedHistoryPoint[]>(() =>
    buildInitialSpeedHistory(convoyAvgSpeedKmh)
  );

  useEffect(() => {
    const nowMs = Date.now();
    const currentBucket = Math.floor(nowMs / 60_000);
    setSpeedHistory((prev) => {
      const base =
        prev.length > 0 ? [...prev] : buildInitialSpeedHistory(convoyAvgSpeedKmh, nowMs);
      const last = base[base.length - 1];
      if (last && last.bucketMinute === currentBucket) {
        base[base.length - 1] = {
          ...last,
          timeLabel: 'Skgr',
          avgSpeed: convoyAvgSpeedKmh,
        };
      } else {
        base.push({
          bucketMinute: currentBucket,
          timeLabel: 'Skgr',
          avgSpeed: convoyAvgSpeedKmh,
        });
      }
      const cutoff = currentBucket - 9;
      return base
        .filter((pt) => pt.bucketMinute >= cutoff)
        .slice(-10)
        .map((pt, idx, arr) => ({
          ...pt,
          timeLabel:
            idx === arr.length - 1
              ? 'Skgr'
              : formatClockHHmm(new Date(pt.bucketMinute * 60_000)),
        }));
    });
  }, [convoyAvgSpeedKmh, activeRoom?.roomId]);

  const avgTenMinSpeed =
    speedHistory.length > 0
      ? Math.round(
          speedHistory.reduce((sum, pt) => sum + pt.avgSpeed, 0) /
            speedHistory.length
        )
      : convoyAvgSpeedKmh;
  const firstTenMinSpeed = speedHistory[0]?.avgSpeed ?? avgTenMinSpeed;
  const speedDeltaTenMin = convoyAvgSpeedKmh - firstTenMinSpeed;

  useEffect(() => {
    const key = `${offRouteAlert.isOffRoute}-${stragglerAlert.isTriggered}-${currentSosKey}`;
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
    currentSosKey,
    routeConfig.soundAlertEnabled,
  ]);

  useEffect(() => {
    if (showChatSheet && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages.length, showChatSheet]);

  const handlePickCoordinateOnMap = (lat: number, lng: number) => {
    if (isPickingDestinationOnMap) {
      onPickDestinationLatLng(lat, lng);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendTextMessage(chatText);
    setChatText('');
  };

  const sliderKm = Math.max(
    0.5,
    Math.min(5.0, routeConfig.maxStragglerDistanceMeters / 1000)
  );
  const activeNavMode = isNavigationMode && !isPickingDestinationOnMap;
  const isCleanNavHud = activeNavMode && isNavInfoHidden;

  return (
    <div
      id="live_map"
      className="relative flex flex-col h-[680px] bg-[#F8FAFC] dark:bg-[#0B1117] text-[#0F172A] dark:text-[#F1F5F9] overflow-hidden"
    >
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
              Tujuan: {routeConfig.destinationName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() =>
              setIsNavigationMode((prev) => {
                const next = !prev;
                if (next) setIsNavInfoHidden(true);
                return next;
              })
            }
            className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              isNavigationMode
                ? 'bg-[#EA580C] text-white'
                : 'bg-[#FFF7ED] dark:bg-[#431407] text-[#C2410C] dark:text-[#FB923C] border border-[#FED7AA] dark:border-[#9A3412]'
            }`}
          >
            <Navigation className="w-3 h-3 shrink-0" />
            <span>{isNavigationMode ? 'Pantau Peta' : 'Navigasi GPS'}</span>
          </button>

          {activeNavMode && (
            <button
              type="button"
              onClick={() => setIsNavInfoHidden((v) => !v)}
              title={
                isNavInfoHidden
                  ? 'Tampilkan Info Lengkap di Layar'
                  : 'Sembunyikan Info (Layar Navigasi Bersih)'
              }
              className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 border ${
                isNavInfoHidden
                  ? 'bg-[#0F172A] dark:bg-[#1E293B] text-white border-[#334155]'
                  : 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/50 text-[#1D4ED8] dark:text-[#93C5FD] border-[#BFDBFE] dark:border-[#1E40AF]'
              }`}
            >
              {isNavInfoHidden ? (
                <EyeOff className="w-3 h-3 shrink-0" />
              ) : (
                <Eye className="w-3 h-3 shrink-0" />
              )}
              <span>{isNavInfoHidden ? 'Bersih' : 'Info HUD'}</span>
            </button>
          )}

          {activeRoom && (
            <button
              type="button"
              onClick={() => setShowShareRoomModal(true)}
              title="Bagikan Link / Kode Room"
              aria-label="Bagikan Link atau Kode Room"
              className="min-w-[32px] min-h-[32px] px-1.5 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A]/50 text-[#1D4ED8] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#1E40AF] flex items-center justify-center gap-1 text-[10px] font-semibold cursor-pointer shrink-0"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowFinishTripConfirm(true)}
            className="px-2 py-1.5 rounded-lg bg-[#DCFCE7] dark:bg-[#064E3B] text-[10px] font-semibold text-[#15803D] dark:text-[#4ADE80] transition-colors cursor-pointer whitespace-nowrap"
          >
            Selesai
          </button>

          {!activeRoom?.isSyncedRoom && (
            <button
              type="button"
              onClick={() =>
                onSwitchPreviewRole(
                  role === 'TOUR_LEADER' ? 'MEMBER' : 'TOUR_LEADER'
                )
              }
              className="px-2 py-1.5 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A] text-[10px] font-semibold text-[#1D4ED8] dark:text-[#DBEAFE] transition-colors cursor-pointer whitespace-nowrap"
            >
              {role === 'TOUR_LEADER' ? 'Leader' : 'Anggota'}
            </button>
          )}

          {isEffectiveLeader && (
            <button
              type="button"
              onClick={() => setShowLeaderSettings(true)}
              aria-label="Pengaturan Rute & Batas Tertinggal"
              className="min-w-[34px] min-h-[34px] rounded-full flex items-center justify-center hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 text-[#1D4ED8] dark:text-[#60A5FA] transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Top Participant Strip & Expanded Drawer (Hidden during Clean Navigation Mode) */}
      {!isCleanNavHud && (
        <div className="shrink-0 bg-white dark:bg-[#141C24] border-b border-[#E2E8F0] dark:border-[#334155] z-20">
        <button
          type="button"
          onClick={() => setParticipantsExpanded((prev) => !prev)}
          className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA] cursor-pointer"
        >
          <span className="truncate">
            Peserta ({members.length})
            {actingLeaderMember && activeRoom?.leaderTroubleActive
              ? ` · Plt.Leader: ${actingLeaderMember.fullName}`
              : coLeaderMember
                ? ` · Co-Leader: ${coLeaderMember.fullName}`
                : ''}
            {sweeperMember
              ? ` · Sweeper: ${sweeperMember.fullName}${sweeperMember.isAutoSweeper ? ' (Auto)' : ''}`
              : ''}
          </span>
          {participantsExpanded ? (
            <ChevronUp className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0" />
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
                  onClick={() => onSelectMember(member.id)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-[14px] border flex items-center gap-2 text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/60 border-[#1D4ED8]'
                      : member.isActingLeader
                        ? 'bg-[#E0F2FE] dark:bg-[#0C4A6E]/40 border-[#0284C7]'
                        : member.isSweeper
                          ? 'bg-[#FFFBEB] dark:bg-[#451A03]/40 border-[#D97706]'
                          : member.isCoLeader
                            ? 'bg-[#F5F3FF] dark:bg-[#2E1065]/40 border-[#7C3AED]'
                            : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                  }`}
                >
                  <ConvoyAvatar
                    preset={member.avatarPreset}
                    photoUrl={member.avatarPhotoUrl}
                    name={member.fullName}
                    sizeClass="w-7 h-7"
                    ringClass={
                      member.isActingLeader
                        ? 'ring-2 ring-[#0284C7]'
                        : member.isSweeper
                          ? 'ring-2 ring-[#D97706]'
                          : member.isCoLeader
                            ? 'ring-2 ring-[#7C3AED]'
                            : member.isCurrentUser
                              ? 'ring-2 ring-[#EA580C]'
                              : 'ring-2 ring-white dark:ring-[#1E293B]'
                    }
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-[11px] font-semibold truncate max-w-[78px]">
                        {member.fullName}
                      </p>
                      {member.isActingLeader && (
                        <span className="px-1 py-0.2 rounded bg-[#0284C7] text-white text-[8px] font-bold">
                          Plt
                        </span>
                      )}
                      {!member.isActingLeader && member.isCoLeader && (
                        <span className="px-1 py-0.2 rounded bg-[#7C3AED] text-white text-[8px] font-bold">
                          Co
                        </span>
                      )}
                      {member.isSweeper && (
                        <span className="px-1 py-0.2 rounded bg-[#B45309] text-white text-[8px] font-bold">
                          {member.isAutoSweeper ? 'Swp·Auto' : 'Swp'}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1">
                      {member.vehicleType === 'MOBIL' ? (
                        <Car className="w-3 h-3 shrink-0" />
                      ) : (
                        <Bike className="w-3 h-3 shrink-0" />
                      )}
                      <span>
                        {member.isSweeper
                          ? member.isAutoSweeper
                            ? 'Sweeper (Auto)'
                            : 'Sweeper'
                          : member.isCoLeader && typeof member.distanceToLeaderMeters === 'number'
                            ? `${formatDistanceLabel(member.distanceToLeaderMeters)}`
                            : member.vehicleType === 'MOBIL'
                              ? 'Mobil'
                              : 'Motor'}
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
                        {member.isActingLeader
                          ? 'Plt. Leader (Failover)'
                          : member.isCoLeader && member.isSweeper
                            ? `Co-Leader & ${member.isAutoSweeper ? 'Sweeper (Auto)' : 'Sweeper'}`
                            : member.isCoLeader
                              ? `Co-Leader (${formatDistanceLabel(member.distanceToLeaderMeters ?? 0)} dari Leader)`
                              : member.isSweeper
                                ? member.isAutoSweeper
                                  ? 'Sweeper (Auto · Paling Belakang)'
                                  : 'Sweeper'
                                : member.role === 'TOUR_LEADER'
                                  ? activeRoom?.leaderTroubleActive
                                    ? 'Leader (Trouble HP)'
                                    : 'Leader'
                                  : 'Anggota'}{' '}
                        · {member.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor'} ·{' '}
                        {member.lastLocationText}
                      </p>
                      {isEffectiveLeader && member.role !== 'TOUR_LEADER' && !member.isActingLeader && (
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
                            {member.isSweeper && !member.isAutoSweeper
                              ? 'Sweeper Aktif'
                              : member.isAutoSweeper
                                ? 'Tetapkan Sweeper'
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

      {/* Leader Trouble & Co-Leader Failover Banner */}
      {activeRoom?.leaderTroubleActive && (
        <div
          role="alert"
          className="shrink-0 bg-[#4C1D95] text-white px-3.5 py-2 flex items-center gap-2.5"
        >
          <Shield className="w-4 h-4 shrink-0 text-[#DDD6FE]" />
          <p className="text-[11px] font-semibold truncate flex-1">
            {activeRoom.leaderTroubleReason || 'HP Leader trouble (sinyal/baterai)'} · Co-Leader{' '}
            {actingLeaderMember?.fullName || 'Pengganti'} mengambil alih rute & TomTom
          </p>
          {(role === 'TOUR_LEADER' ||
            (currentUser && currentUser.id === activeRoom.leaderUid)) && (
            <button
              type="button"
              onClick={onReclaimLeader}
              className="px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-[10px] font-bold cursor-pointer shrink-0"
            >
              Pulihkan Leader
            </button>
          )}
        </div>
      )}

      {/* Full Live TomTom Map Viewport */}
      <div className="relative flex-1 min-h-[320px] overflow-hidden bg-[#EEF2F6] dark:bg-[#141B22]">
        <div className="absolute inset-0">
          <LiveTomTomConvoyMap
            members={members}
            focusedMember={focusedMember}
            routeConfig={routeConfig}
            vehicleType={vehicleType || currentUser?.vehicleType || 'MOTOR'}
            stragglerAlert={stragglerAlert}
            sosState={sosState}
            etaInfo={etaInfo}
            darkMode={darkMode}
            isPickingDestination={isPickingDestinationOnMap}
            isPickingCheckpoint={false}
            isNavigationMode={isNavigationMode}
            cleanNavMode={isCleanNavHud}
            canPingTomTomRouting={canPingTomTomRouting}
            onToggleNavigationMode={() =>
              setIsNavigationMode((prev) => {
                const next = !prev;
                if (next) setIsNavInfoHidden(true);
                return next;
              })
            }
            onSelectMember={onSelectMember}
            onPickCoordinateOnMap={handlePickCoordinateOnMap}
            onRouteComputed={onRouteComputed}
          />
        </div>

        {/* Top-Left Live GPS, Sync Badge, Economical API Indicator & Sim Controls (Hidden when Clean Nav HUD active) */}
        {!isCleanNavHud ? (
          <div
            className={`absolute left-2.5 z-20 flex flex-col gap-1.5 max-w-[68%] transition-all ${
              activeNavMode ? 'top-[78px]' : 'top-3'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onRetryGps}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold border shadow-sm flex items-center gap-1.5 cursor-pointer ${
                  gpsStatus === 'active'
                    ? 'bg-[#ECFDF5]/95 dark:bg-[#064E3B]/95 text-[#15803D] dark:text-[#4ADE80] border-[#86EFAC] dark:border-[#166534]'
                    : gpsStatus === 'denied' || gpsStatus === 'unavailable'
                      ? 'bg-[#FEF2F2]/95 dark:bg-[#450A0A]/95 text-[#DC2626] dark:text-[#FCA5A5] border-[#FCA5A5] dark:border-[#991B1B]'
                      : 'bg-white/95 dark:bg-[#141C24]/95 text-[#1D4ED8] dark:text-[#60A5FA] border-[#E2E8F0] dark:border-[#334155]'
                }`}
              >
                <LocateFixed className="w-3 h-3 shrink-0" />
                <span>
                  {gpsStatus === 'active'
                    ? `GPS Aktif ±${gpsAccuracyMeters ?? 15}m`
                    : gpsStatus === 'requesting'
                      ? 'Mencari Sinyal GPS...'
                      : gpsStatus === 'denied'
                        ? 'Izin GPS Ditolak (Coba Lagi)'
                        : gpsStatus === 'unavailable'
                          ? 'GPS Tidak Tersedia'
                          : 'GPS Siap'}
                </span>
              </button>

              {activeRoom?.isSyncedRoom && (
                <span className="px-2 py-1 rounded-xl text-[10px] font-semibold bg-[#1D4ED8]/95 text-white shadow-sm flex items-center gap-1">
                  <Cloud className="w-3 h-3 shrink-0" />
                  <span>Room Sync</span>
                </span>
              )}

              <span
                className={`px-2 py-1 rounded-xl text-[10px] font-semibold shadow-sm border flex items-center gap-1 ${
                  canPingTomTomRouting
                    ? 'bg-[#EFF6FF]/95 dark:bg-[#1E3A8A]/90 text-[#1D4ED8] dark:text-[#DBEAFE] border-[#BFDBFE] dark:border-[#1E40AF]'
                    : 'bg-[#F5F3FF]/95 dark:bg-[#2E1065]/90 text-[#6D28D9] dark:text-[#DDD6FE] border-[#DDD6FE] dark:border-[#5B21B6]'
                }`}
              >
                <Route className="w-3 h-3 shrink-0" />
                <span>
                  {canPingTomTomRouting
                    ? activeRoom?.leaderTroubleActive
                      ? 'Ping TomTom: Plt. Leader'
                      : 'Ping TomTom: HP Leader'
                    : 'Salinan Rute Leader (Hemat API)'}
                </span>
              </span>
            </div>

            {gpsStatus === 'denied' && gpsErrorMessage && (
              <div className="px-2.5 py-1.5 rounded-xl bg-[#FEF2F2]/95 dark:bg-[#450A0A]/95 border border-[#FCA5A5] dark:border-[#991B1B] text-[10px] leading-snug text-[#991B1B] dark:text-[#FECACA] shadow-sm">
                {gpsErrorMessage}
              </div>
            )}

            {!activeRoom?.isSyncedRoom && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={onToggleOffRouteSim}
                  className={`px-2 py-1 rounded-xl text-[10px] font-semibold border shadow-sm transition-colors cursor-pointer whitespace-nowrap ${
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
                  className={`px-2 py-1 rounded-xl text-[10px] font-semibold border shadow-sm transition-colors cursor-pointer whitespace-nowrap ${
                    isStragglerSimActive
                      ? 'bg-[#B45309] text-white border-[#92400E]'
                      : 'bg-white/95 dark:bg-[#141C24]/95 text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#334155]'
                  }`}
                >
                  {isStragglerSimActive ? 'Tertinggal: Aktif' : 'Uji Tertinggal'}
                </button>

                <button
                  type="button"
                  onClick={onToggleLeaderTroubleSim}
                  className={`px-2 py-1 rounded-xl text-[10px] font-semibold border shadow-sm transition-colors cursor-pointer whitespace-nowrap ${
                    isLeaderTroubleSimActive
                      ? 'bg-[#6D28D9] text-white border-[#5B21B6]'
                      : 'bg-white/95 dark:bg-[#141C24]/95 text-[#6D28D9] dark:text-[#C4B5FD] border-[#DDD6FE] dark:border-[#5B21B6]'
                  }`}
                >
                  {isLeaderTroubleSimActive
                    ? 'Trouble Leader: Aktif'
                    : 'Uji Trouble Leader'}
                </button>

                <button
                  type="button"
                  onClick={onToggleSimulation}
                  aria-label={isSimulationRunning ? 'Jeda Simulasi' : 'Lanjut Simulasi'}
                  className="px-2 py-1 rounded-xl bg-white/95 dark:bg-[#141C24]/95 border border-[#E2E8F0] dark:border-[#334155] shadow-sm text-[10px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA] flex items-center gap-1 cursor-pointer"
                >
                  {isSimulationRunning ? (
                    <>
                      <Pause className="w-3 h-3" />
                      <span>Jeda</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Simulasi</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : gpsStatus === 'denied' ? (
          <button
            type="button"
            onClick={onRetryGps}
            className="absolute left-2.5 top-[78px] z-20 px-2.5 py-1.5 rounded-xl bg-[#FEF2F2]/95 dark:bg-[#450A0A]/95 border border-[#FCA5A5] dark:border-[#991B1B] text-[10px] font-semibold text-[#DC2626] dark:text-[#FCA5A5] shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <LocateFixed className="w-3 h-3 shrink-0" />
            <span>Izin GPS Ditolak · Ketuk</span>
          </button>
        ) : null}

        {/* Left-Edge Handle for Auto-Hiding Side Info Drawer */}
        {!showSideInfoDrawer && !isPickingDestinationOnMap && (
            <button
              type="button"
              onClick={openSideDrawer}
              aria-label="Buka Panel Info & Data Perjalanan"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 min-h-[58px] pl-2 pr-2.5 py-2 rounded-r-2xl bg-white/92 dark:bg-[#141C24]/92 backdrop-blur-md border border-l-0 border-[#CBD5E1] dark:border-[#334155] shadow-lg flex flex-col items-center justify-center gap-1 text-[#0F172A] dark:text-[#F1F5F9] hover:bg-white dark:hover:bg-[#1E293B] transition-colors cursor-pointer"
            >
              <div className="relative">
                <Info className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA]" />
                {(sosState.isActive ||
                  offRouteAlert.isOffRoute ||
                  stragglerAlert.isTriggered ||
                  activeRoom?.leaderTroubleActive) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#EA580C]" />
                )}
              </div>
              <span className="text-[9px] font-bold tracking-tight">Info</span>
              <ChevronRight className="w-3 h-3 text-[#64748B] dark:text-[#94A3B8]" />
            </button>
          )}

        {/* Collapsible Auto-Hiding Side Info Drawer (7s inactivity auto-collapse) */}
        {showSideInfoDrawer && (
          <div
            onClick={() => setShowSideInfoDrawer(false)}
            aria-hidden="true"
            className="absolute inset-0 z-30 bg-black/25 backdrop-blur-[1px]"
          />
        )}
        <aside
          aria-label="Panel Info & Data Perjalanan"
          onPointerDown={touchSideDrawer}
          onScroll={touchSideDrawer}
          className={`absolute inset-y-0 left-0 z-30 w-[294px] max-w-[85%] bg-white/98 dark:bg-[#141C24]/98 backdrop-blur-md border-r border-[#E2E8F0] dark:border-[#334155] shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
            showSideInfoDrawer
              ? 'translate-x-0'
              : '-translate-x-full pointer-events-none'
          }`}
        >
          {/* Drawer Header with Auto-Hide Countdown */}
          <div className="shrink-0 px-3.5 py-2.5 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
                <h3 className="text-xs font-bold truncate">
                  Info & Data Perjalanan
                </h3>
              </div>
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono tabular-nums mt-0.5">
                {activeRoom?.roomId || 'KNV-8492'} · Auto-hide {sideInfoSecondsLeft}d
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSideInfoDrawer(false)}
              aria-label="Tutup Panel Info"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            onScroll={touchSideDrawer}
            className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 text-xs"
          >
            {/* Clean Navigation HUD Toggle */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E2E8F0] dark:border-[#334155]">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold">
                  Layar Navigasi Bersih
                </p>
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                  Sembunyikan strip & grafik saat navigasi
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isNavInfoHidden}
                onClick={() => {
                  touchSideDrawer();
                  setIsNavInfoHidden((v) => !v);
                }}
                className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                  isNavInfoHidden
                    ? 'bg-[#1D4ED8]'
                    : 'bg-[#CBD5E1] dark:bg-[#334155]'
                }`}
              >
                <span
                  className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                    isNavInfoHidden ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Trip Telemetry & 10-Min Avg Speed Chart */}
            <div className="space-y-2 pb-2.5 border-b border-[#E2E8F0] dark:border-[#334155]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                    Tujuan & ETA
                  </p>
                  <p className="text-xs font-bold truncate mt-0.5">
                    {routeConfig.destinationName}
                  </p>
                  <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate">
                    {!trackedMember || trackedMember.id === currentUser?.id
                      ? 'Fokus: Posisi Anda'
                      : `Fokus: ${trackedMember.fullName}`}
                    {currentUser &&
                      trackedMember &&
                      trackedMember.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => {
                            touchSideDrawer();
                            onSelectMember(currentUser.id);
                          }}
                          className="ml-1 font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                        >
                          · Kembali
                        </button>
                      )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold font-mono tabular-nums text-[#1D4ED8] dark:text-[#60A5FA]">
                    ETA {etaInfo.arrivalClockLabel}
                  </p>
                  <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                    {etaInfo.durationLabel}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1.5 text-center rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155]">
                <div>
                  <p className="text-[9px] text-[#64748B] dark:text-[#94A3B8]">
                    Sisa Jarak
                  </p>
                  <p className="text-[11px] font-bold font-mono tabular-nums">
                    {etaInfo.distanceLabel}
                  </p>
                </div>
                <div className="border-x border-[#E2E8F0] dark:border-[#334155]">
                  <p className="text-[9px] text-[#64748B] dark:text-[#94A3B8]">
                    Kecepatan
                  </p>
                  <p className="text-[11px] font-bold font-mono tabular-nums">
                    {etaInfo.speedKmh} km/j
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-[#64748B] dark:text-[#94A3B8]">
                    Rata² 10m
                  </p>
                  <p className="text-[11px] font-bold font-mono tabular-nums text-[#1D4ED8] dark:text-[#60A5FA]">
                    {avgTenMinSpeed} km/j
                  </p>
                </div>
              </div>

              <div className="h-[52px] w-full rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] px-2 py-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={speedHistory}
                    margin={{ top: 4, right: 2, left: 2, bottom: 1 }}
                  >
                    <defs>
                      <linearGradient id="sideDrawerSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={['dataMin - 8', 'dataMax + 8']} hide />
                    <Area
                      type="monotone"
                      dataKey="avgSpeed"
                      stroke="#1D4ED8"
                      strokeWidth={2}
                      fill="url(#sideDrawerSpeedGrad)"
                      isAnimationActive={false}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GPS, Sync & TomTom API Key Status */}
            <div className="space-y-1.5 pb-2.5 border-b border-[#E2E8F0] dark:border-[#334155] text-[11px]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                Sistem & Rute API
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Sinyal GPS</span>
                <button
                  type="button"
                  onClick={() => {
                    touchSideDrawer();
                    onRetryGps();
                  }}
                  className={`font-semibold cursor-pointer hover:underline ${
                    gpsStatus === 'active'
                      ? 'text-[#16A34A] dark:text-[#4ADE80]'
                      : gpsStatus === 'denied'
                        ? 'text-[#DC2626] dark:text-[#FCA5A5]'
                        : 'text-[#1D4ED8] dark:text-[#60A5FA]'
                  }`}
                >
                  {gpsStatus === 'active'
                    ? `Aktif ±${gpsAccuracyMeters ?? 15}m`
                    : gpsStatus === 'denied'
                      ? 'Ditolak (Segarkan)'
                      : 'Segarkan GPS'}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Sinkronisasi</span>
                <span className="font-semibold">
                  {activeRoom?.isSyncedRoom ? 'Room Sync Aktif' : 'Simulasi Lokal'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B] dark:text-[#94A3B8]">Ping TomTom</span>
                <span className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                  {canPingTomTomRouting
                    ? activeRoom?.leaderTroubleActive
                      ? 'Plt. Leader'
                      : 'HP Leader'
                    : 'Salinan Leader'}
                </span>
              </div>
              {(actingLeaderMember && activeRoom?.leaderTroubleActive) || coLeaderMember ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">
                    {actingLeaderMember && activeRoom?.leaderTroubleActive
                      ? 'Plt. Leader'
                      : 'Co-Leader'}
                  </span>
                  <span className="font-semibold truncate max-w-[150px]">
                    {actingLeaderMember && activeRoom?.leaderTroubleActive
                      ? actingLeaderMember.fullName
                      : coLeaderMember?.fullName}
                  </span>
                </div>
              ) : null}

              {sweeperMember && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Sweeper</span>
                  <span className="font-semibold text-[#B45309] dark:text-[#FBBF24] truncate max-w-[150px]">
                    {sweeperMember.fullName}
                    {sweeperMember.isAutoSweeper ? ' (Auto)' : ''}
                  </span>
                </div>
              )}

              {activeRoom && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSideInfoDrawer(false);
                    setShowShareRoomModal(true);
                  }}
                  className="w-full mt-1.5 min-h-[34px] px-2.5 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border border-[#BFDBFE] dark:border-[#1E40AF] text-[#1D4ED8] dark:text-[#93C5FD] text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Bagikan Link &amp; Kode ({activeRoom.roomId})</span>
                </button>
              )}
            </div>

            {/* Convoy Participants & Quick Self Condition */}
            <div className="space-y-2 pb-2.5 border-b border-[#E2E8F0] dark:border-[#334155]">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                  Peserta Konvoi ({members.length})
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1">
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
                      onClick={() => {
                        touchSideDrawer();
                        onUpdateOwnCondition(item.status);
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
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

              <div className="space-y-1.5">
                {members.map((member) => {
                  const selected = member.id === focusedMember?.id;
                  const roleLabel = member.isActingLeader
                    ? 'Plt. Leader'
                    : member.isCoLeader && member.isSweeper
                      ? member.isAutoSweeper
                        ? 'Co-Leader & Sweeper (Auto)'
                        : 'Co-Leader & Sweeper'
                      : member.isCoLeader
                        ? 'Co-Leader'
                        : member.isSweeper
                          ? member.isAutoSweeper
                            ? 'Sweeper (Auto · Belakang)'
                            : 'Sweeper'
                          : member.role === 'TOUR_LEADER'
                            ? 'Leader'
                            : 'Anggota';
                  return (
                    <div
                      key={member.id}
                      onClick={() => {
                        touchSideDrawer();
                        onSelectMember(member.id);
                      }}
                      className={`rounded-xl border px-2.5 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                        selected
                          ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border-[#1D4ED8]'
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
                            : 'ring-1 ring-[#1D4ED8]'
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold truncate">
                          {member.fullName}
                          {member.isCurrentUser ? ' (Anda)' : ''}
                        </p>
                        <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate">
                          {roleLabel}
                          {typeof member.distanceToLeaderMeters === 'number'
                            ? ` · ${formatDistanceLabel(member.distanceToLeaderMeters)}`
                            : ''}
                          {` · ${conditionLabel(member.conditionStatus)}`}
                        </p>
                        {isEffectiveLeader &&
                          member.role !== 'TOUR_LEADER' &&
                          !member.isActingLeader && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                touchSideDrawer();
                                onAssignSweeper(member.id);
                              }}
                              className="text-[9px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                            >
                              {member.isSweeper && !member.isAutoSweeper
                                ? 'Sweeper Aktif'
                                : member.isAutoSweeper
                                  ? 'Tetapkan Sweeper'
                                  : 'Jadikan Sweeper'}
                            </button>
                          )}
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-[#64748B] dark:text-[#94A3B8] shrink-0">
                        {member.mapPosition.speedKmh} km/j
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Offline Simulation Controls (Hidden from main map when Clean HUD is active) */}
            {!activeRoom?.isSyncedRoom && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                  Simulasi & Uji Konvoi
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      touchSideDrawer();
                      onToggleSimulation();
                    }}
                    className="py-1.5 px-2 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 border border-[#BFDBFE] dark:border-[#1E40AF] text-[10px] font-semibold text-[#1D4ED8] dark:text-[#93C5FD] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isSimulationRunning ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Jeda Sim</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>Lanjut Sim</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      touchSideDrawer();
                      onToggleOffRouteSim();
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-semibold cursor-pointer ${
                      isOffRouteSimActive
                        ? 'bg-[#DC2626] text-white border-[#991B1B]'
                        : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                    }`}
                  >
                    {isOffRouteSimActive ? 'Keluar Jalur ✓' : 'Uji Keluar Jalur'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      touchSideDrawer();
                      onToggleStragglerSim();
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-semibold cursor-pointer ${
                      isStragglerSimActive
                        ? 'bg-[#B45309] text-white border-[#92400E]'
                        : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                    }`}
                  >
                    {isStragglerSimActive ? 'Tertinggal ✓' : 'Uji Tertinggal'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      touchSideDrawer();
                      onToggleLeaderTroubleSim();
                    }}
                    className={`py-1.5 px-2 rounded-lg border text-[10px] font-semibold cursor-pointer ${
                      isLeaderTroubleSimActive
                        ? 'bg-[#6D28D9] text-white border-[#5B21B6]'
                        : 'bg-[#F8FAFC] dark:bg-[#0B1117] border-[#E2E8F0] dark:border-[#334155]'
                    }`}
                  >
                    {isLeaderTroubleSimActive ? 'Trouble ✓' : 'Uji Trouble Ldr'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Custom Destination Placement Hint */}
        {isPickingDestinationOnMap && (
          <div className="absolute bottom-24 left-3 right-3 z-30 rounded-xl bg-[#0F172A] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-lg">
            <span className="text-xs">
              Ketuk di peta untuk menetapkan Titik Tujuan baru
            </span>
            <button
              type="button"
              onClick={() => onTogglePickMode(false)}
              className="text-xs font-semibold text-[#F59E0B] cursor-pointer shrink-0"
            >
              Batal
            </button>
          </div>
        )}

        {/* Bottom-Right Floating Action Buttons: Chat above Voice PTT + SOS row */}
        <div className="absolute bottom-3.5 right-3 z-20 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setShowChatSheet(true)}
            className="min-h-[42px] px-3.5 rounded-[14px] bg-[#1D4ED8] hover:bg-[#1E40AF] text-white shadow-lg flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Chat ({messages.length})</span>
          </button>

          <div className="flex flex-col items-end gap-1.5">
            {!showChatSheet && voiceStatusMessage && (
              <div className="max-w-[230px] px-2.5 py-1.5 rounded-xl bg-[#FEF2F2] dark:bg-[#450A0A] border border-[#FECACA] dark:border-[#991B1B] text-[#B91C1C] dark:text-[#FCA5A5] text-[10px] font-medium shadow-md">
                {voiceStatusMessage}
              </div>
            )}
            <div className="flex items-center gap-2">
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
              className={`min-h-[46px] min-w-[46px] px-3 rounded-[15px] text-white shadow-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
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
              className="min-h-[46px] px-3.5 rounded-[15px] bg-[#DC2626] hover:bg-[#B91C1C] active:scale-[0.97] text-white shadow-xl flex items-center gap-1.5 text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>SOS</span>
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Docked Destination ETA & 10-Min Avg Speed Telemetry Bar (Hidden in Clean Nav HUD) */}
      {!isCleanNavHud && (
        <div
          aria-label="Estimasi Waktu Tiba (ETA)"
          className="mt-auto shrink-0 bg-white dark:bg-[#141C24] border-t border-[#E2E8F0] dark:border-[#334155] px-3.5 pt-2.5 pb-[calc(2rem+env(safe-area-inset-bottom))] space-y-2 z-20"
        >
          <div className="flex items-center justify-between gap-2">
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

          {/* Mini-Graph: Average Convoy Speed (Last 10 Minutes) via Recharts */}
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] px-2.5 py-1.5 flex items-center gap-2.5">
            <div className="shrink-0 min-w-[108px]">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                Rata² Konvoi · 10 Mnt
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-bold font-mono tabular-nums text-[#1D4ED8] dark:text-[#60A5FA]">
                  {avgTenMinSpeed} km/j
                </span>
                <span
                  className={`text-[9px] font-mono font-semibold ${
                    speedDeltaTenMin >= 0
                      ? 'text-[#16A34A] dark:text-[#4ADE80]'
                      : 'text-[#D97706] dark:text-[#FBBF24]'
                  }`}
                >
                  {speedDeltaTenMin >= 0 ? `+${speedDeltaTenMin}` : speedDeltaTenMin}
                </span>
              </div>
            </div>

            <div className="flex-1 h-[36px] min-w-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={speedHistory}
                  margin={{ top: 3, right: 2, left: 2, bottom: 1 }}
                >
                  <defs>
                    <linearGradient id="convoyAvgSpeedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['dataMin - 8', 'dataMax + 8']} hide />
                  <Tooltip
                    formatter={(value: unknown) => [`${value} km/j`, 'Rata-rata']}
                    labelFormatter={(label: unknown, payload: ReadonlyArray<{ payload?: SpeedHistoryPoint }>) =>
                      payload?.[0]?.payload?.timeLabel ?? String(label)
                    }
                    contentStyle={{
                      fontSize: '10px',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: darkMode ? '#141C24' : '#FFFFFF',
                      color: darkMode ? '#F1F5F9' : '#0F172A',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgSpeed"
                    stroke="#1D4ED8"
                    strokeWidth={2}
                    fill="url(#convoyAvgSpeedGrad)"
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 3, fill: '#EA580C', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

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
                      className="rounded-2xl bg-[#FEF2F2] dark:bg-[#450A0A]/50 border border-[#DC2626] p-3 flex items-start gap-2.5"
                    >
                      <ConvoyAvatar
                        preset={msgPreset}
                        photoUrl={msgPhoto}
                        name={msg.senderName}
                        sizeClass="w-8 h-8"
                        ringClass="ring-2 ring-[#DC2626]"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[11px] font-bold text-[#991B1B] dark:text-[#FCA5A5]">
                          DARURAT SOS · {msg.senderName}
                          {msg.senderVehicle ? ` (${msg.senderVehicle})` : ''} ·{' '}
                          {msg.timestampLabel}
                        </p>
                        <p className="text-xs text-[#7F1D1D] dark:text-[#FECACA]">
                          {msg.textContent}
                        </p>
                        {sosState.isActive && (
                          <button
                            type="button"
                            onClick={onResolveSos}
                            className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[10px] font-semibold cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Tandai SOS Selesai</span>
                          </button>
                        )}
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
              {voiceStatusMessage && (
                <div className="rounded-xl bg-[#FEF2F2] dark:bg-[#450A0A]/80 border border-[#FECACA] dark:border-[#991B1B] px-3 py-2 text-[11px] font-medium text-[#B91C1C] dark:text-[#FCA5A5] flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{voiceStatusMessage}</span>
                </div>
              )}
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

      {/* Share Room Link & Code Modal */}
      {showShareRoomModal && activeRoom && (
        <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-5">
          <div className="w-full max-w-[336px] rounded-[24px] bg-white dark:bg-[#141C24] border border-[#E2E8F0] dark:border-[#334155] p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#1E3A8A]/50 text-[#1D4ED8] dark:text-[#93C5FD] flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate">
                    Bagikan Room Konvoi
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                    {activeRoom.roomTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowShareRoomModal(false)}
                aria-label="Tutup Bagikan Room"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                  Kode Room
                </p>
                <p className="text-xl font-extrabold font-mono tracking-widest text-[#1D4ED8] dark:text-[#60A5FA]">
                  {activeRoom.roomId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopyShare(activeRoom.roomId, 'id')}
                className="px-3 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {shareCopiedType === 'id' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{shareCopiedType === 'id' ? 'Disalin' : 'Salin'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    Link Browser (Web)
                  </p>
                  <p className="text-[11px] font-mono truncate">
                    {getWebRoomShareLink(activeRoom.roomId)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyShare(
                      getWebRoomShareLink(activeRoom.roomId),
                      'web'
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {shareCopiedType === 'web' ? (
                    <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  <span>{shareCopiedType === 'web' ? 'OK' : 'Salin'}</span>
                </button>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#E2E8F0] dark:border-[#334155] p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    Deep Link Android APK
                  </p>
                  <p className="text-[11px] font-mono truncate">
                    {activeRoom.inviteLink}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyShare(activeRoom.inviteLink, 'link')
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {shareCopiedType === 'link' ? (
                    <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{shareCopiedType === 'link' ? 'OK' : 'Salin'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNativeShareRoom}
              className="w-full min-h-[44px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Bagikan Undangan Konvoi</span>
            </button>
          </div>
        </div>
      )}

      {/* Leader Route, Checkpoints & Slider Settings Sheet */}
      {showLeaderSettings && isEffectiveLeader && (
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

            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                Titik Tujuan Akhir &amp; Garis Rute Resmi
              </p>

              {/* Inline TomTom Search Area */}
              <div className="space-y-1.5">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={destSearchQuery}
                    onChange={(e) => setDestSearchQuery(e.target.value)}
                    placeholder="Cari kota, tempat wisata, SPBU, atau alamat..."
                    className="w-full min-h-[40px] pl-8 pr-8 rounded-xl bg-[#F8FAFC] dark:bg-[#0B1117] border border-[#CBD5E1] dark:border-[#334155] text-xs outline-none focus:border-[#1D4ED8]"
                  />
                  {isSearchingDest ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#1D4ED8] animate-spin absolute right-3" />
                  ) : destSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDestSearchQuery('');
                        setDestSearchResults([]);
                      }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0] dark:hover:bg-[#1E293B] absolute right-2 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>

                {destSearchResults.length > 0 && (
                  <div className="rounded-xl border border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0B1117] divide-y divide-[#E2E8F0] dark:divide-[#334155] max-h-[168px] overflow-y-auto">
                    {destSearchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onPickDestinationLatLng(
                            item.lat,
                            item.lng,
                            item.name,
                            item.address
                          );
                          setDestSearchQuery('');
                          setDestSearchResults([]);
                          setShowLeaderSettings(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[#EFF6FF] dark:hover:bg-[#1E3A8A]/40 transition-colors cursor-pointer"
                      >
                        <p className="text-xs font-semibold truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate">
                          {item.address}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

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

      {/* 10-Second Full-Screen Flashing Red Overlay & Large SOS Notification Directly on Navigation Screen */}
      {showSosFlashOverlay && sosState.isActive && (
        <div
          role="alertdialog"
          aria-live="assertive"
          aria-label="Notifikasi Darurat SOS"
          className="absolute inset-0 z-40 pointer-events-none"
        >
          {/* Flashing Red Screen Tint + Thick Perimeter Glow */}
          <div className="absolute inset-0 bg-[#DC2626]/70 ring-[8px] ring-inset ring-[#EF4444] shadow-[inset_0_0_96px_rgba(185,28,28,0.95)] animate-sos-screen-flash" />

          {/* Large Prominent Red SOS Card */}
          <div className="relative z-10 h-full w-full flex items-center justify-center p-4">
            <div className="pointer-events-auto w-full max-w-[380px] rounded-[24px] bg-gradient-to-b from-[#DC2626] to-[#991B1B] text-white border-2 border-[#FCA5A5] shadow-2xl p-4 sm:p-5 space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-7 h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold tracking-tight leading-tight">
                      SINYAL DARURAT SOS
                    </h3>
                    <p className="text-xs text-[#FEE2E2] font-mono tabular-nums mt-0.5">
                      Hilang otomatis dalam {sosFlashSecondsLeft} dtk
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedSosKey(currentSosKey)}
                  aria-label="Tutup Notifikasi SOS"
                  className="min-w-[40px] min-h-[40px] rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="rounded-2xl bg-black/25 border border-white/20 px-3.5 py-3 space-y-1">
                <p className="text-[10px] font-bold tracking-wider uppercase text-[#FECACA]">
                  Pengirim Sinyal SOS
                </p>
                <p className="text-base sm:text-lg font-extrabold text-white leading-snug break-words">
                  {sosState.senderName || 'Anggota Konvoi'}
                </p>
                <p className="text-xs text-[#FEE2E2]">
                  {sosState.senderVehicle || 'Kendaraan Konvoi'} · Pukul{' '}
                  {sosState.triggeredAtLabel || '-'}
                </p>
                <p className="text-xs font-mono text-white/95 pt-1 break-words">
                  {sosState.locationText || 'Lokasi Live'} (
                  {sosState.latitude.toFixed(4)}, {sosState.longitude.toFixed(4)})
                </p>
              </div>

              <p className="text-[11px] text-[#FEE2E2] text-center">
                Identitas pengirim SOS tetap tercatat di kolom chat konvoi.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (sosState.senderId) {
                      onSelectMember(sosState.senderId);
                    }
                    setDismissedSosKey(currentSosKey);
                  }}
                  className="min-h-[44px] px-3 rounded-xl bg-white text-[#991B1B] hover:bg-[#FEF2F2] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LocateFixed className="w-4 h-4 shrink-0" />
                  <span>Lokasi Pengirim</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDismissedSosKey(currentSosKey);
                    onResolveSos();
                  }}
                  className="min-h-[44px] px-3 rounded-xl bg-[#7F1D1D] hover:bg-[#450A0A] border border-white/30 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Selesai SOS</span>
                </button>
              </div>

              <div className="h-1.5 w-full rounded-full bg-white/25 overflow-hidden">
                <div
                  className="h-full w-full bg-white origin-left transition-transform duration-1000 ease-linear"
                  style={{
                    transform: `scaleX(${Math.max(0, Math.min(1, sosFlashSecondsLeft / 10))})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
