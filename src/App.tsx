import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { User } from 'firebase/auth';
import { AlertTriangle, Moon, RotateCcw, Sun } from 'lucide-react';
import { KotlinSourceExplorer } from './components/KotlinSourceExplorer';
import { AboutAppView } from './components/screens/AboutAppView';
import { AdminBackendView } from './components/screens/AdminBackendView';
import { CustomizeProfileView } from './components/screens/CustomizeProfileView';
import { JoinTourView } from './components/screens/JoinTourView';
import { LiveTrackingMapView } from './components/screens/LiveTrackingMapView';
import { LoginView } from './components/screens/LoginView';
import { RoleSelectionView } from './components/screens/RoleSelectionView';
import { TourLeaderView } from './components/screens/TourLeaderView';
import { TripDetailView } from './components/screens/TripDetailView';
import { TripHistoryView } from './components/screens/TripHistoryView';
import { VehicleProfileView } from './components/screens/VehicleProfileView';
import {
  mapFirebaseAuthError,
  sendResetPasswordEmail,
  signInWithEmail,
  signInWithFacebook,
  signInWithGoogle,
  signInWithGoogleForMobileBridge,
  signOutFirebase,
  signUpWithEmail,
  subscribeToAuthState,
  testFirestoreConnection,
} from './firebase';
import { LiveGpsFix, useDeviceGps } from './hooks/useDeviceGps';
import {
  addRoomCheckpoint,
  assignSyncedSweeper,
  createSyncedRoom,
  DEFAULT_GLOBAL_APP_CONFIG,
  finishSyncedRoom,
  isAdminEmailAddress,
  isVerifiedAdminSession,
  joinSyncedRoom,
  loadLocalSession,
  loadProfileByEmail,
  loadUserPrivateProfile,
  loadUserTripsFromFirestore,
  normalizeProfileEmail,
  publishMemberTelemetry,
  publishUserPresence,
  removeRoomCheckpoint,
  removeSyncedMember,
  resolveSyncedSos,
  saveLocalSession,
  saveProfileByEmail,
  saveTripRecordToFirestore,
  saveUserPrivateProfile,
  sendRoomMessage,
  subscribeToGlobalAppConfig,
  subscribeToSyncedRoom,
  triggerSyncedSos,
  updateSyncedMemberCondition,
  updateSyncedRoomRoute,
} from './services/convoySyncService';
import {
  AuthProviderId,
  ConnectionStatus,
  ConvoyMember,
  ConvoyRouteConfig,
  DestinationPreset,
  GlobalAppConfig,
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
import {
  computePolylineLengthMeters,
  downsampleRoutePoints,
  downsampleTrackPoints,
  evaluatePositionAlongRoute,
  haversineMeters,
  LatLngPoint,
} from './utils/geo';

const INITIAL_PROFILE: VehicleProfile = {
  fullName: '',
  email: '',
  authProvider: 'local',
  clubName: '',
  homeCity: '',
  bio: '',
  instagramHandle: '',
  vehicleType: 'MOBIL',
  vehicleDetail: '',
  licensePlate: '',
  emergencyContact: '',
  avatarPreset: 'HELMET_TOURING',
};

const DESTINATION_PRESETS: DestinationPreset[] = [
  {
    name: 'Puncak Pass Resort',
    endPoint: { xFraction: 0.86, yFraction: 0.14, latitude: -6.7003, longitude: 106.996 },
    totalMeters: 16500,
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
  destinationAddress: 'Jl. Raya Puncak KM 90, Cisarua · -6.7003, 106.9960',
  waypoints: [
    { xFraction: 0.14, yFraction: 0.86, latitude: -6.648, longitude: 106.845 },
    { xFraction: 0.32, yFraction: 0.65, latitude: -6.662, longitude: 106.882 },
    { xFraction: 0.55, yFraction: 0.48, latitude: -6.678, longitude: 106.925 },
    { xFraction: 0.72, yFraction: 0.3, latitude: -6.69, longitude: 106.962 },
    { xFraction: 0.86, yFraction: 0.14, latitude: -6.7003, longitude: 106.996 },
  ],
  checkpoints: [
    {
      id: 'cp-default-1',
      name: 'Rest Area Ciawi KM 45',
      xFraction: 0.44,
      yFraction: 0.56,
      latitude: -6.668,
      longitude: 106.895,
    },
  ],
  totalRouteMeters: 16500,
  offRouteToleranceMeters: 75,
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
      timestampLabel: currentClock(),
    },
    {
      id: 'init-1',
      senderId: 'leader',
      senderName: 'Budi',
      senderVehicle: 'Avanza Hitam',
      type: 'TEXT',
      textContent: 'Rombongan siap, jalur resmi sudah ditetapkan di TomTom Maps.',
      timestampLabel: currentClock(),
      senderAvatarPreset: 'RIDER_CAPTAIN',
    },
  ];
}

