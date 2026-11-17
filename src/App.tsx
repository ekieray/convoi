import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Moon, RotateCcw, Sun } from 'lucide-react';
import { KotlinSourceExplorer } from './components/KotlinSourceExplorer';
import { AboutAppView } from './components/screens/AboutAppView';
import { JoinTourView } from './components/screens/JoinTourView';
import { LiveTrackingMapView } from './components/screens/LiveTrackingMapView';
import { RoleSelectionView } from './components/screens/RoleSelectionView';
import { TourLeaderView } from './components/screens/TourLeaderView';
import { TripDetailView } from './components/screens/TripDetailView';
import { TripHistoryView } from './components/screens/TripHistoryView';
import { VehicleProfileView } from './components/screens/VehicleProfileView';
import {
  ConnectionStatus,
  ConvoyMember,
  ConvoyRouteConfig,
  DestinationPreset,
  MapPosition,
  MemberConditionStatus,
  OffRouteAlertState,
  RestCheckpoint,
  RoomMessage,
  RoutePoint,
  ScreenRoute,
  SosEmergencyState,
  StragglerAlertState,
  TourRoom,
  TripHistoryRecord,
  UserRole,
  VehicleProfile,
  VehicleType,
} from './types/convoy';

const INITIAL_PROFILE: VehicleProfile = {
  fullName: '',
  vehicleType: 'MOBIL',
  vehicleDetail: '',
  licensePlate: '',
  emergencyContact: '',
  avatarPreset: 'HELMET_TOURING',
};

const DESTINATION_PRESETS: DestinationPreset[] = [
  {
    name: 'Puncak Pass Resort',
    endPoint: { xFraction: 0.86, yFraction: 0.14, latitude: -6.645, longitude: 106.99 },
    totalMeters: 12000,
  },
  {
    name: 'Lembang Highland',
    endPoint: { xFraction: 0.78, yFraction: 0.22, latitude: -6.812, longitude: 107.618 },
    totalMeters: 15000,
  },
  {
    name: 'Ciwidey Kawah Putih',
    endPoint: { xFraction: 0.24, yFraction: 0.18, latitude: -7.166, longitude: 107.402 },
    totalMeters: 18000,
  },
  {
    name: 'Rest Area KM 57',
    endPoint: { xFraction: 0.88, yFraction: 0.44, latitude: -6.369, longitude: 107.359 },
    totalMeters: 9500,
  },
];

const INITIAL_ROUTE_CONFIG: ConvoyRouteConfig = {
  destinationName: 'Puncak Pass Resort',
  destinationAddress: 'Jl. Raya Puncak KM 90, Cisarua · -6.6450, 106.9900',
  waypoints: [
    { xFraction: 0.14, yFraction: 0.86, latitude: -6.71, longitude: 106.85 },
    { xFraction: 0.32, yFraction: 0.65, latitude: -6.692, longitude: 106.885 },
    { xFraction: 0.55, yFraction: 0.48, latitude: -6.674, longitude: 106.925 },
    { xFraction: 0.72, yFraction: 0.3, latitude: -6.658, longitude: 106.96 },
    { xFraction: 0.86, yFraction: 0.14, latitude: -6.645, longitude: 106.99 },
  ],
  checkpoints: [
    {
      id: 'cp-default-1',
      name: 'Rest Area KM 57',
      xFraction: 0.44,
      yFraction: 0.56,
      latitude: -6.683,
      longitude: 106.905,
    },
  ],
  totalRouteMeters: 12000,
  offRouteToleranceMeters: 50,
  maxStragglerDistanceMeters: 1000,
  soundAlertEnabled: true,
};

interface SimTemplate {
  fullName: string;
  vehicleType: VehicleType;
  vehicleDetail: string;
  licensePlate: string;
  emergencyContact: string;
  connectionStatus: ConnectionStatus;
  conditionStatus: MemberConditionStatus;
  lastLocationText: string;
  baseProgress: number;
  baseSpeed: number;
  avatarPreset: VehicleProfile['avatarPreset'];
}

const DEFAULT_CONVOY_TEMPLATES: SimTemplate[] = [
  {
    fullName: 'Budi',
    vehicleType: 'MOBIL',
    vehicleDetail: 'Avanza Hitam',
    licensePlate: 'B 1402 KNV',
    emergencyContact: '0812-3301-7712',
    connectionStatus: 'CONNECTED',
    conditionStatus: 'AMAN',
    lastLocationText: 'Simpang Gadog KM 45',
    baseProgress: 0.68,
    baseSpeed: 58,
    avatarPreset: 'RIDER_CAPTAIN',
  },
  {
    fullName: 'Siti',
    vehicleType: 'MOTOR',
    vehicleDetail: 'Nmax Putih',
    licensePlate: 'D 4821 XZT',
    emergencyContact: '0813-9012-4411',
    connectionStatus: 'CONNECTED',
    conditionStatus: 'AMAN',
    lastLocationText: 'Jalur Puncak KM 47',
    baseProgress: 0.6,
    baseSpeed: 54,
    avatarPreset: 'HELMET_TOURING',
  },
  {
    fullName: 'Raka',
    vehicleType: 'MOTOR',
    vehicleDetail: 'Vario 160 Merah',
    licensePlate: 'B 6190 TRG',
    emergencyContact: '0857-2201-8834',
    connectionStatus: 'WEAK_SIGNAL',
    conditionStatus: 'ISTIRAHAT',
    lastLocationText: 'Rest Area Ciawi KM 42',
    baseProgress: 0.54,
    baseSpeed: 48,
    avatarPreset: 'HELMET_SPORT',
  },
  {
    fullName: 'Nadia',
    vehicleType: 'MOBIL',
    vehicleDetail: 'HR-V Abu-abu',
    licensePlate: 'B 2048 KNV',
    emergencyContact: '0811-3349-7720',
    connectionStatus: 'CONNECTED',
    conditionStatus: 'AMAN',
    lastLocationText: 'Tol Jagorawi KM 39',
    baseProgress: 0.46,
    baseSpeed: 62,
    avatarPreset: 'PILOT_CLASSIC',
  },
];

function currentClock(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function createInitialMessages(roomCode: string): RoomMessage[] {
  return [
    {
      id: 'init-sys',
      senderId: 'system',
      senderName: 'Sistem Konvoi',
      senderVehicle: '',
      type: 'SYSTEM',
      textContent: `Room ${roomCode} aktif. Jaga jarak aman dan pantau posisi Sweeper.`,
      timestampLabel: '09:35',
    },
    {
      id: 'init-1',
      senderId: 'leader',
      senderName: 'Budi',
      senderVehicle: 'Avanza Hitam',
      type: 'TEXT',
      textContent: 'Rombongan siap, jalur resmi menuju Puncak Pass sudah ditetapkan.',
      timestampLabel: '09:37',
      senderAvatarPreset: 'RIDER_CAPTAIN',
    },
    {
      id: 'init-voice',
      senderId: 'sweeper',
      senderName: 'Siti',
      senderVehicle: 'Nmax Putih',
      type: 'VOICE',
      textContent: 'Pesan Suara Walkie-Talkie',
      timestampLabel: '09:39',
      voiceDurationSec: 4,
      senderAvatarPreset: 'HELMET_TOURING',
    },
  ];
}

function buildPolylineToDestination(end: RoutePoint): RoutePoint[] {
  const start: RoutePoint = {
    xFraction: 0.14,
    yFraction: 0.86,
    latitude: -6.71,
    longitude: 106.85,
  };
  const mid1: RoutePoint = {
    xFraction: start.xFraction + (end.xFraction - start.xFraction) * 0.3 + 0.04,
    yFraction: start.yFraction + (end.yFraction - start.yFraction) * 0.28,
    latitude: start.latitude + (end.latitude - start.latitude) * 0.3,
    longitude: start.longitude + (end.longitude - start.longitude) * 0.3,
  };
  const mid2: RoutePoint = {
    xFraction: start.xFraction + (end.xFraction - start.xFraction) * 0.65 - 0.03,
    yFraction: start.yFraction + (end.yFraction - start.yFraction) * 0.62,
    latitude: start.latitude + (end.latitude - start.latitude) * 0.65,
    longitude: start.longitude + (end.longitude - start.longitude) * 0.65,
  };
  return [start, mid1, mid2, end];
}

function interpolateAlongPolyline(
  progress: number,
  waypoints: RoutePoint[],
  lateralOffset: number,
  speedKmh: number
): MapPosition {
  const p = Math.max(0.05, Math.min(0.95, progress));
  if (waypoints.length < 2) {
    return {
      routeProgress: p,
      xFraction: 0.5,
      yFraction: 0.5,
      latitude: -6.67,
      longitude: 106.92,
      speedKmh,
    };
  }
  const segCount = waypoints.length - 1;
  const scaled = p * segCount;
  const idx = Math.max(0, Math.min(segCount - 1, Math.floor(scaled)));
  const localT = scaled - idx;
  const a = waypoints[idx];
  const b = waypoints[idx + 1];

  const dx = b.xFraction - a.xFraction;
  const dy = b.yFraction - a.yFraction;
  const len = Math.max(0.001, Math.hypot(dx, dy));
  const perpX = -dy / len;
  const perpY = dx / len;

  return {
    routeProgress: p,
    xFraction: Math.max(0.06, Math.min(0.94, a.xFraction + dx * localT + perpX * lateralOffset)),
    yFraction: Math.max(0.06, Math.min(0.94, a.yFraction + dy * localT + perpY * lateralOffset)),
    latitude: a.latitude + (b.latitude - a.latitude) * localT,
    longitude: a.longitude + (b.longitude - a.longitude) * localT,
    speedKmh,
  };
}

function computeOffRouteMeters(
  x: number,
  y: number,
  waypoints: RoutePoint[],
  totalRouteMeters: number
): number {
  if (waypoints.length < 2) return 0;
  let minDist = Number.MAX_VALUE;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const abx = b.xFraction - a.xFraction;
    const aby = b.yFraction - a.yFraction;
    const abLenSq = abx * abx + aby * aby;
    const t =
      abLenSq > 0
        ? Math.max(0, Math.min(1, ((x - a.xFraction) * abx + (y - a.yFraction) * aby) / abLenSq))
        : 0;
    const projX = a.xFraction + t * abx;
    const projY = a.yFraction + t * aby;
    const dist = Math.hypot(x - projX, y - projY);
    if (dist < minDist) minDist = dist;
  }
  return Math.round(minDist * (totalRouteMeters * 0.066));
}