function buildPolylineToDestination(start: RoutePoint, end: RoutePoint): RoutePoint[] {
  const mid1: RoutePoint = {
    xFraction: start.xFraction + (end.xFraction - start.xFraction) * 0.33,
    yFraction: start.yFraction + (end.yFraction - start.yFraction) * 0.33,
    latitude: start.latitude + (end.latitude - start.latitude) * 0.33,
    longitude: start.longitude + (end.longitude - start.longitude) * 0.33,
  };
  const mid2: RoutePoint = {
    xFraction: start.xFraction + (end.xFraction - start.xFraction) * 0.66,
    yFraction: start.yFraction + (end.yFraction - start.yFraction) * 0.66,
    latitude: start.latitude + (end.latitude - start.latitude) * 0.66,
    longitude: start.longitude + (end.longitude - start.longitude) * 0.66,
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

  const dLat = b.latitude - a.latitude;
  const dLng = b.longitude - a.longitude;
  const geoLen = Math.max(0.0001, Math.hypot(dLat, dLng));
  const latShift = (-dLng / geoLen) * lateralOffset * 0.03;
  const lngShift = (dLat / geoLen) * lateralOffset * 0.03;

  return {
    routeProgress: p,
    xFraction: Math.max(0.06, Math.min(0.94, a.xFraction + dx * localT + perpX * lateralOffset)),
    yFraction: Math.max(0.06, Math.min(0.94, a.yFraction + dy * localT + perpY * lateralOffset)),
    latitude: a.latitude + dLat * localT + latShift,
    longitude: a.longitude + dLng * localT + lngShift,
    speedKmh,
  };
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
    const hasValidGeo =
      Math.abs(member.mapPosition.latitude) > 0.001 ||
      Math.abs(member.mapPosition.longitude) > 0.001;
    if (hasValidGeo && routeConfig.waypoints.length >= 2) {
      const geoEval = evaluatePositionAlongRoute(
        {
          lat: member.mapPosition.latitude,
          lng: member.mapPosition.longitude,
        },
        routeConfig.waypoints,
        routeConfig.totalRouteMeters
      );
      return {
        ...member,
        routeDistanceMeters: geoEval.distanceTraveledMeters,
        offRouteMeters: geoEval.offRouteMeters,
        mapPosition: {
          ...member.mapPosition,
          routeProgress: geoEval.routeProgress,
        },
      };
    }

    const routeDistanceMeters = Math.round(
      member.mapPosition.routeProgress * routeConfig.totalRouteMeters
    );
    return { ...member, routeDistanceMeters, offRouteMeters: 0 };
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
    destinationAddress: 'Jl. Raya Puncak KM 90, Cisarua · -6.7003, 106.9960',
    waypoints: downsampleRoutePoints(
      [
        { lat: -6.5976, lng: 106.806 },
        { lat: -6.6124, lng: 106.8185 },
        { lat: -6.6285, lng: 106.8322 },
        { lat: -6.6458, lng: 106.8452 },
        { lat: -6.6529, lng: 106.8618 },
        { lat: -6.6562, lng: 106.8794 },
        { lat: -6.6638, lng: 106.8942 },
        { lat: -6.6705, lng: 106.9088 },
        { lat: -6.6746, lng: 106.9245 },
        { lat: -6.6818, lng: 106.9372 },
        { lat: -6.6852, lng: 106.9488 },
        { lat: -6.6914, lng: 106.9605 },
        { lat: -6.6948, lng: 106.9735 },
        { lat: -6.6981, lng: 106.9852 },
        { lat: -6.7003, lng: 106.996 },
      ],
      60
    ),
    visitedCheckpoints: [
      {
        id: 'cp-s1',
        name: 'Rest Area Ciawi KM 45',
        arrivedAtLabel: '06:20',
        xFraction: 0.36,
        yFraction: 0.62,
        latitude: -6.6638,
        longitude: 106.8942,
      },
      {
        id: 'cp-s2',
        name: 'Warung Kopi Cisarua',
        arrivedAtLabel: '07:15',
        xFraction: 0.66,
        yFraction: 0.36,
        latitude: -6.6852,
        longitude: 106.9488,
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
    waypoints: downsampleRoutePoints(
      [
        { lat: -6.8425, lng: 107.4965 },
        { lat: -6.8548, lng: 107.5152 },
        { lat: -6.8662, lng: 107.5318 },
        { lat: -6.8745, lng: 107.5515 },
        { lat: -6.8722, lng: 107.5718 },
        { lat: -6.8638, lng: 107.5892 },
        { lat: -6.8524, lng: 107.5956 },
        { lat: -6.8398, lng: 107.6012 },
        { lat: -6.8265, lng: 107.6064 },
        { lat: -6.8178, lng: 107.6115 },
        { lat: -6.812, lng: 107.618 },
      ],
      60
    ),
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
];

const ROUTE_STEPS: Array<{ route: ScreenRoute; label: string }> = [
  { route: 'login', label: '0. Masuk' },
  { route: 'role_selection', label: '1. Beranda' },
  { route: 'customize_profile', label: '1B. Profil User' },
  { route: 'vehicle_profile', label: '2. Kendaraan' },
  { route: 'tour_leader', label: '3A. Setup Leader' },
  { route: 'join_tour', label: '3B. Gabung' },
  { route: 'live_map', label: '4. Peta Live' },
  { route: 'trip_history', label: '5. Riwayat' },
];

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<ScreenRoute>('login');
  const [aboutReturnRoute, setAboutReturnRoute] =
    useState<ScreenRoute>('login');
  const [customizeReturnRoute, setCustomizeReturnRoute] =
    useState<ScreenRoute>('role_selection');
  const [navDirection, setNavDirection] = useState<1 | -1>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole>('TOUR_LEADER');
  const [vehicleProfile, setVehicleProfile] = useState<VehicleProfile>(INITIAL_PROFILE);

  // Auth & Cloud Room Sync state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authProvider, setAuthProvider] = useState<AuthProviderId>('local');
  const [localUserName, setLocalUserName] = useState<string | null>(null);
  const [localUserEmail, setLocalUserEmail] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfoMessage, setAuthInfoMessage] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSyncMessage, setProfileSyncMessage] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isMobileGoogleBridge] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('mobile_auth') === 'google'
      : false
  );
  const [mobileBridgeBusy, setMobileBridgeBusy] = useState(false);
  const [mobileBridgeError, setMobileBridgeError] = useState<string | null>(null);
  const [mobileBridgeDeepLink, setMobileBridgeDeepLink] = useState<string | null>(null);
  const [mobileBridgeEmail, setMobileBridgeEmail] = useState<string>('');
  const [globalConfig, setGlobalConfig] = useState<GlobalAppConfig>(
    DEFAULT_GLOBAL_APP_CONFIG
  );

  const [activeRoom, setActiveRoom] = useState<TourRoom | null>(null);
  const [joinInput, setJoinInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(true);
  const [routeConfig, setRouteConfig] = useState<ConvoyRouteConfig>(INITIAL_ROUTE_CONFIG);
  const [offRouteAlert, setOffRouteAlert] = useState<OffRouteAlertState>({
    isOffRoute: false,
    deviationMeters: 0,
    toleranceMeters: 75,
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
  const [lastCompletedTrip, setLastCompletedTrip] = useState<TripHistoryRecord | null>(null);
  const [syncWithPreview, setSyncWithPreview] = useState(true);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'preview' | 'code'>('preview');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTelemetrySentMsRef = useRef<number>(0);
  const lastTelemetryFixRef = useRef<LatLngPoint | null>(null);
  const lastSyncedRouteSigRef = useRef<string>('');
  const recordedTrackRef = useRef<LatLngPoint[]>([]);
  const routeConfigRef = useRef<ConvoyRouteConfig>(routeConfig);
  routeConfigRef.current = routeConfig;
  const activeRoomRef = useRef<TourRoom | null>(activeRoom);
  activeRoomRef.current = activeRoom;
  const authUserRef = useRef<User | null>(authUser);
  authUserRef.current = authUser;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Listen for TomTom Trial quota limit
  useEffect(() => {
    const handleQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('tomtom-quota-exceeded', handleQuota);
    return () => window.removeEventListener('tomtom-quota-exceeded', handleQuota);
  }, []);

  // Restore local/Instagram session on startup if no Firebase user active
  useEffect(() => {
    const savedSession = loadLocalSession();
    if (savedSession) {
      setLocalUserName(savedSession.fullName);
      setLocalUserEmail(savedSession.email);
      setAuthProvider(savedSession.authProvider);
      const emailProfile = loadProfileByEmail(savedSession.email);
      if (emailProfile) {
        setVehicleProfile((prev) => ({
          ...prev,
          ...emailProfile,
          fullName: emailProfile.fullName || savedSession.fullName,
          email: emailProfile.email || savedSession.email,
          instagramHandle:
            emailProfile.instagramHandle || savedSession.instagramHandle || '',
          authProvider: savedSession.authProvider,
        }));
      } else {
        setVehicleProfile((prev) => ({
          ...prev,
          fullName: prev.fullName || savedSession.fullName,
          email: savedSession.email,
          instagramHandle: savedSession.instagramHandle || '',
          authProvider: savedSession.authProvider,
        }));
      }
      setCurrentRoute((prev) => (prev === 'login' ? 'role_selection' : prev));
    }
  }, []);

  // Listen for Instagram 3P OAuth popup callback messages
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setIsSigningIn(false);
        setAuthError(
          typeof event.data.error === 'string'
            ? event.data.error
            : 'Autentikasi Instagram dibatalkan atau gagal.'
        );
        return;
      }

      if (
        event.data?.type === 'OAUTH_AUTH_SUCCESS' &&
        event.data?.provider === 'instagram'
      ) {
        const igProfile = event.data.profile as
          | {
              id?: string;
              username?: string;
              fullName?: string;
              avatarPhotoUrl?: string;
            }
          | undefined;
        const igUsername = (igProfile?.username || '').replace(/^@/, '');
        const igEmail = igUsername
          ? `${igUsername.toLowerCase()}@instagram.konvoiku.id`
          : '';
        const resolvedName =
          igProfile?.fullName?.trim() ||
          (igUsername ? `@${igUsername}` : 'Rider Instagram');
        const restoredByEmail = loadProfileByEmail(igEmail);

        setIsSigningIn(false);
        setAuthError(null);
        setAuthInfoMessage(
          `Akun Instagram @${igUsername || 'rider'} berhasil terhubung!`
        );
        setAuthProvider('instagram');
        setLocalUserName(resolvedName);
        setLocalUserEmail(restoredByEmail?.email || igEmail);

        const nextProfile: VehicleProfile = {
          ...(restoredByEmail || INITIAL_PROFILE),
          fullName: restoredByEmail?.fullName || resolvedName,
          email: restoredByEmail?.email || igEmail,
          authProvider: 'instagram',
          instagramHandle: igUsername || restoredByEmail?.instagramHandle || '',
          avatarPhotoUrl:
            restoredByEmail?.avatarPhotoUrl ||
            (igProfile?.avatarPhotoUrl ? igProfile.avatarPhotoUrl : undefined),
        };
        setVehicleProfile(nextProfile);
        saveProfileByEmail(nextProfile.email, nextProfile);
        saveLocalSession({
          fullName: nextProfile.fullName,
          email: nextProfile.email || '',
          authProvider: 'instagram',
          instagramHandle: igUsername,
        });
        setNavDirection(1);
        setCurrentRoute('customize_profile');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  // Test Firestore connection + Subscribe to Firebase Auth
  useEffect(() => {
    testFirestoreConnection();
    const unsubAuth = subscribeToAuthState(async (user) => {
      setAuthUser(user);
      if (user) {
        setAuthError(null);
        const rawProviderId = user.providerData?.[0]?.providerId || '';
        const detectedProvider: AuthProviderId = rawProviderId.includes('facebook')
          ? 'facebook'
          : rawProviderId.includes('password')
            ? 'email'
            : 'google';
        setAuthProvider(detectedProvider);

        const normalizedUserEmail = normalizeProfileEmail(user.email);
        if (normalizedUserEmail) {
          setLocalUserEmail(normalizedUserEmail);
        }

        setCurrentRoute((prev) => (prev === 'login' ? 'role_selection' : prev));
        try {
          const savedCloud = await loadUserPrivateProfile(user.uid);
          const savedLocalByEmail = loadProfileByEmail(
            savedCloud?.email || normalizedUserEmail
          );

          const merged: VehicleProfile = {
            ...INITIAL_PROFILE,
            ...(savedLocalByEmail || {}),
            ...(savedCloud || {}),
            fullName:
              savedCloud?.fullName ||
              savedLocalByEmail?.fullName ||
              user.displayName ||
              'Rider KonvoiKu',
            email:
              normalizeProfileEmail(savedCloud?.email) ||
              normalizeProfileEmail(savedLocalByEmail?.email) ||
              normalizedUserEmail,
            authProvider:
              savedCloud?.authProvider && savedCloud.authProvider !== 'local'
                ? savedCloud.authProvider
                : detectedProvider,
          };

          setVehicleProfile(merged);
          if (merged.email) {
            saveProfileByEmail(merged.email, merged);
          }

          if (!savedCloud) {
            saveUserPrivateProfile(user.uid, merged).catch(() => {});
          }

          const cloudTrips = await loadUserTripsFromFirestore(user.uid);
          if (cloudTrips.length > 0) {
            setTripHistory((prev) => {
              const cloudIds = new Set(cloudTrips.map((t) => t.id));
              return [...cloudTrips, ...prev.filter((t) => !cloudIds.has(t.id))];
            });
          }
        } catch (err) {
          console.warn('Gagal memuat profil cloud:', err);
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // Subscribe to Global App Config (/app_config/global)
  useEffect(() => {
    const unsubConfig = subscribeToGlobalAppConfig((cfg) => {
      setGlobalConfig(cfg);
      if (!activeRoomRef.current) {
        setRouteConfig((prev) => ({
          ...prev,
          offRouteToleranceMeters: cfg.defaultOffRouteToleranceMeters,
          maxStragglerDistanceMeters: cfg.defaultMaxStragglerDistanceMeters,
          soundAlertEnabled: cfg.defaultSoundAlertEnabled,
        }));
      }
    });
    return () => unsubConfig();
  }, []);

  useEffect(() => {
    if (!isRecordingVoice) return;
    const timer = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecordingVoice]);

  const commitRoomMembers = useCallback(
    (
      rawMembers: ConvoyMember[],
      config: ConvoyRouteConfig = routeConfigRef.current,
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
    },
    []
  );

  // Real Device GPS tracking
  const handleGpsFix = useCallback(
    (fix: LiveGpsFix) => {
      const currentRoom = activeRoomRef.current;
      const currentCfg = routeConfigRef.current;
      const user = authUserRef.current;
      if (!currentRoom) return;

      // Record real GPS breadcrumb along the route actually traveled
      if (fix.accuracyMeters <= 80 || recordedTrackRef.current.length === 0) {
        const pt: LatLngPoint = { lat: fix.latitude, lng: fix.longitude };
        const track = recordedTrackRef.current;
        const lastPt = track[track.length - 1];
        if (!lastPt || haversineMeters(lastPt, pt) >= 15) {
          track.push(pt);
          if (track.length > 1800) {
            recordedTrackRef.current = downsampleTrackPoints(track, 20, 300);
          }
        }
      }

      const geoEval = evaluatePositionAlongRoute(
        { lat: fix.latitude, lng: fix.longitude },
        currentCfg.waypoints,
        currentCfg.totalRouteMeters
      );

      // Update local self marker immediately for responsive UI
      const updatedMembers = currentRoom.members.map((m) =>
        m.isCurrentUser
          ? {
              ...m,
              connectionStatus: 'CONNECTED' as ConnectionStatus,
              lastLocationText: `GPS (${fix.latitude.toFixed(4)}, ${fix.longitude.toFixed(4)})`,
              lastUpdatedLabel: 'GPS Live',
              mapPosition: {
                ...m.mapPosition,
                latitude: fix.latitude,
                longitude: fix.longitude,
                speedKmh: fix.speedKmh,
                heading: fix.heading,
                accuracyMeters: fix.accuracyMeters,
                routeProgress: geoEval.routeProgress,
              },
            }
          : m
      );
      commitRoomMembers(updatedMembers, currentCfg);

      // Publish throttled telemetry to Firestore when in a synced room
      if (currentRoom.isSyncedRoom && user) {
        const now = Date.now();
        const prevPt = lastTelemetryFixRef.current;
        const movedMeters = prevPt
          ? haversineMeters(prevPt, { lat: fix.latitude, lng: fix.longitude })
          : 999;
        if (now - lastTelemetrySentMsRef.current >= 2200 || movedMeters >= 15) {
          lastTelemetrySentMsRef.current = now;
          lastTelemetryFixRef.current = { lat: fix.latitude, lng: fix.longitude };
          publishMemberTelemetry(currentRoom.roomId, user.uid, {
            latitude: fix.latitude,
            longitude: fix.longitude,
            speedKmh: fix.speedKmh,
            heading: fix.heading,
            accuracyMeters: fix.accuracyMeters,
            routeProgress: geoEval.routeProgress,
            xFraction: Math.max(0.08, Math.min(0.92, geoEval.routeProgress)),
            yFraction: Math.max(0.08, Math.min(0.92, 1 - geoEval.routeProgress)),
            lastLocationText: `GPS Live (±${fix.accuracyMeters}m)`,
          }).catch((err) => {
            console.warn('Gagal mengirim telemetri GPS ke Firestore:', err);
          });
        }
      }
    },
    [commitRoomMembers]
  );

  const gps = useDeviceGps({
    enabled:
      Boolean(activeRoom) ||
      currentRoute === 'live_map' ||
      currentRoute === 'tour_leader',
    onFix: handleGpsFix,
  });

  // Publish live online/traveling presence heartbeat for Admin Backend monitoring
  useEffect(() => {
    if (!authUser) return;
    const sendHeartbeat = () => {
      const selfMember = activeRoom?.members.find((m) => m.isCurrentUser);
      const speed = gps.lastFix?.speedKmh ?? selfMember?.mapPosition.speedKmh ?? 0;
      publishUserPresence(authUser.uid, {
        fullName:
          vehicleProfile.fullName.trim() ||
          authUser.displayName ||
          'Rider KonvoiKu',
        email:
          (vehicleProfile.email ?? '').trim() ||
          authUser.email ||
          localUserEmail ||
          '',
        isTraveling: Boolean(activeRoom),
        activeRoomId: activeRoom?.roomId || '',
        speedKmh: speed,
      }).catch(() => {});
    };

    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 30_000);
    return () => clearInterval(timer);
  }, [
    authUser?.uid,
    authUser?.displayName,
    authUser?.email,
    activeRoom?.roomId,
    vehicleProfile.fullName,
    vehicleProfile.email,
    localUserEmail,
    gps.lastFix?.speedKmh,
  ]);

  // Real-time Firestore room subscription when activeRoom.isSyncedRoom === true
  useEffect(() => {
    if (!activeRoom?.isSyncedRoom || !activeRoom.roomId || !authUser) return;

    let latestMembers: ConvoyMember[] = [];
    let latestCheckpoints: RestCheckpoint[] = routeConfigRef.current.checkpoints;

    const unsub = subscribeToSyncedRoom(activeRoom.roomId, {
      onRoomUpdate: (snapshot) => {
        if (!snapshot) return;
        const mergedConfig: ConvoyRouteConfig = {
          ...snapshot.routeConfig,
          checkpoints: latestCheckpoints,
        };
        const sig = `${mergedConfig.destinationName}|${mergedConfig.totalRouteMeters}|${mergedConfig.waypoints.length}`;
        lastSyncedRouteSigRef.current = sig;
        setRouteConfig(mergedConfig);
        setSosState(snapshot.sosState);
        setActiveRoom((prev) => {
          const base: TourRoom = {
            roomId: snapshot.room.roomId,
            roomTitle: snapshot.room.roomTitle,
            inviteLink: snapshot.room.inviteLink,
            createdAtLabel: snapshot.room.createdAtLabel,
            isSyncedRoom: true,
            leaderUid: snapshot.room.leaderUid,
            members: prev?.members ?? latestMembers,
          };
          const evaluated = evaluateRoomSafety(base.members, mergedConfig);
          setOffRouteAlert(evaluated.offRouteAlert);
          setStragglerAlert(evaluated.stragglerAlert);
          return { ...base, members: evaluated.members };
        });
        if (snapshot.room.leaderUid === authUser.uid) {
          setSelectedRole('TOUR_LEADER');
        }
      },
      onMembersUpdate: (members) => {
        latestMembers = members;
        const cfg = routeConfigRef.current;
        const evaluated = evaluateRoomSafety(members, cfg);
        setOffRouteAlert(evaluated.offRouteAlert);
        setStragglerAlert(evaluated.stragglerAlert);
        setActiveRoom((prev) =>
          prev ? { ...prev, members: evaluated.members } : prev
        );
        const self = members.find((m) => m.isCurrentUser);
        if (self) {
          setSelectedMemberId((cur) => cur ?? self.id);
        }
      },
      onCheckpointsUpdate: (checkpoints) => {
        latestCheckpoints = checkpoints;
        setRouteConfig((prev) => {
          const next = { ...prev, checkpoints };
          if (latestMembers.length > 0) {
            const evaluated = evaluateRoomSafety(latestMembers, next);
            setOffRouteAlert(evaluated.offRouteAlert);
            setStragglerAlert(evaluated.stragglerAlert);
          }
          return next;
        });
      },
      onMessagesUpdate: (nextMsgs) => {
        setMessages(nextMsgs);
      },
    });

    return () => {
      unsub();
    };
  }, [activeRoom?.roomId, activeRoom?.isSyncedRoom, authUser?.uid]);

  // Offline Demo Simulator ONLY when NOT in a real Firestore synced room
  useEffect(() => {
    if (!isSimulationRunning || !activeRoom || activeRoom.isSyncedRoom) return;
    const interval = setInterval(() => {
      setActiveRoom((prev) => {
        if (!prev || prev.isSyncedRoom) return prev;
        const ordered = [...prev.members].sort(
          (a, b) => b.mapPosition.routeProgress - a.mapPosition.routeProgress
        );
        const tailId = ordered[ordered.length - 1]?.id;
        const useRealSelfGps = gps.status === 'active' && !isOffRouteSimActive;

        const moved = prev.members.map((member, idx) => {
          if (member.isCurrentUser && useRealSelfGps) {
            return member;
          }
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
    activeRoom?.isSyncedRoom,
    routeConfig,
    isOffRouteSimActive,
    isStragglerSimActive,
    gps.status,
  ]);

  const isSessionAuthenticated = Boolean(authUser || localUserName);
  const isAdminUser = isAdminEmailAddress(
    authUser?.email || vehicleProfile.email || localUserEmail
  );
  const navSteps = isAdminUser
    ? [...ROUTE_STEPS, { route: 'admin_backend' as ScreenRoute, label: '6. Admin Backend' }]
    : ROUTE_STEPS;

  const navigateTo = (next: ScreenRoute, direction: 1 | -1 = 1) => {
    if (
      !isSessionAuthenticated &&
      next !== 'login' &&
      next !== 'about_app'
    ) {
      setAuthError('Silakan masuk terlebih dahulu sebelum menggunakan aplikasi.');
      setNavDirection(-1);
      setCurrentRoute('login');
      return;
    }
    setNavDirection(direction);
    setCurrentRoute(next);
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    setAuthInfoMessage(null);
    try {
      await signInWithGoogle();
      setLocalUserName(null);
      saveLocalSession(null);
      setNavDirection(1);
      setCurrentRoute('role_selection');
    } catch (err) {
      console.error('Login Google gagal:', err);
      setAuthError(mapFirebaseAuthError(err, 'Google'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleFacebookSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    setAuthInfoMessage(null);
    try {
      await signInWithFacebook();
      setLocalUserName(null);
      saveLocalSession(null);
      setNavDirection(1);
      setCurrentRoute('role_selection');
    } catch (err) {
      console.error('Login Facebook gagal:', err);
      setAuthError(mapFirebaseAuthError(err, 'Facebook'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleInstagramSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    setAuthInfoMessage(null);
    try {
      const res = await fetch('/api/auth/instagram/url');
      if (!res.ok) {
        throw new Error('Gagal menghubungi server OAuth Instagram.');
      }
      const data = (await res.json()) as {
        configured?: boolean;
        url?: string;
        redirectUri?: string;
        message?: string;
      };

      if (!data.configured || !data.url) {
        setIsSigningIn(false);
        setAuthError(
          `Instagram OAuth belum aktif (${data.message || 'INSTAGRAM_CLIENT_ID belum diatur'}). Callback URI: ${data.redirectUri || `${window.location.origin}/auth/callback`}`
        );
        return;
      }

      const authWindow = window.open(
        data.url,
        'instagram_oauth_popup',
        'width=540,height=680'
      );
      if (!authWindow) {
        setIsSigningIn(false);
        setAuthError(
          'Popup Instagram diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.'
        );
      }
    } catch (err) {
      setIsSigningIn(false);
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Gagal membuka otorisasi Instagram.'
      );
    }
  };

  const handleEmailAuth = async (params: {
    mode: 'signin' | 'signup';
    fullName: string;
    email: string;
    password: string;
  }) => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    setAuthInfoMessage(null);
    const normEmail = normalizeProfileEmail(params.email);

    try {
      const user =
        params.mode === 'signup'
          ? await signUpWithEmail(params.fullName, normEmail, params.password)
          : await signInWithEmail(normEmail, params.password);

      setLocalUserName(null);
      saveLocalSession(null);

      if (params.mode === 'signup') {
        const seedProfile: VehicleProfile = {
          ...INITIAL_PROFILE,
          fullName: params.fullName.trim() || user.displayName || 'Rider KonvoiKu',
          email: normEmail,
          authProvider: 'email',
        };
        setVehicleProfile(seedProfile);
        saveProfileByEmail(normEmail, seedProfile);
        await saveUserPrivateProfile(user.uid, seedProfile).catch(() => {});
        setCustomizeReturnRoute('role_selection');
        setNavDirection(1);
        setCurrentRoute('customize_profile');
      } else {
        setNavDirection(1);
        setCurrentRoute('role_selection');
      }
    } catch (err) {
      console.error('Email auth gagal:', err);
      setAuthError(mapFirebaseAuthError(err, 'Email'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    setAuthError(null);
    setAuthInfoMessage(null);
    try {
      await sendResetPasswordEmail(email);
      setAuthInfoMessage(
        `Tautan atur ulang kata sandi telah dikirim ke ${email.trim()}.`
      );
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Reset Sandi'));
    }
  };

  const handleLocalLogin = (fullName: string, email: string) => {
    const cleanName = fullName.trim();
    const normEmail = normalizeProfileEmail(email);
    if (!cleanName) return;

    setAuthError(null);
    setAuthInfoMessage(null);
    setAuthProvider('local');
    setLocalUserName(cleanName);
    setLocalUserEmail(normEmail);

    const existingEmailProfile = normEmail ? loadProfileByEmail(normEmail) : null;
    const nextProfile: VehicleProfile = existingEmailProfile
      ? {
          ...existingEmailProfile,
          fullName: existingEmailProfile.fullName || cleanName,
          email: normEmail,
          authProvider: 'local',
        }
      : {
          ...vehicleProfile,
          fullName: cleanName,
          email: normEmail,
          authProvider: 'local',
        };

    setVehicleProfile(nextProfile);
    if (normEmail) {
      saveProfileByEmail(normEmail, nextProfile);
    }
    saveLocalSession({
      fullName: nextProfile.fullName,
      email: normEmail,
      authProvider: 'local',
    });
    setNavDirection(1);
    setCurrentRoute('role_selection');
  };

  const handleGoogleSignOut = async () => {
    try {
      if (authUser) {
        await signOutFirebase();
      }
      setLocalUserName(null);
      setLocalUserEmail('');
      setAuthProvider('local');
      saveLocalSession(null);
      setAuthError(null);
      setAuthInfoMessage(null);
      setProfileSyncMessage(null);
      setActiveRoom(null);
      setNavDirection(-1);
      setCurrentRoute('login');
    } catch (err) {
      console.error('Logout gagal:', err);
    }
  };

  const handleSaveCustomizedProfile = async (nextProfile: VehicleProfile) => {
    setIsSavingProfile(true);
    setProfileSyncMessage(null);
    const normEmail = normalizeProfileEmail(
      nextProfile.email || authUser?.email || localUserEmail
    );
    const enrichedProfile: VehicleProfile = {
      ...nextProfile,
      email: normEmail,
      authProvider: nextProfile.authProvider || authProvider,
    };

    setVehicleProfile(enrichedProfile);
    if (normEmail) {
      setLocalUserEmail(normEmail);
      saveProfileByEmail(normEmail, enrichedProfile);
    }
    if (!authUser && localUserName) {
      setLocalUserName(enrichedProfile.fullName);
      saveLocalSession({
        fullName: enrichedProfile.fullName,
        email: normEmail,
        authProvider,
        instagramHandle: enrichedProfile.instagramHandle,
      });
    }

    // Update current user card inside active room if already riding
    setActiveRoom((prev) =>
      prev
        ? {
            ...prev,
            members: prev.members.map((m) =>
              m.isCurrentUser
                ? {
                    ...m,
                    fullName: enrichedProfile.fullName || m.fullName,
                    vehicleType: enrichedProfile.vehicleType,
                    vehicleDetail:
                      enrichedProfile.vehicleDetail || m.vehicleDetail,
                    licensePlate: enrichedProfile.licensePlate || m.licensePlate,
                    emergencyContact:
                      enrichedProfile.emergencyContact || m.emergencyContact,
                    avatarPreset: enrichedProfile.avatarPreset,
                    avatarPhotoUrl: enrichedProfile.avatarPhotoUrl,
                  }
                : m
            ),
          }
        : prev
    );

    try {
      if (authUser) {
        await saveUserPrivateProfile(authUser.uid, enrichedProfile);
      }
      setProfileSyncMessage(
        normEmail
          ? `Tersimpan & tersinkronisasi dengan ${normEmail}`
          : 'Profil berhasil disimpan.'
      );
    } catch (err) {
      console.warn('Gagal sinkronisasi ke Firestore:', err);
      setProfileSyncMessage(
        'Profil tersimpan lokal di perangkat. Pastikan Firestore & koneksi aktif untuk sinkronisasi cloud.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const ensureDemoRoom = (roleForFallback: UserRole) => {
    if (activeRoom) return;
    const roomId = 'KNV-8492';
    const initialLat = gps.lastFix?.latitude ?? routeConfig.waypoints[0]?.latitude ?? -6.655;
    const initialLng = gps.lastFix?.longitude ?? routeConfig.waypoints[0]?.longitude ?? 106.86;
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
      lastLocationText: gps.lastFix ? 'GPS Live' : 'Jalur Puncak KM 45',
      lastUpdatedLabel: 'Baru saja',
      routeDistanceMeters: 7000,
      offRouteMeters: 0,
      convoyOrderRank: 2,
      mapPosition: gps.lastFix
        ? {
            routeProgress: 0.25,
            xFraction: 0.4,
            yFraction: 0.6,
            latitude: initialLat,
            longitude: initialLng,
            speedKmh: gps.lastFix.speedKmh,
            heading: gps.lastFix.heading,
            accuracyMeters: gps.lastFix.accuracyMeters,
          }
        : interpolateAlongPolyline(0.58, routeConfig.waypoints, 0, 55),
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
      roomTitle: 'Konvoi Touring Akhir Pekan (Demo)',
      inviteLink: `https://konvoiku.id/join/${roomId}`,
      createdAtLabel: 'Aktif sekarang',
      isSyncedRoom: false,
      members: [selfMember, ...simulatedPeers],
    };
    setSelectedMemberId(selfMember.id);
    setMessages(createInitialMessages(roomId));
    commitRoomMembers(baseRoom.members, routeConfig, baseRoom);
  };

  const handleSelectRole = (role: UserRole) => {
    if (
      role === 'TOUR_LEADER' &&
      globalConfig.allowNewRooms === false &&
      !isVerifiedAdminSession(authUser)
    ) {
      setAuthError('Pembuatan room baru sedang dijeda sementara oleh Admin Backend.');
      return;
    }
    setSelectedRole(role);
    navigateTo('vehicle_profile', 1);
  };

  const handleUpdateProfile = (patch: Partial<VehicleProfile>) => {
    setVehicleProfile((prev) => {
      const next = { ...prev, ...patch };
      const normEmail = normalizeProfileEmail(
        next.email || authUser?.email || localUserEmail
      );
      if (normEmail) {
        saveProfileByEmail(normEmail, { ...next, email: normEmail });
      }
      if (authUser) {
        saveUserPrivateProfile(authUser.uid, {
          ...next,
          email: normEmail,
          authProvider: next.authProvider || authProvider,
        }).catch((err) =>
          console.warn('Gagal sinkronisasi profil ke Firestore:', err)
        );
      }
      return next;
    });
  };

  const handleCreateRoom = async (
    customTitle = 'Konvoi Touring Akhir Pekan',
    routeOverride?: ConvoyRouteConfig
  ) => {
    if (
      globalConfig.allowNewRooms === false &&
      !isVerifiedAdminSession(authUser)
    ) {
      setJoinError('Pembuatan room baru sedang dijeda oleh Admin Backend.');
      return;
    }
    const effectiveConfig = routeOverride ?? routeConfig;
    const roomId = generateUniqueRoomId();
    const title = customTitle.trim() || 'Konvoi Touring Akhir Pekan';
    const startLat = gps.lastFix?.latitude ?? effectiveConfig.waypoints[0]?.latitude ?? -6.648;
    const startLng = gps.lastFix?.longitude ?? effectiveConfig.waypoints[0]?.longitude ?? 106.845;

    // Cloud Synced Firestore Room if authenticated
    if (authUser) {
      setIsCreatingRoom(true);
      try {
        const dest = effectiveConfig.waypoints[effectiveConfig.waypoints.length - 1];
        const nextWaypoints: RoutePoint[] =
          gps.lastFix && dest
            ? buildPolylineToDestination(
                {
                  xFraction: 0.14,
                  yFraction: 0.86,
                  latitude: startLat,
                  longitude: startLng,
                },
                dest
              )
            : effectiveConfig.waypoints;

        const nextConfig: ConvoyRouteConfig = {
          ...effectiveConfig,
          waypoints: nextWaypoints,
        };

        await saveUserPrivateProfile(authUser.uid, vehicleProfile);
        await createSyncedRoom({
          roomId,
          roomTitle: title,
          leaderUid: authUser.uid,
          profile: vehicleProfile,
          routeConfig: nextConfig,
          initialLat: startLat,
          initialLng: startLng,
        });

        setRouteConfig(nextConfig);
        recordedTrackRef.current = gps.lastFix
          ? [{ lat: gps.lastFix.latitude, lng: gps.lastFix.longitude }]
          : [];
        setLastCompletedTrip(null);
        setIsOffRouteSimActive(false);
        setIsStragglerSimActive(false);
        const syncedRoom: TourRoom = {
          roomId,
          roomTitle: title,
          inviteLink: `https://konvoiku.id/join/${roomId}`,
          createdAtLabel: 'Sinkronisasi Cloud Aktif',
          isSyncedRoom: true,
          leaderUid: authUser.uid,
          members: [],
        };
        setSelectedMemberId(authUser.uid);
        setActiveRoom(syncedRoom);
        navigateTo('live_map', 1);
      } catch (err) {
        console.error('Gagal membuat synced room:', err);
      } finally {
        setIsCreatingRoom(false);
      }
      return;
    }

    // Offline Demo Room fallback
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
      lastLocationText: gps.lastFix ? 'GPS Live' : 'Puncak Pass KM 49',
      lastUpdatedLabel: 'Baru saja',
      routeDistanceMeters: 8880,
      offRouteMeters: 0,
      convoyOrderRank: 1,
      mapPosition: gps.lastFix
        ? {
            routeProgress: 0.2,
            xFraction: 0.3,
            yFraction: 0.7,
            latitude: startLat,
            longitude: startLng,
            speedKmh: gps.lastFix.speedKmh,
            heading: gps.lastFix.heading,
            accuracyMeters: gps.lastFix.accuracyMeters,
          }
        : interpolateAlongPolyline(0.74, effectiveConfig.waypoints, 0, 60),
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
        routeDistanceMeters: Math.round(tpl.baseProgress * effectiveConfig.totalRouteMeters),
        offRouteMeters: 0,
        convoyOrderRank: idx + 2,
        mapPosition: interpolateAlongPolyline(
          tpl.baseProgress,
          effectiveConfig.waypoints,
          0,
          tpl.baseSpeed
        ),
      })
    );

    setSimIndex(0);
    recordedTrackRef.current = gps.lastFix
      ? [{ lat: gps.lastFix.latitude, lng: gps.lastFix.longitude }]
      : [];
    setLastCompletedTrip(null);
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
      roomTitle: title,
      inviteLink: `https://konvoiku.id/join/${roomId}`,
      createdAtLabel: 'Mode Demo Offline',
      isSyncedRoom: false,
      members: [leader, ...peers],
    };
    setSelectedMemberId(leader.id);
    commitRoomMembers(room.members, effectiveConfig, room);
    navigateTo('live_map', 1);
  };

  const handleSimulateJoin = () => {
    if (!activeRoom || activeRoom.isSyncedRoom) return;
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
    if (activeRoom.isSyncedRoom && authUser) {
      removeSyncedMember(activeRoom.roomId, memberId).catch((err) =>
        console.warn('Gagal menghapus anggota:', err)
      );
      return;
    }
    commitRoomMembers(
      activeRoom.members.filter((m) => m.id !== memberId || m.isCurrentUser)
    );
  };

  const handleJoinSubmit = async () => {
    const code = extractRoomId(joinInput);
    if (code.length < 4) {
      setJoinError(
        'Masukkan Room ID yang valid (contoh: KNV-8492) atau tempel link undangan.'
      );
      return;
    }

    if (authUser) {
      setIsJoiningRoom(true);
      setJoinError(null);
      try {
        const initLat = gps.lastFix?.latitude ?? -6.65;
        const initLng = gps.lastFix?.longitude ?? 106.85;
        await saveUserPrivateProfile(authUser.uid, vehicleProfile);
        const res = await joinSyncedRoom({
          roomId: code,
          uid: authUser.uid,
          profile: vehicleProfile,
          initialLat: initLat,
          initialLng: initLng,
        });
        if (!res.ok) {
          setJoinError(res.error || 'Gagal bergabung ke room.');
          return;
        }
        setSelectedRole(res.role);
        setSelectedMemberId(authUser.uid);
        recordedTrackRef.current = gps.lastFix
          ? [{ lat: gps.lastFix.latitude, lng: gps.lastFix.longitude }]
          : [];
        setLastCompletedTrip(null);
        setActiveRoom({
          roomId: code,
          roomTitle: `Room ${code}`,
          inviteLink: `https://konvoiku.id/join/${code}`,
          createdAtLabel: 'Terhubung Cloud',
          isSyncedRoom: true,
          members: [],
        });
        navigateTo('live_map', 1);
      } catch (err) {
        setJoinError(
          err instanceof Error ? err.message : 'Gagal terhubung ke Firestore.'
        );
      } finally {
        setIsJoiningRoom(false);
      }
      return;
    }

    // Offline Demo join fallback
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
      lastLocationText: gps.lastFix ? 'GPS Live' : 'Jalur Puncak KM 45',
      lastUpdatedLabel: 'Baru saja',
      routeDistanceMeters: 6960,
      offRouteMeters: 0,
      convoyOrderRank: 3,
      mapPosition: gps.lastFix
        ? {
            routeProgress: 0.4,
            xFraction: 0.45,
            yFraction: 0.55,
            latitude: gps.lastFix.latitude,
            longitude: gps.lastFix.longitude,
            speedKmh: gps.lastFix.speedKmh,
            heading: gps.lastFix.heading,
            accuracyMeters: gps.lastFix.accuracyMeters,
          }
        : interpolateAlongPolyline(0.58, routeConfig.waypoints, 0, 54),
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
      roomTitle: `Konvoi Bersama ${code} (Demo)`,
      inviteLink: `https://konvoiku.id/join/${code}`,
      createdAtLabel: 'Terhubung Demo',
      isSyncedRoom: false,
      members: [hostLeader, selfMember, peer1, peer2],
    };
    setSelectedMemberId(selfMember.id);
    recordedTrackRef.current = gps.lastFix
      ? [{ lat: gps.lastFix.latitude, lng: gps.lastFix.longitude }]
      : [];
    setLastCompletedTrip(null);
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
    const lat = gps.lastFix?.latitude ?? self.mapPosition.latitude;
    const lng = gps.lastFix?.longitude ?? self.mapPosition.longitude;

    if (activeRoom.isSyncedRoom && authUser) {
      triggerSyncedSos(activeRoom.roomId, {
        uid: authUser.uid,
        fullName: self.fullName,
        vehicleDetail: self.vehicleDetail,
        latitude: lat,
        longitude: lng,
        locationText: self.lastLocationText,
        triggeredAtLabel: now,
      });
      sendRoomMessage(activeRoom.roomId, {
        id: `sos-${Date.now()}`,
        senderUid: authUser.uid,
        senderName: self.fullName,
        senderVehicle: self.vehicleDetail,
        senderAvatarPreset: self.avatarPreset,
        type: 'SOS_ALERT',
        textContent: `SINYAL DARURAT SOS di ${self.lastLocationText} (${lat.toFixed(4)}, ${lng.toFixed(4)}). Butuh bantuan segera!`,
      });
      return;
    }

    const updated = activeRoom.members.map((m) =>
      m.id === self.id ? { ...m, conditionStatus: 'SOS' as MemberConditionStatus } : m
    );
    setSosState({
      isActive: true,
      senderId: self.id,
      senderName: self.fullName,
      senderVehicle: self.vehicleDetail,
      latitude: lat,
      longitude: lng,
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
        textContent: `SINYAL DARURAT SOS di ${self.lastLocationText} (${lat.toFixed(4)}, ${lng.toFixed(4)}). Butuh bantuan segera!`,
        timestampLabel: now,
        isFromCurrentUser: true,
      },
    ]);
    commitRoomMembers(updated);
  };

  const handleResolveSos = () => {
    if (!activeRoom) return;
    const senderId = sosState.senderId;

    if (activeRoom.isSyncedRoom && authUser) {
      resolveSyncedSos(activeRoom.roomId, senderId);
      sendRoomMessage(activeRoom.roomId, {
        id: `sys-${Date.now()}`,
        senderUid: authUser.uid,
        senderName: 'Sistem Konvoi',
        senderVehicle: '',
        senderAvatarPreset: 'RIDER_CAPTAIN',
        type: 'SYSTEM',
        textContent: 'Sinyal darurat SOS telah diselesaikan.',
      });
      return;
    }

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
    if (!activeRoom || !text.trim()) return;
    const self = activeRoom.members.find((m) => m.isCurrentUser);
    if (activeRoom.isSyncedRoom && authUser) {
      sendRoomMessage(activeRoom.roomId, {
        id: `txt-${Date.now()}`,
        senderUid: authUser.uid,
        senderName: self?.fullName ?? vehicleProfile.fullName ?? 'Rider',
        senderVehicle: self?.vehicleDetail ?? vehicleProfile.vehicleDetail ?? 'Kendaraan',
        senderAvatarPreset: self?.avatarPreset ?? vehicleProfile.avatarPreset,
        type: 'TEXT',
        textContent: text.trim(),
      });
      return;
    }
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

    if (activeRoom?.isSyncedRoom && authUser) {
      sendRoomMessage(activeRoom.roomId, {
        id: `voice-${Date.now()}`,
        senderUid: authUser.uid,
        senderName: self?.fullName ?? vehicleProfile.fullName ?? 'Rider',
        senderVehicle: self?.vehicleDetail ?? vehicleProfile.vehicleDetail ?? 'Kendaraan',
        senderAvatarPreset: self?.avatarPreset ?? vehicleProfile.avatarPreset,
        type: 'VOICE',
        textContent: `Pesan Suara PTT (${dur} detik)`,
        voiceDurationSec: dur,
      });
      return;
    }

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

    const labelMap: Record<MemberConditionStatus, string> = {
      AMAN: 'Aman',
      ISTIRAHAT: 'Istirahat / Rest Area',
      MOGOK: 'Kendaraan Mogok',
      SOS: 'Darurat SOS',
    };

    if (activeRoom.isSyncedRoom && authUser) {
      updateSyncedMemberCondition(activeRoom.roomId, authUser.uid, status);
      sendRoomMessage(activeRoom.roomId, {
        id: `cond-${Date.now()}`,
        senderUid: authUser.uid,
        senderName: self.fullName,
        senderVehicle: self.vehicleDetail,
        senderAvatarPreset: self.avatarPreset,
        type: 'SYSTEM',
        textContent: `${self.fullName} memperbarui status: ${labelMap[status]}`,
      });
      return;
    }

    const updated = activeRoom.members.map((m) =>
      m.isCurrentUser ? { ...m, conditionStatus: status } : m
    );
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

    if (activeRoom.isSyncedRoom && authUser) {
      assignSyncedSweeper(
        activeRoom.roomId,
        memberId,
        activeRoom.members.map((m) => m.id)
      );
      sendRoomMessage(activeRoom.roomId, {
        id: `swp-${Date.now()}`,
        senderUid: authUser.uid,
        senderName: 'Tour Leader',
        senderVehicle: '',
        senderAvatarPreset: 'RIDER_CAPTAIN',
        type: 'SYSTEM',
        textContent: `${target.fullName} (${target.vehicleDetail}) ditetapkan sebagai Sweeper penutup barisan.`,
      });
      return;
    }

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

  // --- Route & Checkpoint Handlers ---
  const syncMembersToRoute = (nextConfig: ConvoyRouteConfig) => {
    if (!activeRoom) return;
    if (activeRoom.isSyncedRoom) {
      commitRoomMembers(activeRoom.members, nextConfig);
      return;
    }
    const synced = activeRoom.members.map((member) => {
      if (member.isCurrentUser && gps.status === 'active') {
        return member;
      }
      return {
        ...member,
        mapPosition: interpolateAlongPolyline(
          member.mapPosition.routeProgress,
          nextConfig.waypoints,
          member.isCurrentUser && isOffRouteSimActive ? 0.12 : 0,
          member.mapPosition.speedKmh
        ),
      };
    });
    commitRoomMembers(synced, nextConfig);
  };

  const handleSelectPreset = (preset: DestinationPreset) => {
    const startPt: RoutePoint = gps.lastFix
      ? {
          xFraction: 0.14,
          yFraction: 0.86,
          latitude: gps.lastFix.latitude,
          longitude: gps.lastFix.longitude,
        }
      : routeConfig.waypoints[0] ?? {
          xFraction: 0.14,
          yFraction: 0.86,
          latitude: -6.648,
          longitude: 106.845,
        };
    const coordStr = `${preset.endPoint.latitude.toFixed(4)}, ${preset.endPoint.longitude.toFixed(4)}`;
    const nextConfig: ConvoyRouteConfig = {
      ...routeConfig,
      destinationName: preset.name,
      destinationAddress: `${preset.name} · ${coordStr}`,
      waypoints: buildPolylineToDestination(startPt, preset.endPoint),
      totalRouteMeters: preset.totalMeters,
    };
    setRouteConfig(nextConfig);
    setIsPickingDestinationOnMap(false);
    syncMembersToRoute(nextConfig);
    if (activeRoom?.isSyncedRoom && authUser && activeRoom.leaderUid === authUser.uid) {
      updateSyncedRoomRoute(activeRoom.roomId, nextConfig);
    }
  };

  const handlePickDestinationLatLng = (
    lat: number,
    lng: number,
    placeName?: string,
    addressLabel?: string
  ) => {
    const startPt: RoutePoint = gps.lastFix
      ? {
          xFraction: 0.14,
          yFraction: 0.86,
          latitude: gps.lastFix.latitude,
          longitude: gps.lastFix.longitude,
        }
      : routeConfig.waypoints[0] ?? {
          xFraction: 0.14,
          yFraction: 0.86,
          latitude: -6.648,
          longitude: 106.845,
        };
    const endPoint: RoutePoint = {
      xFraction: 0.86,
      yFraction: 0.14,
      latitude: lat,
      longitude: lng,
    };
    const waypoints = buildPolylineToDestination(startPt, endPoint);
    const estMeters = Math.max(
      500,
      Math.round(
        haversineMeters(
          { lat: startPt.latitude, lng: startPt.longitude },
          { lat, lng }
        ) * 1.25
      )
    );
    const resolvedName =
      placeName?.trim() || `Titik Tujuan (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    const resolvedAddress =
      addressLabel?.trim() || `${resolvedName} · ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    const nextConfig: ConvoyRouteConfig = {
      ...routeConfig,
      destinationName: resolvedName,
      destinationAddress: resolvedAddress,
      waypoints,
      totalRouteMeters: estMeters,
    };
    setRouteConfig(nextConfig);
    setIsPickingDestinationOnMap(false);
    syncMembersToRoute(nextConfig);
    if (activeRoom?.isSyncedRoom && authUser && activeRoom.leaderUid === authUser.uid) {
      updateSyncedRoomRoute(activeRoom.roomId, nextConfig);
    }
  };

  const handleRouteComputed = useCallback(
    (distanceMeters: number, durationMillis: number, path: LatLngPoint[]) => {
      if (path.length < 2 || distanceMeters <= 0) return;
      const sampled = downsampleRoutePoints(path, 60);
      const currentCfg = routeConfigRef.current;
      const distDiff = Math.abs(currentCfg.totalRouteMeters - distanceMeters);
      const sig = `${currentCfg.destinationName}|${Math.round(distanceMeters / 50)}|${sampled.length}`;
      if (sig === lastSyncedRouteSigRef.current && distDiff < 80) return;

      lastSyncedRouteSigRef.current = sig;
      const nextConfig: ConvoyRouteConfig = {
        ...currentCfg,
        waypoints: sampled,
        totalRouteMeters: distanceMeters,
        estimatedDurationMillis:
          durationMillis > 0 ? durationMillis : currentCfg.estimatedDurationMillis,
      };
      setRouteConfig(nextConfig);

      const room = activeRoomRef.current;
      const user = authUserRef.current;
      if (room) {
        const evaluated = evaluateRoomSafety(room.members, nextConfig);
        setOffRouteAlert(evaluated.offRouteAlert);
        setStragglerAlert(evaluated.stragglerAlert);
        setActiveRoom((prev) =>
          prev ? { ...prev, members: evaluated.members } : prev
        );
        if (room.isSyncedRoom && user && room.leaderUid === user.uid) {
          updateSyncedRoomRoute(room.roomId, nextConfig).catch(() => {});
        }
      }
    },
    []
  );

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

  const handleConfirmAddCheckpointLatLng = (
    name: string,
    lat: number,
    lng: number
  ) => {
    const finalName = name.trim() || 'Rest Area Konvoi';
    const newCheckpoint: RestCheckpoint = {
      id: `cp-${Date.now()}`,
      name: finalName,
      xFraction: 0.5,
      yFraction: 0.5,
      latitude: lat,
      longitude: lng,
    };
    setRouteConfig((prev) => ({
      ...prev,
      checkpoints: [...prev.checkpoints, newCheckpoint],
    }));
    setIsPickingCheckpointOnMap(false);
    setPendingCheckpointName('');

    if (activeRoom?.isSyncedRoom && authUser) {
      addRoomCheckpoint(activeRoom.roomId, authUser.uid, newCheckpoint);
      sendRoomMessage(activeRoom.roomId, {
        id: `cp-msg-${Date.now()}`,
        senderUid: authUser.uid,
        senderName: 'Tour Leader',
        senderVehicle: '',
        senderAvatarPreset: 'RIDER_CAPTAIN',
        type: 'SYSTEM',
        textContent: `Titik istirahat baru dibagikan ke seluruh rombongan: ${finalName}.`,
      });
      return;
    }

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

  const handleAddCheckpointFromStepper = (
    name: string,
    xFraction: number,
    yFraction: number
  ) => {
    const wps = routeConfig.waypoints;
    const start = wps[0] ?? { latitude: -6.648, longitude: 106.845 };
    const end = wps[wps.length - 1] ?? { latitude: -6.7003, longitude: 106.996 };
    const factor = Math.max(0.1, Math.min(0.9, xFraction));
    const lat = start.latitude + (end.latitude - start.latitude) * factor;
    const lng = start.longitude + (end.longitude - start.longitude) * factor;
    const cp: RestCheckpoint = {
      id: `cp-${Date.now()}`,
      name: name.trim() || 'Rest Area Konvoi',
      xFraction: factor,
      yFraction,
      latitude: lat,
      longitude: lng,
    };
    setRouteConfig((prev) => ({
      ...prev,
      checkpoints: [...prev.checkpoints, cp],
    }));
    if (activeRoom?.isSyncedRoom && authUser) {
      addRoomCheckpoint(activeRoom.roomId, authUser.uid, cp);
    }
  };

  const handleRemoveCheckpoint = (checkpointId: string) => {
    setRouteConfig((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.filter((cp) => cp.id !== checkpointId),
    }));
    if (activeRoom?.isSyncedRoom && authUser) {
      removeRoomCheckpoint(activeRoom.roomId, checkpointId);
    }
  };

  const handleUpdateWaypoints = (nextWaypoints: RoutePoint[]) => {
    if (nextWaypoints.length < 2) return;
    const nextConfig: ConvoyRouteConfig = {
      ...routeConfig,
      waypoints: nextWaypoints,
    };
    setRouteConfig(nextConfig);
    syncMembersToRoute(nextConfig);
    if (activeRoom?.isSyncedRoom && authUser && activeRoom.leaderUid === authUser.uid) {
      updateSyncedRoomRoute(activeRoom.roomId, nextConfig);
    }
  };

  const handleResetDefaultWaypoints = () => {
    const nextConfig: ConvoyRouteConfig = {
      ...routeConfig,
      waypoints: INITIAL_ROUTE_CONFIG.waypoints,
    };
    setRouteConfig(nextConfig);
    syncMembersToRoute(nextConfig);
    if (activeRoom?.isSyncedRoom && authUser && activeRoom.leaderUid === authUser.uid) {
      updateSyncedRoomRoute(activeRoom.roomId, nextConfig);
    }
  };

  const handleUpdateMaxStraggler = (meters: number) => {
    const nextConfig = { ...routeConfig, maxStragglerDistanceMeters: meters };
    setRouteConfig(nextConfig);
    if (activeRoom) commitRoomMembers(activeRoom.members, nextConfig);
    if (activeRoom?.isSyncedRoom && authUser && activeRoom.leaderUid === authUser.uid) {
      updateSyncedRoomRoute(activeRoom.roomId, nextConfig);
    }
  };

  const handleUpdateOffRouteTolerance = (meters: number) => {
    const nextConfig = { ...routeConfig, offRouteToleranceMeters: meters };
    setRouteConfig(nextConfig);
    if (activeRoom) commitRoomMembers(activeRoom.members, nextConfig);
    if (activeRoom?.isSyncedRoom && authUser && activeRoom.leaderUid === authUser.uid) {
      updateSyncedRoomRoute(activeRoom.roomId, nextConfig);
    }
  };

  const handleToggleSoundAlert = () => {
    const nextConfig = {
      ...routeConfig,
      soundAlertEnabled: !routeConfig.soundAlertEnabled,
    };
    setRouteConfig(nextConfig);
    if (activeRoom?.isSyncedRoom && authUser && activeRoom.leaderUid === authUser.uid) {
      updateSyncedRoomRoute(activeRoom.roomId, nextConfig);
    }
  };

  const handleToggleOffRouteSim = () => {
    if (activeRoom?.isSyncedRoom) return;
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
    if (activeRoom?.isSyncedRoom) return;
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

    const rawTrack = recordedTrackRef.current;
    const rawTrackMeters = computePolylineLengthMeters(rawTrack);
    const hasRealRecordedGpsTrack = rawTrack.length >= 2 && rawTrackMeters >= 50;

    const finalWaypoints: RoutePoint[] = hasRealRecordedGpsTrack
      ? downsampleRoutePoints(downsampleTrackPoints(rawTrack, 15, 120), 120)
      : routeConfig.waypoints;

    const realDistanceMeters = hasRealRecordedGpsTrack
      ? rawTrackMeters
      : routeConfig.totalRouteMeters;

    const distanceKm = Math.max(
      0.1,
      Number((realDistanceMeters / 1000).toFixed(1))
    );
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
      waypoints: finalWaypoints,
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

    if (activeRoom.isSyncedRoom && authUser) {
      if (activeRoom.leaderUid === authUser.uid) {
        finishSyncedRoom(activeRoom.roomId).catch(() => {});
      }
      saveTripRecordToFirestore(authUser.uid, newRecord).catch((err) =>
        console.warn('Gagal menyimpan riwayat ke Firestore:', err)
      );
    }

    recordedTrackRef.current = [];
    setTripHistory((prev) => [newRecord, ...prev]);
    setSelectedTripId(newRecord.id);
    setLastCompletedTrip(newRecord);
    setActiveRoom(null);
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
    navigateTo('trip_detail', 1);
  };

  const handleRepeatTour = async (trip: TripHistoryRecord) => {
    const restoredWaypoints =
      trip.waypoints.length >= 2 ? trip.waypoints : routeConfig.waypoints;
    const restoredCheckpoints: RestCheckpoint[] = trip.visitedCheckpoints.map(
      (cp, idx) => ({
        id: cp.id || `cp-repeat-${Date.now()}-${idx}`,
        name: cp.name,
        xFraction: cp.xFraction,
        yFraction: cp.yFraction,
        latitude: cp.latitude,
        longitude: cp.longitude,
      })
    );
    const restoredConfig: ConvoyRouteConfig = {
      ...routeConfig,
      destinationName: trip.destinationName || routeConfig.destinationName,
      destinationAddress:
        trip.destinationAddress || routeConfig.destinationAddress,
      waypoints: restoredWaypoints,
      checkpoints: restoredCheckpoints,
      totalRouteMeters: Math.max(1000, Math.round(trip.distanceKm * 1000)),
    };
    setSelectedRole('TOUR_LEADER');
    setRouteConfig(restoredConfig);
    setLastCompletedTrip(null);
    await handleCreateRoom(
      trip.tourTitle || 'Konvoi Touring Akhir Pekan',
      restoredConfig
    );
  };

  const handleResetDemo = () => {
    recordedTrackRef.current = [];
    setSelectedRole('TOUR_LEADER');
    setVehicleProfile(INITIAL_PROFILE);
    setActiveRoom(null);
    setLastCompletedTrip(null);
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
    setAuthError(null);
    setNavDirection(-1);
    setCurrentRoute(authUser || localUserName ? 'role_selection' : 'login');
  };

  const handleMobileGoogleBridgeAuth = async () => {
    if (mobileBridgeBusy) return;
    setMobileBridgeBusy(true);
    setMobileBridgeError(null);
    setMobileBridgeDeepLink(null);
    try {
      const { user, idToken } = await signInWithGoogleForMobileBridge();
      if (!idToken) {
        setMobileBridgeError(
          'Token verifikasi Google tidak ditemukan. Silakan ulangi masuk dengan Google.'
        );
        return;
      }
      const deepLink = `konvoiku://auth?id_token=${encodeURIComponent(idToken)}`;
      setMobileBridgeEmail(user.email || '');
      setMobileBridgeDeepLink(deepLink);
      window.location.href = deepLink;
    } catch (err) {
      setMobileBridgeError(mapFirebaseAuthError(err, 'Google'));
    } finally {
      setMobileBridgeBusy(false);
    }
  };

  if (isMobileGoogleBridge) {
    return (
      <div className="min-h-screen bg-[#F1F5FA] dark:bg-[#0A0F16] text-[#0F172A] dark:text-[#F1F5F9] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] shadow-xl p-6 space-y-5">
          <div className="space-y-1.5">
            <span className="inline-block px-2.5 py-1 rounded-md bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#1D4ED8] dark:text-[#93C5FD] text-xs font-semibold">
              KonvoiKu Android Sync
            </span>
            <h1 className="text-xl font-bold tracking-tight">
              Sinkronisasi Akun Google ke APK
            </h1>
            <p className="text-sm text-[#475569] dark:text-[#94A3B8]">
              Masuk dengan akun Google Anda (termasuk akun Admin{' '}
              <span className="font-semibold text-[#0F172A] dark:text-white">
                ekie.ray@gmail.com
              </span>
              ) agar profil &amp; Admin Backend langsung aktif di aplikasi Android.
            </p>
          </div>

          {mobileBridgeError && (
            <div className="rounded-xl bg-[#FEF2F2] dark:bg-[#450A0A]/40 border border-[#FECACA] dark:border-[#991B1B] px-3.5 py-2.5 text-xs text-[#B91C1C] dark:text-[#FCA5A5]">
              {mobileBridgeError}
            </div>
          )}

          {mobileBridgeDeepLink ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 border border-[#A7F3D0] dark:border-[#047857] px-3.5 py-3 text-xs text-[#065F46] dark:text-[#A7F3D0]">
                Login Google berhasil ({mobileBridgeEmail || 'terverifikasi'}). Jika aplikasi Android belum terbuka otomatis, ketuk tombol di bawah.
              </div>
              <a
                href={mobileBridgeDeepLink}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold text-sm flex items-center justify-center transition-colors"
              >
                Buka Aplikasi KonvoiKu
              </a>
            </div>
          ) : (
            <button
              type="button"
              disabled={mobileBridgeBusy}
              onClick={handleMobileGoogleBridgeAuth}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {mobileBridgeBusy ? 'Membuka Google...' : 'Masuk dengan Akun Google'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#F1F5FA] dark:bg-[#0A0F16] text-[#0F172A] dark:text-[#F1F5F9] flex flex-col transition-colors">
      {/* TomTom Trial Quota Banner */}
      {mapsQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 w-full bg-[#B91C1C] text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-md"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-center">
            Kuota harian TomTom API Trial telah tercapai. Peta tetap menampilkan jalur dasar, atau perbarui ke TomTom API berbayar.
          </p>
        </div>
      )}

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
            {navSteps.map((step) => {
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
              KonvoiKu — GPS Live, Sinkronisasi Room & TomTom Maps Real-Time
            </h1>
            <p className="mt-1 text-sm text-[#475569] dark:text-[#94A3B8]">
              Material Design 3 · Live Device GPS · Cloud Room Sync · TomTom Maps & Routing API · PTT & SOS
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
              {navSteps.map((step) => {
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
                <span className="tabular-nums">
                  {gps.status === 'active' ? 'GPS · 5G' : '5G · 98%'}
                </span>
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
                    {currentRoute === 'login' && (
                      <LoginView
                        authUserEmail={authUser?.email ?? (localUserEmail || null)}
                        authUserName={
                          vehicleProfile.fullName || authUser?.displayName || null
                        }
                        authProvider={authProvider}
                        localUserName={localUserName}
                        isSigningIn={isSigningIn}
                        authError={authError}
                        authInfoMessage={authInfoMessage}
                        initialName={vehicleProfile.fullName}
                        initialEmail={vehicleProfile.email || localUserEmail}
                        globalConfig={globalConfig}
                        onGoogleSignIn={handleGoogleSignIn}
                        onFacebookSignIn={handleFacebookSignIn}
                        onInstagramSignIn={handleInstagramSignIn}
                        onEmailAuth={handleEmailAuth}
                        onForgotPassword={handleForgotPassword}
                        onLocalLogin={handleLocalLogin}
                        onContinueSession={() => navigateTo('role_selection', 1)}
                        onOpenCustomizeProfile={() => {
                          setCustomizeReturnRoute('login');
                          setProfileSyncMessage(null);
                          navigateTo('customize_profile', 1);
                        }}
                        onOpenAboutApp={() => {
                          setAboutReturnRoute('login');
                          navigateTo('about_app', 1);
                        }}
                      />
                    )}

                    {currentRoute === 'role_selection' && (
                      <RoleSelectionView
                        activeRoom={activeRoom}
                        lastCompletedTrip={lastCompletedTrip ?? tripHistory[0] ?? null}
                        destinationName={routeConfig.destinationName}
                        tripHistoryCount={tripHistory.length}
                        latestTripTitle={tripHistory[0]?.tourTitle}
                        authUserEmail={authUser?.email ?? (localUserEmail || null)}
                        authUserName={authUser?.displayName ?? null}
                        authProvider={authProvider}
                        userProfile={vehicleProfile}
                        localUserName={localUserName}
                        isSigningIn={isSigningIn}
                        globalConfig={globalConfig}
                        isAdminUser={isAdminUser}
                        onGoogleSignIn={handleGoogleSignIn}
                        onGoogleSignOut={handleGoogleSignOut}
                        onOpenCustomizeProfile={() => {
                          setCustomizeReturnRoute('role_selection');
                          setProfileSyncMessage(null);
                          navigateTo('customize_profile', 1);
                        }}
                        onOpenAdminBackend={() => navigateTo('admin_backend', 1)}
                        onSelectRole={handleSelectRole}
                        onResumeCurrentConvoy={() => {
                          if (activeRoom) {
                            navigateTo('live_map', 1);
                          }
                        }}
                        onRepeatTour={handleRepeatTour}
                        onOpenTripHistory={() => navigateTo('trip_history', 1)}
                        onOpenAboutApp={() => {
                          setAboutReturnRoute('role_selection');
                          navigateTo('about_app', 1);
                        }}
                      />
                    )}

                    {currentRoute === 'admin_backend' && (
                      <AdminBackendView
                        authUser={authUser}
                        globalConfig={globalConfig}
                        isSigningIn={isSigningIn}
                        onGoogleSignIn={handleGoogleSignIn}
                        onBack={() => navigateTo('role_selection', -1)}
                      />
                    )}

                    {currentRoute === 'customize_profile' && (
                      <CustomizeProfileView
                        profile={vehicleProfile}
                        authProvider={authProvider}
                        isCloudAuthenticated={Boolean(authUser)}
                        isSavingProfile={isSavingProfile}
                        syncStatusMessage={profileSyncMessage}
                        onSaveAndSyncProfile={handleSaveCustomizedProfile}
                        onBack={() => navigateTo(customizeReturnRoute, -1)}
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
                        isAuthenticated={Boolean(authUser)}
                        isCreatingRoom={isCreatingRoom}
                        userGpsLocation={
                          gps.lastFix
                            ? {
                                lat: gps.lastFix.latitude,
                                lng: gps.lastFix.longitude,
                              }
                            : null
                        }
                        darkMode={darkMode}
                        onGoogleSignIn={handleGoogleSignIn}
                        onSelectPreset={handleSelectPreset}
                        onPickDestinationLatLng={handlePickDestinationLatLng}
                        onUpdateWaypoints={handleUpdateWaypoints}
                        onResetDefaultWaypoints={handleResetDefaultWaypoints}
                        onAddCheckpoint={handleAddCheckpointFromStepper}
                        onRemoveCheckpoint={handleRemoveCheckpoint}
                        onUpdateMaxStragglerDistance={handleUpdateMaxStraggler}
                        onToggleSoundAlert={handleToggleSoundAlert}
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
                        isAuthenticated={Boolean(authUser)}
                        isJoining={isJoiningRoom}
                        onGoogleSignIn={handleGoogleSignIn}
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
                        darkMode={darkMode}
                        gpsStatus={gps.status}
                        gpsAccuracyMeters={gps.lastFix?.accuracyMeters}
                        gpsErrorMessage={gps.errorMessage}
                        onRetryGps={gps.retryGps}
                        onRouteComputed={handleRouteComputed}
                        onSelectMember={setSelectedMemberId}
                        onToggleSimulation={() =>
                          setIsSimulationRunning((prev) => !prev)
                        }
                        onSelectPreset={handleSelectPreset}
                        onPickDestinationLatLng={handlePickDestinationLatLng}
                        onTogglePickMode={(enabled) => {
                          if (enabled) {
                            setIsPickingCheckpointOnMap(false);
                            setPendingCheckpointName('');
                          }
                          setIsPickingDestinationOnMap(enabled);
                        }}
                        onStartPickCheckpoint={handleStartPickCheckpoint}
                        onCancelPickCheckpoint={handleCancelPickCheckpoint}
                        onConfirmAddCheckpointLatLng={handleConfirmAddCheckpointLatLng}
                        onRemoveCheckpoint={handleRemoveCheckpoint}
                        onUpdateMaxStragglerDistance={handleUpdateMaxStraggler}
                        onUpdateOffRouteTolerance={handleUpdateOffRouteTolerance}
                        onToggleSoundAlert={handleToggleSoundAlert}
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