function evaluateRoomSafety(
  rawMembers: ConvoyMember[],
  routeConfig: ConvoyRouteConfig
): {
  members: ConvoyMember[];
  offRouteAlert: OffRouteAlertState;
  stragglerAlert: StragglerAlertState;
} {
  const enriched = rawMembers.map((member) => {
    const routeDistanceMeters = Math.round(
      member.mapPosition.routeProgress * routeConfig.totalRouteMeters
    );
    const offRouteMeters = computeOffRouteMeters(
      member.mapPosition.xFraction,
      member.mapPosition.yFraction,
      routeConfig.waypoints,
      routeConfig.totalRouteMeters
    );
    return { ...member, routeDistanceMeters, offRouteMeters };
  });

  const sorted = [...enriched].sort(
    (a, b) => b.routeDistanceMeters - a.routeDistanceMeters
  );
  const rankMap = new Map(sorted.map((m, idx) => [m.id, idx + 1]));
  const rankedMembers = enriched.map((m) => ({
    ...m,
    convoyOrderRank: rankMap.get(m.id) ?? 1,
  }));

  const self = rankedMembers.find((m) => m.isCurrentUser);
  const selfDeviation = self?.offRouteMeters ?? 0;
  const offRouteAlert: OffRouteAlertState = {
    isOffRoute: selfDeviation > routeConfig.offRouteToleranceMeters,
    deviationMeters: selfDeviation,
    toleranceMeters: routeConfig.offRouteToleranceMeters,
  };

  let stragglerAlert: StragglerAlertState = {
    isTriggered: false,
    trailingMember: null,
    aheadMember: null,
    gapMeters: 0,
    maxAllowedMeters: routeConfig.maxStragglerDistanceMeters,
  };

  if (sorted.length >= 2) {
    const designatedSweeper = sorted.find(
      (m) => m.isSweeper && m.id !== sorted[sorted.length - 1].id
    );
    const aheadMember = designatedSweeper ?? sorted[sorted.length - 2];
    const trailingMember = sorted[sorted.length - 1];
    const gapMeters = Math.max(
      0,
      aheadMember.routeDistanceMeters - trailingMember.routeDistanceMeters
    );
    stragglerAlert = {
      isTriggered: gapMeters > routeConfig.maxStragglerDistanceMeters,
      trailingMember,
      aheadMember,
      gapMeters,
      maxAllowedMeters: routeConfig.maxStragglerDistanceMeters,
    };
  }

  return { members: rankedMembers, offRouteAlert, stragglerAlert };
}

function landmarkForProgress(progress: number): string {
  if (progress < 0.3) return 'Tol Jagorawi KM 39';
  if (progress < 0.5) return 'Rest Area Ciawi KM 42';
  if (progress < 0.7) return 'Simpang Gadog KM 45';
  return 'Jalur Puncak KM 49';
}

function generateUniqueRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `KNV-${suffix}`;
}

function extractRoomId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withoutQuery = trimmed.split('?')[0];
  const segments = withoutQuery.split('/');
  return (segments[segments.length - 1] || trimmed).trim().toUpperCase();
}

const DEFAULT_TRIP_HISTORY: TripHistoryRecord[] = [
  {
    id: 'trip-seed-1',
    roomId: 'KNV-7391',
    tourTitle: 'Touring Puncak Sunrise',
    dateLabel: '08 Nov 2026',
    timeRangeLabel: '05:30 - 08:15',
    durationLabel: '2j 45m',
    durationMinutes: 165,
    distanceKm: 68.4,
    avgSpeedKmh: 54,
    maxSpeedKmh: 82,
    userRole: 'TOUR_LEADER',
    destinationName: 'Puncak Pass Resort',
    destinationAddress: 'Jl. Raya Puncak KM 90, Cisarua · -6.6450, 106.9900',
    waypoints: [
      { xFraction: 0.14, yFraction: 0.86, latitude: -6.71, longitude: 106.85 },
      { xFraction: 0.32, yFraction: 0.65, latitude: -6.692, longitude: 106.885 },
      { xFraction: 0.55, yFraction: 0.48, latitude: -6.674, longitude: 106.925 },
      { xFraction: 0.72, yFraction: 0.3, latitude: -6.658, longitude: 106.96 },
      { xFraction: 0.86, yFraction: 0.14, latitude: -6.645, longitude: 106.99 },
    ],
    visitedCheckpoints: [
      {
        id: 'cp-s1',
        name: 'Rest Area KM 57',
        arrivedAtLabel: '06:20',
        xFraction: 0.36,
        yFraction: 0.62,
        latitude: -6.69,
        longitude: 106.89,
      },
      {
        id: 'cp-s2',
        name: 'Warung Kopi Cisarua',
        arrivedAtLabel: '07:15',
        xFraction: 0.66,
        yFraction: 0.36,
        latitude: -6.664,
        longitude: 106.948,
      },
    ],
    participants: [
      {
        id: 'p1',
        fullName: 'Anda (Leader)',
        vehicleType: 'MOBIL',
        vehicleDetail: 'Avanza Hitam',
        licensePlate: 'B 1001 LDR',
        role: 'TOUR_LEADER',
        avatarPreset: 'RIDER_CAPTAIN',
      },
      {
        id: 'p2',
        fullName: 'Siti',
        vehicleType: 'MOTOR',
        vehicleDetail: 'Nmax Putih',
        licensePlate: 'D 4821 XZT',
        role: 'MEMBER',
        isSweeper: true,
        avatarPreset: 'HELMET_TOURING',
      },
      {
        id: 'p3',
        fullName: 'Raka',
        vehicleType: 'MOTOR',
        vehicleDetail: 'Vario 160 Merah',
        licensePlate: 'B 6190 TRG',
        role: 'MEMBER',
        avatarPreset: 'HELMET_SPORT',
      },
      {
        id: 'p4',
        fullName: 'Nadia',
        vehicleType: 'MOBIL',
        vehicleDetail: 'HR-V Abu-abu',
        licensePlate: 'B 2048 KNV',
        role: 'MEMBER',
        avatarPreset: 'PILOT_CLASSIC',
      },
    ],
  },
  {
    id: 'trip-seed-2',
    roomId: 'KNV-4120',
    tourTitle: 'Lembang Highland Weekend',
    dateLabel: '01 Nov 2026',
    timeRangeLabel: '07:00 - 10:20',
    durationLabel: '3j 20m',
    durationMinutes: 200,
    distanceKm: 94.2,
    avgSpeedKmh: 49,
    maxSpeedKmh: 78,
    userRole: 'MEMBER',
    destinationName: 'Lembang Highland',
    destinationAddress: 'Jl. Raya Lembang No. 12, Bandung · -6.8120, 107.6180',
    waypoints: [
      { xFraction: 0.16, yFraction: 0.84, latitude: -6.89, longitude: 107.48 },
      { xFraction: 0.38, yFraction: 0.68, latitude: -6.865, longitude: 107.52 },
      { xFraction: 0.52, yFraction: 0.44, latitude: -6.842, longitude: 107.565 },
      { xFraction: 0.78, yFraction: 0.22, latitude: -6.812, longitude: 107.618 },
    ],
    visitedCheckpoints: [
      {
        id: 'cp-s3',
        name: 'SPBU Padalarang KM 120',
        arrivedAtLabel: '08:05',
        xFraction: 0.38,
        yFraction: 0.68,
        latitude: -6.865,
        longitude: 107.52,
      },
      {
        id: 'cp-s4',
        name: 'Rumah Makan Sate Pak Budi',
        arrivedAtLabel: '09:10',
        xFraction: 0.52,
        yFraction: 0.44,
        latitude: -6.842,
        longitude: 107.565,
      },
    ],
    participants: [
      {
        id: 'p5',
        fullName: 'Budi',
        vehicleType: 'MOBIL',
        vehicleDetail: 'Pajero Sport',
        licensePlate: 'B 1402 KNV',
        role: 'TOUR_LEADER',
        avatarPreset: 'RALLY_PRO',
      },
      {
        id: 'p6',
        fullName: 'Anda',
        vehicleType: 'MOTOR',
        vehicleDetail: 'PCX 160 Hitam',
        licensePlate: 'B 2026 AGT',
        role: 'MEMBER',
        avatarPreset: 'HELMET_TOURING',
      },
      {
        id: 'p7',
        fullName: 'Siti',
        vehicleType: 'MOTOR',
        vehicleDetail: 'Nmax Putih',
        licensePlate: 'D 4821 XZT',
        role: 'MEMBER',
        isSweeper: true,
        avatarPreset: 'HELMET_SPORT',
      },
    ],
  },
  {
    id: 'trip-seed-3',
    roomId: 'KNV-5583',
    tourTitle: 'Eksplorasi Kawah Putih Ciwidey',
    dateLabel: '18 Okt 2026',
    timeRangeLabel: '06:15 - 10:35',
    durationLabel: '4j 20m',
    durationMinutes: 260,
    distanceKm: 118.5,
    avgSpeedKmh: 46,
    maxSpeedKmh: 74,
    userRole: 'MEMBER',
    destinationName: 'Ciwidey Kawah Putih',
    destinationAddress: 'Kawasan Wisata Kawah Putih, Ciwidey · -7.1660, 107.4020',
    waypoints: [
      { xFraction: 0.84, yFraction: 0.85, latitude: -6.94, longitude: 107.61 },
      { xFraction: 0.64, yFraction: 0.66, latitude: -7.015, longitude: 107.54 },
      { xFraction: 0.45, yFraction: 0.42, latitude: -7.095, longitude: 107.47 },
      { xFraction: 0.24, yFraction: 0.18, latitude: -7.166, longitude: 107.402 },
    ],
    visitedCheckpoints: [
      {
        id: 'cp-s5',
        name: 'Rest Area Soreang KM 14',
        arrivedAtLabel: '07:40',
        xFraction: 0.64,
        yFraction: 0.66,
        latitude: -7.015,
        longitude: 107.54,
      },
    ],
    participants: [
      {
        id: 'p8',
        fullName: 'Dimas',
        vehicleType: 'MOBIL',
        vehicleDetail: 'Innova Zenix',
        licensePlate: 'D 1180 KNV',
        role: 'TOUR_LEADER',
        avatarPreset: 'RIDER_CAPTAIN',
      },
      {
        id: 'p9',
        fullName: 'Anda',
        vehicleType: 'MOBIL',
        vehicleDetail: 'Brio RS Kuning',
        licensePlate: 'B 1945 KNV',
        role: 'MEMBER',
        avatarPreset: 'STANDARD_USER',
      },
      {
        id: 'p10',
        fullName: 'Nadia',
        vehicleType: 'MOBIL',
        vehicleDetail: 'HR-V Abu-abu',
        licensePlate: 'B 2048 KNV',
        role: 'MEMBER',
        isSweeper: true,
        avatarPreset: 'PILOT_CLASSIC',
      },
    ],
  },
];

const ROUTE_STEPS: Array<{ route: ScreenRoute; label: string }> = [
  { route: 'role_selection', label: '1. Beranda' },
  { route: 'vehicle_profile', label: '2. Profil' },
  { route: 'tour_leader', label: '3A. Setup Leader' },
  { route: 'join_tour', label: '3B. Gabung' },
  { route: 'live_map', label: '4. Peta Live' },
  { route: 'trip_history', label: '5. Riwayat' },
];

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<ScreenRoute>('role_selection');
  const [aboutReturnRoute, setAboutReturnRoute] =
    useState<ScreenRoute>('role_selection');
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole>('TOUR_LEADER');
  const [vehicleProfile, setVehicleProfile] = useState<VehicleProfile>(INITIAL_PROFILE);
  const [activeRoom, setActiveRoom] = useState<TourRoom | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const [routeConfig, setRouteConfig] = useState<ConvoyRouteConfig>(INITIAL_ROUTE_CONFIG);
  const [offRouteAlert, setOffRouteAlert] = useState<OffRouteAlertState>({
    isOffRoute: false,
    deviationMeters: 0,
    toleranceMeters: 50,
  });
  const [stragglerAlert, setStragglerAlert] = useState<StragglerAlertState>({
    isTriggered: false,
    trailingMember: null,
    aheadMember: null,
    gapMeters: 0,
    maxAllowedMeters: 1000,
  });
  const [sosState, setSosState] = useState<SosEmergencyState>({
    isActive: false,
    senderId: '',
    senderName: '',
    senderVehicle: '',
    latitude: 0,
    longitude: 0,
    locationText: '',
    triggeredAtLabel: '',
  });
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  const [isPickingDestinationOnMap, setIsPickingDestinationOnMap] = useState(false);
  const [isPickingCheckpointOnMap, setIsPickingCheckpointOnMap] = useState(false);
  const [pendingCheckpointName, setPendingCheckpointName] = useState('');
  const [isOffRouteSimActive, setIsOffRouteSimActive] = useState(false);
  const [isStragglerSimActive, setIsStragglerSimActive] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [tripHistory, setTripHistory] = useState<TripHistoryRecord[]>(DEFAULT_TRIP_HISTORY);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(
    DEFAULT_TRIP_HISTORY[0]?.id ?? null
  );
  const [syncWithPreview, setSyncWithPreview] = useState(true);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'preview' | 'code'>('preview');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!isRecordingVoice) return;
    const timer = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecordingVoice]);

  const commitRoomMembers = (
    rawMembers: ConvoyMember[],
    config: ConvoyRouteConfig = routeConfig,
    roomOverride?: TourRoom
  ) => {
    const { members, offRouteAlert: nextOffRoute, stragglerAlert: nextStraggler } =
      evaluateRoomSafety(rawMembers, config);
    setOffRouteAlert(nextOffRoute);
    setStragglerAlert(nextStraggler);
    setActiveRoom((prev) => {
      const base = roomOverride ?? prev;
      return base ? { ...base, members } : base;
    });
  };

  useEffect(() => {
    if (!isSimulationRunning || !activeRoom) return;
    const interval = setInterval(() => {
      setActiveRoom((prev) => {
        if (!prev) return prev;
        const ordered = [...prev.members].sort(
          (a, b) => b.mapPosition.routeProgress - a.mapPosition.routeProgress
        );
        const tailId = ordered[ordered.length - 1]?.id;

        const moved = prev.members.map((member, idx) => {
          const isStopped =
            member.conditionStatus === 'MOGOK' || member.conditionStatus === 'SOS';
          const isTail = member.id === tailId && isStragglerSimActive;
          const step = isStopped ? 0 : isTail ? 0.002 : 0.01 + (idx % 2) * 0.002;
          const rawNext = member.mapPosition.routeProgress + step;
          const nextProgress = rawNext > 0.9 ? 0.16 : rawNext;
          const offShift =
            member.isCurrentUser && isOffRouteSimActive ? 0.12 : 0;
          const speed = isStopped ? 0 : isTail ? 28 : 48 + Math.floor(Math.random() * 18);

          return {
            ...member,
            mapPosition: interpolateAlongPolyline(
              nextProgress,
              routeConfig.waypoints,
              offShift,
              speed
            ),
            lastLocationText: landmarkForProgress(nextProgress),
            lastUpdatedLabel:
              member.connectionStatus === 'WEAK_SIGNAL'
                ? '5 dtk lalu'
                : 'Baru saja',
          };
        });

        const evaluated = evaluateRoomSafety(moved, routeConfig);
        setOffRouteAlert(evaluated.offRouteAlert);
        setStragglerAlert(evaluated.stragglerAlert);
        return { ...prev, members: evaluated.members };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [
    isSimulationRunning,
    activeRoom?.roomId,
    routeConfig,
    isOffRouteSimActive,
    isStragglerSimActive,
  ]);

  const navigateTo = (next: ScreenRoute, direction: 1 | -1 = 1) => {
    setNavDirection(direction);
    setCurrentRoute(next);
  };

  const ensureDemoRoom = (roleForFallback: UserRole) => {
    if (activeRoom) return;
    const roomId = 'KNV-8492';
    const selfMember: ConvoyMember = {
      id: 'self-demo',
      fullName: vehicleProfile.fullName.trim() || 'Anda',
      vehicleType: vehicleProfile.vehicleType,
      vehicleDetail:
        vehicleProfile.vehicleDetail.trim() ||
        (vehicleProfile.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor'),
      licensePlate: vehicleProfile.licensePlate.trim() || 'B 1945 KNV',
      emergencyContact: vehicleProfile.emergencyContact.trim() || '0812-3456-7890',
      role: roleForFallback,
      joinedAtLabel: 'Baru saja',
      isCurrentUser: true,
      isSweeper: false,
      avatarPreset: vehicleProfile.avatarPreset,
      avatarPhotoUrl: vehicleProfile.avatarPhotoUrl,
      conditionStatus: 'AMAN',
      connectionStatus: 'CONNECTED',
      lastLocationText: 'Jalur Puncak KM 45',
      lastUpdatedLabel: 'Baru saja',
      routeDistanceMeters: 7000,
      offRouteMeters: 0,
      convoyOrderRank: 2,
      mapPosition: interpolateAlongPolyline(0.58, routeConfig.waypoints, 0, 55),
    };
    const simulatedPeers: ConvoyMember[] = DEFAULT_CONVOY_TEMPLATES.slice(0, 3).map(
      (tpl, idx) => ({
        id: `peer-demo-${idx}`,
        fullName: tpl.fullName,
        vehicleType: tpl.vehicleType,
        vehicleDetail: tpl.vehicleDetail,
        licensePlate: tpl.licensePlate,
        emergencyContact: tpl.emergencyContact,
        role: idx === 0 && roleForFallback === 'MEMBER' ? 'TOUR_LEADER' : 'MEMBER',
        joinedAtLabel: 'Aktif di room',
        isCurrentUser: false,
        isSweeper: idx === 1,
        avatarPreset: tpl.avatarPreset,
        conditionStatus: tpl.conditionStatus,
        connectionStatus: tpl.connectionStatus,
        lastLocationText: tpl.lastLocationText,
        lastUpdatedLabel: tpl.connectionStatus === 'WEAK_SIGNAL' ? '4 dtk lalu' : 'Baru saja',
        routeDistanceMeters: Math.round(tpl.baseProgress * routeConfig.totalRouteMeters),
        offRouteMeters: 0,
        convoyOrderRank: idx + 1,
        mapPosition: interpolateAlongPolyline(
          tpl.baseProgress,
          routeConfig.waypoints,
          0,
          tpl.baseSpeed
        ),
      })
    );

    const baseRoom: TourRoom = {
      roomId,
      roomTitle: 'Konvoi Touring Akhir Pekan',
      inviteLink: `https://konvoiku.id/join/${roomId}`,
      createdAtLabel: 'Aktif sekarang',
      members: [selfMember, ...simulatedPeers],
    };
    setSelectedMemberId(selfMember.id);
    setMessages(createInitialMessages(roomId));
    commitRoomMembers(baseRoom.members, routeConfig, baseRoom);
  };

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    navigateTo('vehicle_profile', 1);
  };

  const handleUpdateProfile = (patch: Partial<VehicleProfile>) => {
    setVehicleProfile((prev) => ({ ...prev, ...patch }));
  };

  const handleCreateRoom = (customTitle = 'Konvoi Touring Akhir Pekan') => {
    const roomId = generateUniqueRoomId();
    const leader: ConvoyMember = {
      id: `leader-${Date.now()}`,
      fullName: vehicleProfile.fullName.trim() || 'Anda (Leader)',
      vehicleType: vehicleProfile.vehicleType,
      vehicleDetail:
        vehicleProfile.vehicleDetail.trim() ||
        (vehicleProfile.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor'),
      licensePlate: vehicleProfile.licensePlate.trim() || 'B 1001 LDR',
      emergencyContact: vehicleProfile.emergencyContact.trim() || '0812-0000-0001',
      role: 'TOUR_LEADER',
      joinedAtLabel: 'Baru saja',
      isCurrentUser: true,
      isSweeper: false,
      avatarPreset: vehicleProfile.avatarPreset,
      avatarPhotoUrl: vehicleProfile.avatarPhotoUrl,
      conditionStatus: 'AMAN',
      connectionStatus: 'CONNECTED',
      lastLocationText: 'Puncak Pass KM 49',
      lastUpdatedLabel: 'Baru saja',
      routeDistanceMeters: 8880,
      offRouteMeters: 0,
      convoyOrderRank: 1,
      mapPosition: interpolateAlongPolyline(0.74, routeConfig.waypoints, 0, 60),
    };

    const peers: ConvoyMember[] = DEFAULT_CONVOY_TEMPLATES.slice(0, 3).map(
      (tpl, idx) => ({
        id: `sim-${idx}-${Date.now()}`,
        fullName: tpl.fullName,
        vehicleType: tpl.vehicleType,
        vehicleDetail: tpl.vehicleDetail,
        licensePlate: tpl.licensePlate,
        emergencyContact: tpl.emergencyContact,
        role: 'MEMBER',
        joinedAtLabel: 'Aktif di room',
        isCurrentUser: false,
        isSweeper: idx === 1,
        avatarPreset: tpl.avatarPreset,
        conditionStatus: tpl.conditionStatus,
        connectionStatus: tpl.connectionStatus,
        lastLocationText: tpl.lastLocationText,
        lastUpdatedLabel: tpl.connectionStatus === 'WEAK_SIGNAL' ? '4 dtk lalu' : 'Baru saja',
        routeDistanceMeters: Math.round(tpl.baseProgress * routeConfig.totalRouteMeters),
        offRouteMeters: 0,
        convoyOrderRank: idx + 2,
        mapPosition: interpolateAlongPolyline(
          tpl.baseProgress,
          routeConfig.waypoints,
          0,
          tpl.baseSpeed
        ),
      })
    );

    setSimIndex(0);
    setIsOffRouteSimActive(false);
    setIsStragglerSimActive(false);
    setSosState({
      isActive: false,
      senderId: '',
      senderName: '',
      senderVehicle: '',
      latitude: 0,
      longitude: 0,
      locationText: '',
      triggeredAtLabel: '',
    });
    setMessages(createInitialMessages(roomId));
    const room: TourRoom = {
      roomId,
      roomTitle: customTitle.trim() || 'Konvoi Touring Akhir Pekan',
      inviteLink: `https://konvoiku.id/join/${roomId}`,
      createdAtLabel: 'Aktif sekarang',
      members: [leader, ...peers],
    };
    setSelectedMemberId(leader.id);
    commitRoomMembers(room.members, routeConfig, room);
    navigateTo('live_map', 1);
  };

  const handleSimulateJoin = () => {
    if (!activeRoom) return;
    const tpl = DEFAULT_CONVOY_TEMPLATES[simIndex % DEFAULT_CONVOY_TEMPLATES.length];
    setSimIndex((prev) => prev + 1);
    const newMember: ConvoyMember = {
      id: `member-${Date.now()}-${simIndex}`,
      fullName: `${tpl.fullName} #${simIndex + 2}`,
      vehicleType: tpl.vehicleType,
      vehicleDetail: tpl.vehicleDetail,
      licensePlate: tpl.licensePlate,
      emergencyContact: tpl.emergencyContact,
      role: 'MEMBER',
      joinedAtLabel: 'Baru bergabung',
      isCurrentUser: false,
      isSweeper: false,
      avatarPreset: tpl.avatarPreset,
      conditionStatus: 'AMAN',
      connectionStatus: 'CONNECTED',
      lastLocationText: tpl.lastLocationText,
      lastUpdatedLabel: 'Baru saja',
      routeDistanceMeters: Math.round(0.5 * routeConfig.totalRouteMeters),
      offRouteMeters: 0,
      convoyOrderRank: activeRoom.members.length + 1,
      mapPosition: interpolateAlongPolyline(0.5, routeConfig.waypoints, 0, tpl.baseSpeed),
    };
    commitRoomMembers([...activeRoom.members, newMember]);
  };

  const handleRemoveMember = (memberId: string) => {
    if (!activeRoom) return;
    commitRoomMembers(
      activeRoom.members.filter((m) => m.id !== memberId || m.isCurrentUser)
    );
  };

  const handleJoinSubmit = () => {
    const code = extractRoomId(joinInput);
    if (code.length < 4) {
      setJoinError(
        'Masukkan Room ID yang valid (contoh: KNV-8492) atau tempel link undangan.'
      );
      return;
    }

    const hostTpl = DEFAULT_CONVOY_TEMPLATES[0];
    const peer1Tpl = DEFAULT_CONVOY_TEMPLATES[1];
    const peer2Tpl = DEFAULT_CONVOY_TEMPLATES[2];

    const hostLeader: ConvoyMember = {
      id: 'leader-host',
      fullName: hostTpl.fullName,
      vehicleType: hostTpl.vehicleType,
      vehicleDetail: hostTpl.vehicleDetail,
      licensePlate: hostTpl.licensePlate,
      emergencyContact: hostTpl.emergencyContact,
      role: 'TOUR_LEADER',
      joinedAtLabel: 'Host Room',
      isCurrentUser: false,
      isSweeper: false,
      avatarPreset: hostTpl.avatarPreset,
      conditionStatus: 'AMAN',
      connectionStatus: 'CONNECTED',
      lastLocationText: 'Puncak Pass KM 49',
      lastUpdatedLabel: 'Baru saja',
      routeDistanceMeters: 8880,
      offRouteMeters: 0,
      convoyOrderRank: 1,
      mapPosition: interpolateAlongPolyline(0.74, routeConfig.waypoints, 0, 58),
    };

    const selfMember: ConvoyMember = {
      id: `self-${Date.now()}`,
      fullName: vehicleProfile.fullName.trim() || 'Anda',
      vehicleType: vehicleProfile.vehicleType,
      vehicleDetail:
        vehicleProfile.vehicleDetail.trim() ||
        (vehicleProfile.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor'),
      licensePlate: vehicleProfile.licensePlate.trim() || 'B 2026 AGT',
      emergencyContact: vehicleProfile.emergencyContact.trim() || '0812-9999-8888',
      role: 'MEMBER',
      joinedAtLabel: 'Baru bergabung',
      isCurrentUser: true,
      isSweeper: false,
      avatarPreset: vehicleProfile.avatarPreset,
      avatarPhotoUrl: vehicleProfile.avatarPhotoUrl,
      conditionStatus: 'AMAN',
      connectionStatus: 'CONNECTED',
      lastLocationText: 'Jalur Puncak KM 45',
      lastUpdatedLabel: 'Baru saja',
      routeDistanceMeters: 6960,
      offRouteMeters: 0,
      convoyOrderRank: 3,
      mapPosition: interpolateAlongPolyline(0.58, routeConfig.waypoints, 0, 54),
    };

    const peer1: ConvoyMember = {
      id: 'peer-1',
      fullName: peer1Tpl.fullName,
      vehicleType: peer1Tpl.vehicleType,
      vehicleDetail: peer1Tpl.vehicleDetail,
      licensePlate: peer1Tpl.licensePlate,
      emergencyContact: peer1Tpl.emergencyContact,
      role: 'MEMBER',
      joinedAtLabel: 'Aktif',
      isCurrentUser: false,
      isSweeper: true,
      avatarPreset: peer1Tpl.avatarPreset,
      conditionStatus: peer1Tpl.conditionStatus,
      connectionStatus: peer1Tpl.connectionStatus,
      lastLocationText: peer1Tpl.lastLocationText,
      lastUpdatedLabel: '1 dtk lalu',
      routeDistanceMeters: 7920,
      offRouteMeters: 0,
      convoyOrderRank: 2,
      mapPosition: interpolateAlongPolyline(0.66, routeConfig.waypoints, 0, 52),
    };

    const peer2: ConvoyMember = {
      id: 'peer-2',
      fullName: peer2Tpl.fullName,
      vehicleType: peer2Tpl.vehicleType,
      vehicleDetail: peer2Tpl.vehicleDetail,
      licensePlate: peer2Tpl.licensePlate,
      emergencyContact: peer2Tpl.emergencyContact,
      role: 'MEMBER',
      joinedAtLabel: 'Aktif',
      isCurrentUser: false,
      isSweeper: false,
      avatarPreset: peer2Tpl.avatarPreset,
      conditionStatus: peer2Tpl.conditionStatus,
      connectionStatus: peer2Tpl.connectionStatus,
      lastLocationText: peer2Tpl.lastLocationText,
      lastUpdatedLabel: '5 dtk lalu',
      routeDistanceMeters: 6120,
      offRouteMeters: 0,
      convoyOrderRank: 4,
      mapPosition: interpolateAlongPolyline(0.51, routeConfig.waypoints, 0, 46),
    };

    setJoinError(null);
    setIsOffRouteSimActive(false);
    setIsStragglerSimActive(false);
    setSosState({
      isActive: false,
      senderId: '',
      senderName: '',
      senderVehicle: '',
      latitude: 0,
      longitude: 0,
      locationText: '',
      triggeredAtLabel: '',
    });
    setMessages(createInitialMessages(code));
    const room: TourRoom = {
      roomId: code,
      roomTitle: `Konvoi Bersama ${code}`,
      inviteLink: `https://konvoiku.id/join/${code}`,
      createdAtLabel: 'Terhubung',
      members: [hostLeader, selfMember, peer1, peer2],
    };
    setSelectedMemberId(selfMember.id);
    commitRoomMembers(room.members, routeConfig, room);
    navigateTo('live_map', 1);
  };

  // --- Stage 4 Handlers ---
  const handleTriggerSos = () => {
    if (!activeRoom) return;
    const self =
      activeRoom.members.find((m) => m.isCurrentUser) || activeRoom.members[0];
    if (!self) return;
    const now = currentClock();
    const updated = activeRoom.members.map((m) =>
      m.id === self.id ? { ...m, conditionStatus: 'SOS' as MemberConditionStatus } : m
    );
    setSosState({
      isActive: true,
      senderId: self.id,
      senderName: self.fullName,
      senderVehicle: self.vehicleDetail,
      latitude: self.mapPosition.latitude,
      longitude: self.mapPosition.longitude,
      locationText: self.lastLocationText,
      triggeredAtLabel: now,
    });
    setSelectedMemberId(self.id);
    setMessages((prev) => [
      ...prev,
      {
        id: `sos-${Date.now()}`,
        senderId: self.id,
        senderName: self.fullName,
        senderVehicle: self.vehicleDetail,
        type: 'SOS_ALERT',
        textContent: `SINYAL DARURAT SOS di ${self.lastLocationText} (${self.mapPosition.latitude.toFixed(4)}, ${self.mapPosition.longitude.toFixed(4)}). Butuh bantuan segera!`,
        timestampLabel: now,
        isFromCurrentUser: true,
      },
    ]);
    commitRoomMembers(updated);
  };

  const handleResolveSos = () => {
    if (!activeRoom) return;
    const senderId = sosState.senderId;
    const updated = activeRoom.members.map((m) =>
      m.id === senderId && m.conditionStatus === 'SOS'
        ? { ...m, conditionStatus: 'AMAN' as MemberConditionStatus }
        : m
    );
    setSosState({
      isActive: false,
      senderId: '',
      senderName: '',
      senderVehicle: '',
      latitude: 0,
      longitude: 0,
      locationText: '',
      triggeredAtLabel: '',
    });
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        senderId: 'system',
        senderName: 'Sistem Konvoi',
        senderVehicle: '',
        type: 'SYSTEM',
        textContent: 'Sinyal darurat SOS telah diselesaikan.',
        timestampLabel: currentClock(),
      },
    ]);
    commitRoomMembers(updated);
  };

  const handleSendTextMessage = (text: string) => {
    if (!activeRoom) return;
    const self = activeRoom.members.find((m) => m.isCurrentUser);
    setMessages((prev) => [
      ...prev,
      {
        id: `txt-${Date.now()}`,
        senderId: self?.id ?? 'self',
        senderName: self?.fullName ?? 'Anda',
        senderVehicle: self?.vehicleDetail ?? 'Kendaraan',
        type: 'TEXT',
        textContent: text.trim(),
        timestampLabel: currentClock(),
        isFromCurrentUser: true,
        senderAvatarPreset: self?.avatarPreset ?? vehicleProfile.avatarPreset,
        senderAvatarPhotoUrl: self?.avatarPhotoUrl ?? vehicleProfile.avatarPhotoUrl,
      },
    ]);
  };

  const handleStartVoiceRecord = async () => {
    if (isRecordingVoice) return;
    setRecordingSeconds(0);
    setIsRecordingVoice(true);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = blob.size > 0 ? URL.createObjectURL(blob) : undefined;
        finalizeVoiceMessage(url);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      mediaRecorderRef.current = null;
    }
  };

  const finalizeVoiceMessage = (audioUrl?: string) => {
    const self = activeRoom?.members.find((m) => m.isCurrentUser);
    const dur = Math.max(1, recordingSeconds);
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
    setMessages((prev) => [
      ...prev,
      {
        id: `voice-${Date.now()}`,
        senderId: self?.id ?? 'self',
        senderName: self?.fullName ?? 'Anda',
        senderVehicle: self?.vehicleDetail ?? 'Kendaraan',
        type: 'VOICE',
        textContent: 'Pesan Suara Walkie-Talkie',
        timestampLabel: currentClock(),
        voiceDurationSec: dur,
        voiceAudioUrl: audioUrl,
        isFromCurrentUser: true,
        senderAvatarPreset: self?.avatarPreset ?? vehicleProfile.avatarPreset,
        senderAvatarPhotoUrl: self?.avatarPhotoUrl ?? vehicleProfile.avatarPhotoUrl,
      },
    ]);
  };

  const handleStopVoiceRecord = () => {
    if (!isRecordingVoice) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      finalizeVoiceMessage(undefined);
    }
  };

  const handleToggleVoicePlay = (msg: RoomMessage) => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    if (playingMessageId === msg.id) {
      setPlayingMessageId(null);
      return;
    }

    setPlayingMessageId(msg.id);
    if (msg.voiceAudioUrl) {
      const audio = new Audio(msg.voiceAudioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingMessageId(null);
      audio.play().catch(() => setPlayingMessageId(null));
    } else {
      // Synthesize subtle radio squelch chirp & simulate playback duration
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(520, ctx.currentTime);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        }
      } catch {
        // Ignore AudioContext restriction
      }
      playbackTimeoutRef.current = setTimeout(() => {
        setPlayingMessageId(null);
      }, (msg.voiceDurationSec || 2) * 1000);
    }
  };

  const handleUpdateOwnCondition = (status: MemberConditionStatus) => {
    if (!activeRoom) return;
    const self = activeRoom.members.find((m) => m.isCurrentUser);
    if (!self) return;
    const updated = activeRoom.members.map((m) =>
      m.isCurrentUser ? { ...m, conditionStatus: status } : m
    );
    const labelMap: Record<MemberConditionStatus, string> = {
      AMAN: 'Aman',
      ISTIRAHAT: 'Istirahat / Rest Area',
      MOGOK: 'Kendaraan Mogok',
      SOS: 'Darurat SOS',
    };
    setMessages((prev) => [
      ...prev,
      {
        id: `cond-${Date.now()}`,
        senderId: self.id,
        senderName: self.fullName,
        senderVehicle: self.vehicleDetail,
        type: 'SYSTEM',
        textContent: `${self.fullName} memperbarui status: ${labelMap[status]}`,
        timestampLabel: currentClock(),
      },
    ]);
    commitRoomMembers(updated);
  };

  const handleAssignSweeper = (memberId: string) => {
    if (!activeRoom) return;
    const target = activeRoom.members.find((m) => m.id === memberId);
    if (!target) return;
    const updated = activeRoom.members.map((m) => ({
      ...m,
      isSweeper: m.id === memberId,
    }));
    setMessages((prev) => [
      ...prev,
      {
        id: `swp-${Date.now()}`,
        senderId: 'system',
        senderName: 'Tour Leader',
        senderVehicle: '',
        type: 'SYSTEM',
        textContent: `${target.fullName} (${target.vehicleDetail}) ditetapkan sebagai Sweeper penutup barisan.`,
        timestampLabel: currentClock(),
      },
    ]);
    commitRoomMembers(updated);
  };

  // --- Stage 3 Handlers ---
  const syncMembersToRoute = (nextConfig: ConvoyRouteConfig) => {
    if (!activeRoom) return;
    const synced = activeRoom.members.map((member) => ({
      ...member,
      mapPosition: interpolateAlongPolyline(
        member.mapPosition.routeProgress,
        nextConfig.waypoints,
        member.isCurrentUser && isOffRouteSimActive ? 0.12 : 0,
        member.mapPosition.speedKmh
      ),
    }));
    commitRoomMembers(synced, nextConfig);
  };

  const handleSelectPreset = (preset: DestinationPreset) => {
    const coordStr = `${preset.endPoint.latitude.toFixed(4)}, ${preset.endPoint.longitude.toFixed(4)}`;
    const nextConfig: ConvoyRouteConfig = {
      ...routeConfig,
      destinationName: preset.name,
      destinationAddress: `${preset.name} · ${coordStr}`,
      waypoints: buildPolylineToDestination(preset.endPoint),
      totalRouteMeters: preset.totalMeters,
    };
    setRouteConfig(nextConfig);
    setIsPickingDestinationOnMap(false);
    syncMembersToRoute(nextConfig);
  };

  const handlePickCustomDestination = (
    xFrac: number,
    yFrac: number,
    placeName?: string,
    addressLabel?: string
  ) => {
    const cx = Math.max(0.08, Math.min(0.92, xFrac));
    const cy = Math.max(0.08, Math.min(0.9, yFrac));
    const lat = -6.71 + (1 - cy) * 0.08;
    const lng = 106.85 + cx * 0.16;
    const endPoint: RoutePoint = {
      xFraction: cx,
      yFraction: cy,
      latitude: lat,
      longitude: lng,
    };
    const waypoints = buildPolylineToDestination(endPoint);
    const start = waypoints[0];
    const normDist = Math.hypot(cx - start.xFraction, cy - start.yFraction);
    const estimatedMeters = Math.max(
      3000,
      Math.min(32000, Math.round(normDist * 16500))
    );
    const resolvedName =
      placeName?.trim() ||
      `Titik Tujuan (${Math.round(cx * 100)}%, ${Math.round(cy * 100)}%)`;
    const resolvedAddress =
      addressLabel?.trim() || `${resolvedName} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const nextConfig: ConvoyRouteConfig = {
      ...routeConfig,
      destinationName: resolvedName,
      destinationAddress: resolvedAddress,
      waypoints,
      totalRouteMeters: estimatedMeters,
    };
    setRouteConfig(nextConfig);
    setIsPickingDestinationOnMap(false);
    syncMembersToRoute(nextConfig);
  };

  // --- Rest Area Checkpoint Handlers ---
  const handleStartPickCheckpoint = (name: string) => {
    setIsPickingDestinationOnMap(false);
    setPendingCheckpointName(name.trim());
    setIsPickingCheckpointOnMap(true);
  };

  const handleCancelPickCheckpoint = () => {
    setIsPickingCheckpointOnMap(false);
    setPendingCheckpointName('');
  };

  const handleConfirmAddCheckpoint = (
    name: string,
    xFraction: number,
    yFraction: number
  ) => {
    const cx = Math.max(0.08, Math.min(0.92, xFraction));
    const cy = Math.max(0.08, Math.min(0.9, yFraction));
    const finalName = name.trim() || 'Rest Area Konvoi';
    const newCheckpoint: RestCheckpoint = {
      id: `cp-${Date.now()}`,
      name: finalName,
      xFraction: cx,
      yFraction: cy,
      latitude: -6.71 + (1 - cy) * 0.08,
      longitude: 106.85 + cx * 0.16,
    };
    setRouteConfig((prev) => ({
      ...prev,
      checkpoints: [...prev.checkpoints, newCheckpoint],
    }));
    setIsPickingCheckpointOnMap(false);
    setPendingCheckpointName('');
    setMessages((prev) => [
      ...prev,
      {
        id: `cp-msg-${Date.now()}`,
        senderId: 'system',
        senderName: 'Tour Leader',
        senderVehicle: '',
        type: 'SYSTEM',
        textContent: `Titik istirahat baru dibagikan ke seluruh rombongan: ${finalName}.`,
        timestampLabel: currentClock(),
      },
    ]);
  };

  const handleRemoveCheckpoint = (checkpointId: string) => {
    setRouteConfig((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.filter((cp) => cp.id !== checkpointId),
    }));
  };

  const handleUpdateWaypoints = (nextWaypoints: RoutePoint[]) => {
    if (nextWaypoints.length < 2) return;
    const nextConfig: ConvoyRouteConfig = {
      ...routeConfig,
      waypoints: nextWaypoints,
    };
    setRouteConfig(nextConfig);
    syncMembersToRoute(nextConfig);
  };

  const handleResetDefaultWaypoints = () => {
    const nextConfig: ConvoyRouteConfig = {
      ...routeConfig,
      waypoints: INITIAL_ROUTE_CONFIG.waypoints,
    };
    setRouteConfig(nextConfig);
    syncMembersToRoute(nextConfig);
  };

  const handleUpdateMaxStraggler = (meters: number) => {
    const nextConfig = { ...routeConfig, maxStragglerDistanceMeters: meters };
    setRouteConfig(nextConfig);
    if (activeRoom) commitRoomMembers(activeRoom.members, nextConfig);
  };

  const handleUpdateOffRouteTolerance = (meters: number) => {
    const nextConfig = { ...routeConfig, offRouteToleranceMeters: meters };
    setRouteConfig(nextConfig);
    if (activeRoom) commitRoomMembers(activeRoom.members, nextConfig);
  };

  const handleToggleOffRouteSim = () => {
    const next = !isOffRouteSimActive;
    setIsOffRouteSimActive(next);
    if (!activeRoom) return;
    const updated = activeRoom.members.map((member) =>
      member.isCurrentUser
        ? {
            ...member,
            mapPosition: interpolateAlongPolyline(
              member.mapPosition.routeProgress,
              routeConfig.waypoints,
              next ? 0.12 : 0,
              member.mapPosition.speedKmh
            ),
          }
        : member
    );
    commitRoomMembers(updated);
  };

  const handleToggleStragglerSim = () => {
    const next = !isStragglerSimActive;
    setIsStragglerSimActive(next);
    if (!activeRoom) return;
    const ordered = [...activeRoom.members].sort(
      (a, b) => b.mapPosition.routeProgress - a.mapPosition.routeProgress
    );
    const tailId = ordered[ordered.length - 1]?.id;
    if (!tailId) return;

    const updated = activeRoom.members.map((member) => {
      if (member.id !== tailId) return member;
      const targetProgress = next ? 0.18 : 0.56;
      return {
        ...member,
        mapPosition: interpolateAlongPolyline(
          targetProgress,
          routeConfig.waypoints,
          0,
          next ? 28 : 52
        ),
        lastLocationText: landmarkForProgress(targetProgress),
      };
    });
    commitRoomMembers(updated);
  };

  const handleFinishAndSaveTrip = () => {
    if (!activeRoom) {
      navigateTo('trip_history', 1);
      return;
    }

    const activeSpeeds = activeRoom.members
      .map((m) => m.mapPosition.speedKmh)
      .filter((spd) => spd > 0);
    const avgSpeed =
      activeSpeeds.length > 0
        ? Math.round(activeSpeeds.reduce((sum, s) => sum + s, 0) / activeSpeeds.length)
        : 52;
    const maxSpeed = (activeSpeeds.length > 0 ? Math.max(...activeSpeeds) : 64) + 12;

    const distanceKm = Math.max(1, Number((routeConfig.totalRouteMeters / 1000).toFixed(1)));
    const estMinutes = Math.max(15, Math.round((distanceKm / Math.max(25, avgSpeed)) * 60));
    const hours = Math.floor(estMinutes / 60);
    const mins = estMinutes % 60;
    const durationLabel = hours > 0 ? `${hours}j ${mins}m` : `${mins} mnt`;

    const nowDate = new Date();
    const dateLabel = nowDate.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const newRecord: TripHistoryRecord = {
      id: `trip-${Date.now()}`,
      roomId: activeRoom.roomId,
      tourTitle: activeRoom.roomTitle,
      dateLabel,
      timeRangeLabel: `Selesai ${currentClock()}`,
      durationLabel,
      durationMinutes: estMinutes,
      distanceKm,
      avgSpeedKmh: avgSpeed,
      maxSpeedKmh: maxSpeed,
      userRole: selectedRole,
      destinationName: routeConfig.destinationName,
      destinationAddress: routeConfig.destinationAddress,
      waypoints: routeConfig.waypoints,
      visitedCheckpoints: routeConfig.checkpoints.map((cp, idx) => ({
        id: cp.id,
        name: cp.name,
        arrivedAtLabel: `Check #${idx + 1}`,
        xFraction: cp.xFraction,
        yFraction: cp.yFraction,
        latitude: cp.latitude,
        longitude: cp.longitude,
      })),
      participants: activeRoom.members.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        vehicleType: m.vehicleType,
        vehicleDetail: m.vehicleDetail,
        licensePlate: m.licensePlate,
        role: m.role,
        isSweeper: m.isSweeper,
        avatarPreset: m.avatarPreset,
        avatarPhotoUrl: m.avatarPhotoUrl,
      })),
    };

    setTripHistory((prev) => [newRecord, ...prev]);
    setSelectedTripId(newRecord.id);
    setActiveRoom(null);
    setSosState({
      isActive: false,
      senderId: '',
      senderName: '',
      senderVehicle: '',
      latitude: 0,
      longitude: 0,
      locationText: '',
      triggeredAtLabel: '',
    });
    navigateTo('trip_detail', 1);
  };

  const handleResetDemo = () => {
    setSelectedRole('TOUR_LEADER');
    setVehicleProfile(INITIAL_PROFILE);
    setActiveRoom(null);
    setJoinInput('');
    setJoinError(null);
    setSelectedMemberId(null);
    setIsSimulationRunning(true);
    setRouteConfig(INITIAL_ROUTE_CONFIG);
    setMessages([]);
    setSosState({
      isActive: false,
      senderId: '',
      senderName: '',
      senderVehicle: '',
      latitude: 0,
      longitude: 0,
      locationText: '',
      triggeredAtLabel: '',
    });
    setIsPickingDestinationOnMap(false);
    setIsPickingCheckpointOnMap(false);
    setPendingCheckpointName('');
    setIsOffRouteSimActive(false);
    setIsStragglerSimActive(false);
    setTripHistory(DEFAULT_TRIP_HISTORY);
    setSelectedTripId(DEFAULT_TRIP_HISTORY[0]?.id ?? null);
    navigateTo('role_selection', -1);
  };

  return (
    <div className="relative min-h-screen bg-[#F1F5FA] dark:bg-[#0A0F16] text-[#0F172A] dark:text-[#F1F5F9] flex flex-col transition-colors">
      {/* Subtle Touring Atmosphere Desktop & Mobile Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0"
      >
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            background:
              'radial-gradient(ellipse 80% 45% at 85% 8%, rgba(29,78,216,0.06), transparent 65%), radial-gradient(ellipse 65% 40% at 15% 92%, rgba(234,88,12,0.06), transparent 65%)',
          }}
        />
        <div
          className="hidden dark:block absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 85% 6%, rgba(30,58,138,0.22), transparent 65%), radial-gradient(ellipse 70% 45% at 15% 95%, rgba(154,52,18,0.16), transparent 65%)',
          }}
        />
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.045] dark:opacity-[0.075]"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          {[0, 1, 2, 3, 4].map((idx) => {
            const offset = idx * 64;
            return (
              <path
                key={`ws-contour-${idx}`}
                d={`M -80 ${180 + offset} C 360 ${60 + offset}, 920 ${360 + offset}, 1520 ${160 + offset}`}
                fill="none"
                stroke="currentColor"
                className="text-[#1E3A8A] dark:text-[#93C5FD]"
                strokeWidth="1.2"
              />
            );
          })}
          <path
            d="M -60 790 C 380 650, 940 850, 1520 670"
            fill="none"
            stroke="currentColor"
            className="text-[#EA580C] dark:text-[#FB923C]"
            strokeWidth="2"
            strokeDasharray="12 10"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Top Bar Contract: 3 zones */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#131B26]/95 backdrop-blur-md border-b border-[#E2E8F0] dark:border-[#2D3A4F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleResetDemo();
            }}
            className="text-lg font-bold tracking-tight text-[#111827] dark:text-[#F1F5F9] whitespace-nowrap shrink-0"
          >
            KonvoiKu
          </a>

          <nav
            aria-label="Navigasi Layar"
            className="hidden md:flex items-center gap-5 text-sm font-medium text-[#475569] dark:text-[#CBD5E1]"
          >
            {ROUTE_STEPS.map((step) => {
              const active =
                currentRoute === step.route ||
                (step.route === 'trip_history' && currentRoute === 'trip_detail');
              return (
                <button
                  key={step.route}
                  type="button"
                  onClick={() => {
                    if (step.route === 'tour_leader') setSelectedRole('TOUR_LEADER');
                    if (step.route === 'join_tour') setSelectedRole('MEMBER');
                    if (step.route === 'live_map') ensureDemoRoom(selectedRole);
                    navigateTo(step.route, 1);
                  }}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                    active
                      ? 'text-[#1D4ED8] dark:text-[#60A5FA] border-[#1D4ED8] dark:border-[#60A5FA]'
                      : 'border-transparent hover:text-[#111827] dark:hover:text-white'
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetDemo}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Reset Alur</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-balance">
              KonvoiKu — Navigasi Konvoi, Checkpoints & Komunikasi Real-Time
            </h1>
            <p className="mt-1 text-sm text-[#475569] dark:text-[#94A3B8]">
              Material Design 3 · Setup Bertahap · Peta Kolaps · Chat Messenger · Waveform PTT & SOS
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex lg:hidden items-center p-1 rounded-lg bg-[#E2E8F0] dark:bg-[#1E2732]">
              <button
                type="button"
                onClick={() => setMobileWorkspaceTab('preview')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  mobileWorkspaceTab === 'preview'
                    ? 'bg-white dark:bg-[#0F1419] text-[#111827] dark:text-white shadow-xs'
                    : 'text-[#475569] dark:text-[#94A3B8]'
                }`}
              >
                Pratinjau App
              </button>
              <button
                type="button"
                onClick={() => setMobileWorkspaceTab('code')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  mobileWorkspaceTab === 'code'
                    ? 'bg-white dark:bg-[#0F1419] text-[#111827] dark:text-white shadow-xs'
                    : 'text-[#475569] dark:text-[#94A3B8]'
                }`}
              >
                Kode Kotlin
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white dark:bg-[#181F26] border border-[#E2E8F0] dark:border-[#334155] text-xs font-medium flex items-center gap-2 hover:bg-[#F1F5F9] dark:hover:bg-[#222B35] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-[#FB923C]" />
                  <span>Tema Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[#475569]" />
                  <span>Tema Gelap</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive Android Simulator */}
          <div
            className={`lg:col-span-5 xl:col-span-4 flex flex-col items-center ${
              mobileWorkspaceTab === 'code' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="flex md:hidden flex-wrap justify-center gap-1.5 mb-4 w-full">
              {ROUTE_STEPS.map((step) => {
                const active =
                  currentRoute === step.route ||
                  (step.route === 'trip_history' && currentRoute === 'trip_detail');
                return (
                  <button
                    key={step.route}
                    type="button"
                    onClick={() => {
                      if (step.route === 'tour_leader') setSelectedRole('TOUR_LEADER');
                      if (step.route === 'join_tour') setSelectedRole('MEMBER');
                      if (step.route === 'live_map') ensureDemoRoom(selectedRole);
                      navigateTo(step.route, 1);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#EA580C] text-white'
                        : 'bg-white dark:bg-[#181F26] border border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1]'
                    }`}
                  >
                    {step.label}
                  </button>
                );
              })}
            </div>

            <div className="w-full max-w-[390px] rounded-[34px] border-[6px] border-[#1E293B] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F1419] shadow-xl overflow-hidden flex flex-col">
              {/* Android Status Bar */}
              <div className="h-7 px-5 bg-white dark:bg-[#181F26] flex items-center justify-between text-[11px] font-medium text-[#475569] dark:text-[#94A3B8] select-none border-b border-[#F1F5F9] dark:border-[#222B35]">
                <span className="tabular-nums">09:41</span>
                <div className="w-16 h-3.5 rounded-full bg-[#0F172A] dark:bg-[#334155]" />
                <span className="tabular-nums">5G · 98%</span>
              </div>

              {/* Compose NavHost Animated Viewport */}
              <div className="relative h-[680px] overflow-y-auto overflow-x-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentRoute}
                    initial={{ opacity: 0, x: navDirection * 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: navDirection * -28 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="min-h-full flex flex-col"
                  >
                    {currentRoute === 'role_selection' && (
                      <RoleSelectionView
                        activeRoom={activeRoom}
                        destinationName={routeConfig.destinationName}
                        tripHistoryCount={tripHistory.length}
                        latestTripTitle={tripHistory[0]?.tourTitle}
                        onSelectRole={handleSelectRole}
                        onResumeCurrentConvoy={() => {
                          ensureDemoRoom(selectedRole);
                          navigateTo('live_map', 1);
                        }}
                        onOpenTripHistory={() => navigateTo('trip_history', 1)}
                        onOpenAboutApp={() => {
                          setAboutReturnRoute('role_selection');
                          navigateTo('about_app', 1);
                        }}
                      />
                    )}

                    {currentRoute === 'vehicle_profile' && (
                      <VehicleProfileView
                        selectedRole={selectedRole}
                        profile={vehicleProfile}
                        onUpdateProfile={handleUpdateProfile}
                        onBack={() => navigateTo('role_selection', -1)}
                        onOpenAboutApp={() => {
                          setAboutReturnRoute('vehicle_profile');
                          navigateTo('about_app', 1);
                        }}
                        onContinue={() =>
                          navigateTo(
                            selectedRole === 'TOUR_LEADER'
                              ? 'tour_leader'
                              : 'join_tour',
                            1
                          )
                        }
                      />
                    )}

                    {currentRoute === 'tour_leader' && (
                      <TourLeaderView
                        activeRoom={activeRoom}
                        routeConfig={routeConfig}
                        destinationPresets={DESTINATION_PRESETS}
                        onSelectPreset={handleSelectPreset}
                        onPickDestinationFromMap={handlePickCustomDestination}
                        onUpdateWaypoints={handleUpdateWaypoints}
                        onResetDefaultWaypoints={handleResetDefaultWaypoints}
                        onAddCheckpoint={handleConfirmAddCheckpoint}
                        onRemoveCheckpoint={handleRemoveCheckpoint}
                        onUpdateMaxStragglerDistance={handleUpdateMaxStraggler}
                        onToggleSoundAlert={() =>
                          setRouteConfig((prev) => ({
                            ...prev,
                            soundAlertEnabled: !prev.soundAlertEnabled,
                          }))
                        }
                        onCreateRoom={handleCreateRoom}
                        onSimulateJoin={handleSimulateJoin}
                        onRemoveMember={handleRemoveMember}
                        onEnterMapPlaceholder={() =>
                          navigateTo('live_map', 1)
                        }
                        onBack={() => navigateTo('vehicle_profile', -1)}
                      />
                    )}

                    {currentRoute === 'join_tour' && (
                      <JoinTourView
                        joinInput={joinInput}
                        joinError={joinError}
                        extractedRoomId={extractRoomId(joinInput)}
                        vehicleProfile={vehicleProfile}
                        onInputChange={(val) => {
                          setJoinInput(val);
                          setJoinError(null);
                        }}
                        onJoinSubmit={handleJoinSubmit}
                        onBack={() => navigateTo('vehicle_profile', -1)}
                      />
                    )}

                    {currentRoute === 'live_map' && (
                      <LiveTrackingMapView
                        activeRoom={activeRoom}
                        role={selectedRole}
                        selectedMemberId={selectedMemberId}
                        isSimulationRunning={isSimulationRunning}
                        routeConfig={routeConfig}
                        stragglerAlert={stragglerAlert}
                        offRouteAlert={offRouteAlert}
                        sosState={sosState}
                        messages={messages}
                        isRecordingVoice={isRecordingVoice}
                        recordingSeconds={recordingSeconds}
                        playingMessageId={playingMessageId}
                        isPickingDestinationOnMap={isPickingDestinationOnMap}
                        isPickingCheckpointOnMap={isPickingCheckpointOnMap}
                        pendingCheckpointName={pendingCheckpointName}
                        isOffRouteSimActive={isOffRouteSimActive}
                        isStragglerSimActive={isStragglerSimActive}
                        destinationPresets={DESTINATION_PRESETS}
                        onSelectMember={setSelectedMemberId}
                        onToggleSimulation={() =>
                          setIsSimulationRunning((prev) => !prev)
                        }
                        onSelectPreset={handleSelectPreset}
                        onPickCustomDestination={handlePickCustomDestination}
                        onTogglePickMode={(enabled) => {
                          if (enabled) {
                            setIsPickingCheckpointOnMap(false);
                            setPendingCheckpointName('');
                          }
                          setIsPickingDestinationOnMap(enabled);
                        }}
                        onStartPickCheckpoint={handleStartPickCheckpoint}
                        onCancelPickCheckpoint={handleCancelPickCheckpoint}
                        onConfirmAddCheckpoint={handleConfirmAddCheckpoint}
                        onRemoveCheckpoint={handleRemoveCheckpoint}
                        onUpdateMaxStragglerDistance={handleUpdateMaxStraggler}
                        onUpdateOffRouteTolerance={handleUpdateOffRouteTolerance}
                        onToggleSoundAlert={() =>
                          setRouteConfig((prev) => ({
                            ...prev,
                            soundAlertEnabled: !prev.soundAlertEnabled,
                          }))
                        }
                        onToggleOffRouteSim={handleToggleOffRouteSim}
                        onToggleStragglerSim={handleToggleStragglerSim}
                        onTriggerSos={handleTriggerSos}
                        onResolveSos={handleResolveSos}
                        onSendTextMessage={handleSendTextMessage}
                        onStartVoiceRecord={handleStartVoiceRecord}
                        onStopVoiceRecord={handleStopVoiceRecord}
                        onToggleVoicePlay={handleToggleVoicePlay}
                        onUpdateOwnCondition={handleUpdateOwnCondition}
                        onAssignSweeper={handleAssignSweeper}
                        onSwitchPreviewRole={setSelectedRole}
                        onFinishAndSaveTrip={handleFinishAndSaveTrip}
                        onExitRoom={() => navigateTo('role_selection', -1)}
                      />
                    )}

                    {currentRoute === 'trip_history' && (
                      <TripHistoryView
                        trips={tripHistory}
                        onSelectTrip={(tripId) => {
                          setSelectedTripId(tripId);
                          navigateTo('trip_detail', 1);
                        }}
                        onBack={() => navigateTo('role_selection', -1)}
                      />
                    )}

                    {currentRoute === 'trip_detail' && (
                      <TripDetailView
                        trip={
                          tripHistory.find((t) => t.id === selectedTripId) ??
                          tripHistory[0] ??
                          null
                        }
                        onBack={() => navigateTo('trip_history', -1)}
                      />
                    )}

                    {currentRoute === 'about_app' && (
                      <AboutAppView
                        onBack={() => navigateTo(aboutReturnRoute, -1)}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Android Gesture Navigation Pill */}
              <div className="h-5 bg-white dark:bg-[#181F26] flex items-center justify-center border-t border-[#F1F5F9] dark:border-[#222B35]">
                <div className="w-28 h-1 rounded-full bg-[#CBD5E1] dark:bg-[#475569]" />
              </div>
            </div>
          </div>

          {/* Right Column: Kotlin & Jetpack Compose Source Inspector */}
          <div
            className={`lg:col-span-7 xl:col-span-8 ${
              mobileWorkspaceTab === 'preview' ? 'hidden lg:block' : 'block'
            }`}
          >
            <KotlinSourceExplorer
              currentRoute={currentRoute}
              syncWithPreview={syncWithPreview}
              onToggleSync={() => setSyncWithPreview((prev) => !prev)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
