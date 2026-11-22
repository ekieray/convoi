import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  AdminRoomOverview,
  AdminUserSummary,
  AuthProviderId,
  AvatarPreset,
  ChatMessageType,
  ConnectionStatus,
  ConvoyMember,
  ConvoyRouteConfig,
  GlobalAppConfig,
  MemberConditionStatus,
  RestCheckpoint,
  RoomMessage,
  RouteInstruction,
  RoutePoint,
  RoutePreference,
  SosEmergencyState,
  TourRoom,
  TripHistoryRecord,
  UserPresenceRecord,
  UserRole,
  VehicleProfile,
  VehicleType,
} from '../types/convoy';
import {
  compactInstructionsForSync,
  decodePolyline,
  downsampleRoutePoints,
  encodePolyline,
} from '../utils/geo';

const EMAIL_PROFILE_PREFIX = 'konvoiku_email_profile_v1:';
const ACTIVE_SESSION_KEY = 'konvoiku_active_session_v1';

export interface StoredLocalSession {
  fullName: string;
  email: string;
  authProvider: AuthProviderId;
  instagramHandle?: string;
}

export function normalizeProfileEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function saveProfileByEmail(
  email: string | undefined | null,
  profile: VehicleProfile
): void {
  const norm = normalizeProfileEmail(email || profile.email);
  if (!norm || typeof window === 'undefined') return;
  try {
    const payload: VehicleProfile = {
      ...profile,
      email: norm,
      avatarPhotoUrl:
        profile.avatarPhotoUrl && profile.avatarPhotoUrl.length <= 120000
          ? profile.avatarPhotoUrl
          : undefined,
    };
    window.localStorage.setItem(
      `${EMAIL_PROFILE_PREFIX}${norm}`,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore quota errors on localStorage
  }
}

export function loadProfileByEmail(
  email: string | undefined | null
): VehicleProfile | null {
  const norm = normalizeProfileEmail(email);
  if (!norm || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${EMAIL_PROFILE_PREFIX}${norm}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VehicleProfile>;
    return {
      fullName: String(parsed.fullName || ''),
      email: normalizeProfileEmail(parsed.email || norm),
      authProvider: (parsed.authProvider || 'email') as AuthProviderId,
      clubName: String(parsed.clubName || ''),
      homeCity: String(parsed.homeCity || ''),
      bio: String(parsed.bio || ''),
      instagramHandle: String(parsed.instagramHandle || ''),
      vehicleType: parsed.vehicleType === 'MOTOR' ? 'MOTOR' : 'MOBIL',
      vehicleDetail: String(parsed.vehicleDetail || ''),
      licensePlate: String(parsed.licensePlate || ''),
      emergencyContact: String(parsed.emergencyContact || ''),
      avatarPreset: (parsed.avatarPreset || 'HELMET_TOURING') as AvatarPreset,
      avatarPhotoUrl:
        typeof parsed.avatarPhotoUrl === 'string' && parsed.avatarPhotoUrl.length > 0
          ? parsed.avatarPhotoUrl
          : undefined,
    };
  } catch {
    return null;
  }
}

export function saveLocalSession(session: StoredLocalSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
    } else {
      window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage error
  }
}

export function loadLocalSession(): StoredLocalSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLocalSession>;
    if (!parsed.fullName && !parsed.email) return null;
    return {
      fullName: String(parsed.fullName || 'Rider KonvoiKu'),
      email: normalizeProfileEmail(parsed.email),
      authProvider: (parsed.authProvider || 'local') as AuthProviderId,
      instagramHandle: parsed.instagramHandle ? String(parsed.instagramHandle) : undefined,
    };
  } catch {
    return null;
  }
}

function toClockLabel(ts: unknown, fallback = 'Baru saja'): string {
  if (ts instanceof Timestamp) {
    const d = ts.toDate();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return fallback;
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  return Date.now();
}

export interface SyncedRoomSnapshot {
  room: Omit<TourRoom, 'members'> & { leaderUid: string; status: 'ACTIVE' | 'FINISHED' };
  routeConfig: ConvoyRouteConfig;
  sosState: SosEmergencyState;
}

function sanitizeAuthProvider(provider?: string): AuthProviderId {
  if (
    provider === 'google' ||
    provider === 'facebook' ||
    provider === 'instagram' ||
    provider === 'email' ||
    provider === 'local'
  ) {
    return provider;
  }
  return 'google';
}

export async function saveUserPrivateProfile(
  uid: string,
  profile: VehicleProfile
): Promise<void> {
  const path = `users/${uid}`;
  const docRef = doc(db, 'users', uid);
  const safePhoto =
    profile.avatarPhotoUrl && profile.avatarPhotoUrl.length <= 120000
      ? profile.avatarPhotoUrl
      : '';

  const mutableFields = {
    email: normalizeProfileEmail(profile.email).slice(0, 160),
    authProvider: sanitizeAuthProvider(profile.authProvider),
    fullName: (profile.fullName.trim() || 'Rider KonvoiKu').slice(0, 80),
    clubName: (profile.clubName || '').trim().slice(0, 80),
    homeCity: (profile.homeCity || '').trim().slice(0, 80),
    bio: (profile.bio || '').trim().slice(0, 240),
    instagramHandle: (profile.instagramHandle || '').trim().slice(0, 60),
    avatarPhotoUrl: safePhoto,
    vehicleType: profile.vehicleType,
    vehicleDetail: (profile.vehicleDetail.trim() || '').slice(0, 80),
    licensePlate: (profile.licensePlate.trim() || '').slice(0, 24),
    emergencyContact: (profile.emergencyContact.trim() || '').slice(0, 40),
    avatarPreset: (profile.avatarPreset || 'HELMET_TOURING').slice(0, 40),
  };

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        uid,
        ...mutableFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        ...mutableFields,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUserPrivateProfile(
  uid: string
): Promise<VehicleProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    const photo = typeof data.avatarPhotoUrl === 'string' && data.avatarPhotoUrl.length > 0
      ? data.avatarPhotoUrl
      : undefined;
    return {
      fullName: String(data.fullName || ''),
      email: normalizeProfileEmail(typeof data.email === 'string' ? data.email : ''),
      authProvider: sanitizeAuthProvider(
        typeof data.authProvider === 'string' ? data.authProvider : undefined
      ),
      clubName: String(data.clubName || ''),
      homeCity: String(data.homeCity || ''),
      bio: String(data.bio || ''),
      instagramHandle: String(data.instagramHandle || ''),
      vehicleType: (data.vehicleType === 'MOTOR' ? 'MOTOR' : 'MOBIL') as VehicleType,
      vehicleDetail: String(data.vehicleDetail || ''),
      licensePlate: String(data.licensePlate || ''),
      emergencyContact: String(data.emergencyContact || ''),
      avatarPreset: (data.avatarPreset || 'HELMET_TOURING') as AvatarPreset,
      avatarPhotoUrl: photo,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createSyncedRoom(params: {
  roomId: string;
  roomTitle: string;
  leaderUid: string;
  profile: VehicleProfile;
  routeConfig: ConvoyRouteConfig;
  initialLat: number;
  initialLng: number;
}): Promise<void> {
  const { roomId, roomTitle, leaderUid, profile, routeConfig, initialLat, initialLng } = params;
  const waypoints = routeConfig.waypoints;
  const origin = waypoints[0] ?? { latitude: initialLat, longitude: initialLng };
  const dest = waypoints[waypoints.length - 1] ?? {
    latitude: -6.645,
    longitude: 106.99,
  };
  const encodedPolyline = encodePolyline(
    waypoints.map((w) => ({ lat: w.latitude, lng: w.longitude }))
  ).slice(0, 16000);

  const routePreference: RoutePreference =
    routeConfig.routePreference === 'shortest' || routeConfig.routePreference === 'no_toll'
      ? routeConfig.routePreference
      : 'fastest';
  const routeInstructions = compactInstructionsForSync(routeConfig.routeInstructions, 50);

  const roomPath = `rooms/${roomId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId), {
      roomId,
      roomTitle: (roomTitle.trim() || 'Konvoi Touring').slice(0, 100),
      leaderUid,
      coLeaderUid: '',
      actingLeaderUid: leaderUid,
      leaderTroubleActive: false,
      leaderTroubleReason: '',
      destinationName: (routeConfig.destinationName.trim() || 'Titik Tujuan').slice(0, 120),
      destinationAddress: (
        routeConfig.destinationAddress.trim() ||
        `${dest.latitude.toFixed(4)}, ${dest.longitude.toFixed(4)}`
      ).slice(0, 240),
      destLat: dest.latitude,
      destLng: dest.longitude,
      originName: (routeConfig.originName || 'Titik Keberangkatan').slice(0, 120),
      originAddress: (routeConfig.originAddress || `${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)}`).slice(0, 240),
      originLat: origin.latitude,
      originLng: origin.longitude,
      encodedPolyline,
      routePreference,
      routeInstructions,
      totalRouteMeters: Math.max(100, Math.min(5000000, Math.round(routeConfig.totalRouteMeters))),
      estimatedDurationMillis: Math.max(0, Math.min(604800000, Math.round(routeConfig.estimatedDurationMillis ?? 0))),
      offRouteToleranceMeters: Math.max(10, Math.min(5000, Math.round(routeConfig.offRouteToleranceMeters))),
      maxStragglerDistanceMeters: Math.max(100, Math.min(50000, Math.round(routeConfig.maxStragglerDistanceMeters))),
      soundAlertEnabled: Boolean(routeConfig.soundAlertEnabled),
      status: 'ACTIVE',
      sosActive: false,
      sosSenderUid: '',
      sosSenderName: '',
      sosSenderVehicle: '',
      sosLat: 0,
      sosLng: 0,
      sosLocationText: '',
      sosTriggeredAtLabel: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, roomPath);
  }

  const memberPath = `rooms/${roomId}/members/${leaderUid}`;
  try {
    await setDoc(doc(db, 'rooms', roomId, 'members', leaderUid), {
      uid: leaderUid,
      roomId,
      fullName: (profile.fullName.trim() || 'Tour Leader').slice(0, 80),
      vehicleType: profile.vehicleType,
      vehicleDetail: (
        profile.vehicleDetail.trim() ||
        (profile.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor')
      ).slice(0, 80),
      licensePlate: (profile.licensePlate.trim() || 'B 1001 LDR').slice(0, 24),
      role: 'TOUR_LEADER',
      isSweeper: false,
      avatarPreset: profile.avatarPreset || 'RIDER_CAPTAIN',
      conditionStatus: 'AMAN',
      connectionStatus: 'CONNECTED',
      lastLocationText: 'GPS Aktif',
      latitude: initialLat,
      longitude: initialLng,
      speedKmh: 0,
      heading: 0,
      accuracyMeters: 15,
      routeProgress: 0.05,
      xFraction: 0.14,
      yFraction: 0.86,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, memberPath);
  }

  for (const cp of routeConfig.checkpoints) {
    await addRoomCheckpoint(roomId, leaderUid, cp);
  }

  await sendRoomMessage(roomId, {
    id: `sys-create-${Date.now()}`,
    senderUid: leaderUid,
    senderName: 'Sistem Konvoi',
    senderVehicle: '',
    senderAvatarPreset: 'RIDER_CAPTAIN',
    type: 'SYSTEM',
    textContent: `Room ${roomId} dibuat & disinkronkan real-time. Tujuan: ${routeConfig.destinationName}.`,
    voiceDurationSec: 0,
  });
}

export async function joinSyncedRoom(params: {
  roomId: string;
  uid: string;
  profile: VehicleProfile;
  initialLat: number;
  initialLng: number;
}): Promise<{ ok: boolean; error?: string; role: UserRole }> {
  const roomId = params.roomId.trim().toUpperCase();
  const { uid, profile, initialLat, initialLng } = params;
  const roomPath = `rooms/${roomId}`;

  let roomData: Record<string, unknown> | undefined;
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId));
    if (!snap.exists()) {
      return {
        ok: false,
        error: `Room ${roomId} tidak ditemukan. Pastikan kode room dari Tour Leader benar.`,
        role: 'MEMBER',
      };
    }
    roomData = snap.data();
    if (roomData?.status === 'FINISHED') {
      return {
        ok: false,
        error: `Konvoi pada Room ${roomId} sudah berakhir.`,
        role: 'MEMBER',
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, roomPath);
  }

  const isLeader = roomData?.leaderUid === uid;
  const role: UserRole = isLeader ? 'TOUR_LEADER' : 'MEMBER';
  const memberRef = doc(db, 'rooms', roomId, 'members', uid);
  const memberPath = `rooms/${roomId}/members/${uid}`;

  try {
    const existingMember = await getDoc(memberRef);
    if (!existingMember.exists()) {
      await setDoc(memberRef, {
        uid,
        roomId,
        fullName: (profile.fullName.trim() || 'Anggota Konvoi').slice(0, 80),
        vehicleType: profile.vehicleType,
        vehicleDetail: (
          profile.vehicleDetail.trim() ||
          (profile.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor')
        ).slice(0, 80),
        licensePlate: (profile.licensePlate.trim() || 'B 2026 KNV').slice(0, 24),
        role,
        isSweeper: false,
        avatarPreset: profile.avatarPreset || 'HELMET_TOURING',
        conditionStatus: 'AMAN',
        connectionStatus: 'CONNECTED',
        lastLocationText: 'GPS Aktif',
        latitude: initialLat,
        longitude: initialLng,
        speedKmh: 0,
        heading: 0,
        accuracyMeters: 20,
        routeProgress: 0.05,
        xFraction: 0.2,
        yFraction: 0.8,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(memberRef, {
        fullName: (profile.fullName.trim() || 'Anggota Konvoi').slice(0, 80),
        vehicleType: profile.vehicleType,
        vehicleDetail: (
          profile.vehicleDetail.trim() ||
          (profile.vehicleType === 'MOBIL' ? 'Mobil' : 'Motor')
        ).slice(0, 80),
        licensePlate: (profile.licensePlate.trim() || 'B 2026 KNV').slice(0, 24),
        avatarPreset: profile.avatarPreset || 'HELMET_TOURING',
        latitude: initialLat,
        longitude: initialLng,
        connectionStatus: 'CONNECTED',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }

  await sendRoomMessage(roomId, {
    id: `sys-join-${uid.slice(0, 6)}-${Date.now()}`,
    senderUid: uid,
    senderName: profile.fullName.trim() || 'Anggota',
    senderVehicle: profile.vehicleDetail.trim() || '',
    senderAvatarPreset: profile.avatarPreset || 'HELMET_TOURING',
    type: 'SYSTEM',
    textContent: `${profile.fullName.trim() || 'Anggota baru'} terhubung ke room dengan GPS real-time.`,
    voiceDurationSec: 0,
  });

  return { ok: true, role };
}

export function subscribeToSyncedRoom(
  roomId: string,
  callbacks: {
    onRoomUpdate: (snapshot: SyncedRoomSnapshot | null) => void;
    onMembersUpdate: (members: ConvoyMember[]) => void;
    onCheckpointsUpdate: (checkpoints: RestCheckpoint[]) => void;
    onMessagesUpdate: (messages: RoomMessage[]) => void;
  }
): () => void {
  const currentUid = auth.currentUser?.uid ?? '';
  let cachedExistingConfig: ConvoyRouteConfig | null = null;

  const unsubRoom = onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      if (!snap.exists()) {
        callbacks.onRoomUpdate(null);
        return;
      }
      const d = snap.data();
      const decoded = decodePolyline(String(d.encodedPolyline || ''));
      const waypoints: RoutePoint[] =
        decoded.length >= 2
          ? downsampleRoutePoints(decoded, 80)
          : [
              {
                xFraction: 0.14,
                yFraction: 0.86,
                latitude: Number(d.originLat ?? -6.71),
                longitude: Number(d.originLng ?? 106.85),
              },
              {
                xFraction: 0.86,
                yFraction: 0.14,
                latitude: Number(d.destLat ?? -6.645),
                longitude: Number(d.destLng ?? 106.99),
              },
            ];

      const rawPref = typeof d.routePreference === 'string' ? d.routePreference : '';
      const syncedPreference: RoutePreference =
        rawPref === 'shortest' || rawPref === 'no_toll' || rawPref === 'fastest'
          ? rawPref
          : (cachedExistingConfig?.routePreference ?? 'fastest');
      const parsedInstructions: RouteInstruction[] | undefined = Array.isArray(d.routeInstructions)
        ? d.routeInstructions
            .map((item: unknown) => {
              const obj = item as Record<string, unknown>;
              const lat = Number(obj?.latitude ?? obj?.lat ?? 0);
              const lng = Number(obj?.longitude ?? obj?.lng ?? 0);
              const offset = Number(obj?.routeOffsetInMeters ?? obj?.offsetMeters ?? 0);
              return {
                latitude: lat,
                longitude: lng,
                routeOffsetInMeters: offset,
                maneuver: String(obj?.maneuver ?? 'STRAIGHT'),
                message: String(obj?.message ?? 'Ikuti rute'),
                street: typeof obj?.street === 'string' ? obj.street : '',
              };
            })
            .filter(
              (ins: RouteInstruction) =>
                Boolean(ins.message) &&
                Number.isFinite(ins.latitude) &&
                Number.isFinite(ins.longitude)
            )
        : cachedExistingConfig?.routeInstructions;

      const nextConfig: ConvoyRouteConfig = {
        originName: typeof d.originName === 'string' && d.originName ? d.originName : cachedExistingConfig?.originName,
        originAddress: typeof d.originAddress === 'string' && d.originAddress ? d.originAddress : cachedExistingConfig?.originAddress,
        originLockedByLeader: Boolean(d.originName || cachedExistingConfig?.originLockedByLeader),
        routePreference: syncedPreference,
        routeInstructions: parsedInstructions,
        destinationName: String(d.destinationName || 'Tujuan Konvoi'),
        destinationAddress: String(d.destinationAddress || ''),
        waypoints,
        checkpoints: cachedExistingConfig?.checkpoints ?? [],
        totalRouteMeters: Number(d.totalRouteMeters || 12000),
        estimatedDurationMillis:
          typeof d.estimatedDurationMillis === 'number' && d.estimatedDurationMillis > 0
            ? d.estimatedDurationMillis
            : cachedExistingConfig?.estimatedDurationMillis,
        offRouteToleranceMeters: Number(d.offRouteToleranceMeters || 50),
        maxStragglerDistanceMeters: Number(d.maxStragglerDistanceMeters || 1000),
        soundAlertEnabled: Boolean(d.soundAlertEnabled ?? true),
      };
      cachedExistingConfig = nextConfig;

      const leaderUid = String(d.leaderUid || '');
      const coLeaderUid = typeof d.coLeaderUid === 'string' ? d.coLeaderUid : '';
      const rawActingLeaderUid = typeof d.actingLeaderUid === 'string' ? d.actingLeaderUid : '';
      const leaderTroubleActive = Boolean(d.leaderTroubleActive);
      const actingLeaderUid =
        rawActingLeaderUid && (leaderTroubleActive || rawActingLeaderUid === leaderUid)
          ? rawActingLeaderUid
          : leaderUid;

      callbacks.onRoomUpdate({
        room: {
          roomId: String(d.roomId || roomId),
          roomTitle: String(d.roomTitle || 'Konvoi Live'),
          inviteLink: `https://konvoiku.id/join/${roomId}`,
          createdAtLabel: toClockLabel(d.createdAt, 'Aktif sekarang'),
          leaderUid,
          coLeaderUid,
          actingLeaderUid,
          leaderTroubleActive,
          leaderTroubleReason: typeof d.leaderTroubleReason === 'string' ? d.leaderTroubleReason : '',
          status: d.status === 'FINISHED' ? 'FINISHED' : 'ACTIVE',
        },
        routeConfig: nextConfig,
        sosState: {
          isActive: Boolean(d.sosActive),
          senderId: String(d.sosSenderUid || ''),
          senderName: String(d.sosSenderName || ''),
          senderVehicle: String(d.sosSenderVehicle || ''),
          latitude: Number(d.sosLat || 0),
          longitude: Number(d.sosLng || 0),
          locationText: String(d.sosLocationText || ''),
          triggeredAtLabel: String(d.sosTriggeredAtLabel || ''),
        },
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`)
  );

  const membersQuery = query(
    collection(db, 'rooms', roomId, 'members'),
    where('roomId', '==', roomId)
  );
  const unsubMembers = onSnapshot(
    membersQuery,
    (snap) => {
      const list: ConvoyMember[] = snap.docs.map((docSnap, idx) => {
        const d = docSnap.data();
        const uid = String(d.uid || docSnap.id);
        return {
          id: uid,
          fullName: String(d.fullName || 'Rider'),
          vehicleType: (d.vehicleType === 'MOTOR' ? 'MOTOR' : 'MOBIL') as VehicleType,
          vehicleDetail: String(d.vehicleDetail || ''),
          licensePlate: String(d.licensePlate || ''),
          emergencyContact: '',
          role: (d.role === 'TOUR_LEADER' ? 'TOUR_LEADER' : 'MEMBER') as UserRole,
          joinedAtLabel: toClockLabel(d.joinedAt, 'Aktif'),
          isCurrentUser: uid === currentUid,
          isSweeper: Boolean(d.isSweeper),
          avatarPreset: (d.avatarPreset || 'HELMET_TOURING') as AvatarPreset,
          conditionStatus: (d.conditionStatus || 'AMAN') as MemberConditionStatus,
          connectionStatus: (d.connectionStatus || 'CONNECTED') as ConnectionStatus,
          lastLocationText: String(d.lastLocationText || 'GPS Aktif'),
          lastUpdatedLabel: toClockLabel(d.updatedAt, 'Baru saja'),
          lastUpdatedMs: toMillis(d.updatedAt),
          routeDistanceMeters: 0,
          offRouteMeters: 0,
          convoyOrderRank: idx + 1,
          mapPosition: {
            routeProgress: Number(d.routeProgress ?? 0.05),
            xFraction: Number(d.xFraction ?? 0.5),
            yFraction: Number(d.yFraction ?? 0.5),
            latitude: Number(d.latitude ?? -6.68),
            longitude: Number(d.longitude ?? 106.92),
            speedKmh: Number(d.speedKmh ?? 0),
            heading: Number(d.heading ?? 0),
            accuracyMeters: Number(d.accuracyMeters ?? 20),
          },
        };
      });
      callbacks.onMembersUpdate(list);
    },
    (error) =>
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/members`)
  );

  const cpQuery = query(
    collection(db, 'rooms', roomId, 'checkpoints'),
    where('roomId', '==', roomId)
  );
  const unsubCheckpoints = onSnapshot(
    cpQuery,
    (snap) => {
      const list: RestCheckpoint[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id || docSnap.id),
          name: String(d.name || 'Rest Area'),
          xFraction: Number(d.xFraction ?? 0.5),
          yFraction: Number(d.yFraction ?? 0.5),
          latitude: Number(d.latitude ?? -6.68),
          longitude: Number(d.longitude ?? 106.92),
        };
      });
      callbacks.onCheckpointsUpdate(list);
    },
    (error) =>
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/checkpoints`)
  );

  const msgQuery = query(
    collection(db, 'rooms', roomId, 'messages'),
    where('roomId', '==', roomId)
  );
  const unsubMessages = onSnapshot(
    msgQuery,
    (snap) => {
      const mapped = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            sortMs: toMillis(d.createdAt),
            msg: {
              id: String(d.id || docSnap.id),
              senderId: String(d.senderUid || ''),
              senderName: String(d.senderName || 'Rider'),
              senderVehicle: String(d.senderVehicle || ''),
              type: (d.type || 'TEXT') as ChatMessageType,
              textContent: String(d.textContent || ''),
              timestampLabel: String(d.timestampLabel || toClockLabel(d.createdAt)),
              voiceDurationSec: Number(d.voiceDurationSec || 0) || undefined,
              isFromCurrentUser: String(d.senderUid || '') === currentUid,
              senderAvatarPreset: (d.senderAvatarPreset || 'HELMET_TOURING') as AvatarPreset,
            } satisfies RoomMessage,
          };
        })
        .sort((a, b) => a.sortMs - b.sortMs)
        .slice(-80)
        .map((item) => item.msg);
      callbacks.onMessagesUpdate(mapped);
    },
    (error) =>
      handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/messages`)
  );

  return () => {
    unsubRoom();
    unsubMembers();
    unsubCheckpoints();
    unsubMessages();
  };
}

export async function publishMemberTelemetry(
  roomId: string,
  uid: string,
  patch: {
    latitude: number;
    longitude: number;
    speedKmh: number;
    heading: number;
    accuracyMeters: number;
    routeProgress: number;
    xFraction: number;
    yFraction: number;
    lastLocationText?: string;
    conditionStatus?: MemberConditionStatus;
  }
): Promise<void> {
  const path = `rooms/${roomId}/members/${uid}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId, 'members', uid), {
      latitude: Math.max(-90, Math.min(90, patch.latitude)),
      longitude: Math.max(-180, Math.min(180, patch.longitude)),
      speedKmh: Math.max(0, Math.min(350, Math.round(patch.speedKmh))),
      heading: Math.max(0, Math.min(360, Math.round(patch.heading))),
      accuracyMeters: Math.max(0, Math.min(500000, Math.round(patch.accuracyMeters))),
      routeProgress: Math.max(0, Math.min(1, patch.routeProgress)),
      xFraction: Math.max(0, Math.min(1, patch.xFraction)),
      yFraction: Math.max(0, Math.min(1, patch.yFraction)),
      ...(patch.lastLocationText
        ? { lastLocationText: patch.lastLocationText.slice(0, 160) }
        : {}),
      ...(patch.conditionStatus ? { conditionStatus: patch.conditionStatus } : {}),
      connectionStatus: 'CONNECTED',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateSyncedMemberCondition(
  roomId: string,
  uid: string,
  status: MemberConditionStatus
): Promise<void> {
  const path = `rooms/${roomId}/members/${uid}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId, 'members', uid), {
      conditionStatus: status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function assignSyncedSweeper(
  roomId: string,
  targetMemberUid: string,
  allMemberIds: string[]
): Promise<void> {
  try {
    await Promise.all(
      allMemberIds.map((memberUid) =>
        updateDoc(doc(db, 'rooms', roomId, 'members', memberUid), {
          isSweeper: memberUid === targetMemberUid,
          updatedAt: serverTimestamp(),
        })
      )
    );
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `rooms/${roomId}/members/${targetMemberUid}`
    );
  }
}

export async function removeSyncedMember(
  roomId: string,
  memberUid: string
): Promise<void> {
  const path = `rooms/${roomId}/members/${memberUid}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId, 'members', memberUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateSyncedRoomRoute(
  roomId: string,
  config: ConvoyRouteConfig
): Promise<void> {
  const path = `rooms/${roomId}`;
  const origin = config.waypoints[0];
  const dest = config.waypoints[config.waypoints.length - 1];
  const encodedPolyline = encodePolyline(
    config.waypoints.map((w) => ({ lat: w.latitude, lng: w.longitude }))
  ).slice(0, 16000);
  const routePreference: RoutePreference =
    config.routePreference === 'shortest' || config.routePreference === 'no_toll'
      ? config.routePreference
      : 'fastest';
  const routeInstructions = compactInstructionsForSync(config.routeInstructions, 50);

  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      destinationName: config.destinationName.slice(0, 120),
      destinationAddress: config.destinationAddress.slice(0, 240),
      ...(config.originName ? { originName: config.originName.slice(0, 120) } : {}),
      ...(config.originAddress ? { originAddress: config.originAddress.slice(0, 240) } : {}),
      ...(origin ? { originLat: origin.latitude, originLng: origin.longitude } : {}),
      ...(dest ? { destLat: dest.latitude, destLng: dest.longitude } : {}),
      encodedPolyline,
      routePreference,
      routeInstructions,
      totalRouteMeters: Math.max(100, Math.min(5000000, Math.round(config.totalRouteMeters))),
      estimatedDurationMillis: Math.max(0, Math.min(604800000, Math.round(config.estimatedDurationMillis ?? 0))),
      offRouteToleranceMeters: Math.max(10, Math.min(5000, Math.round(config.offRouteToleranceMeters))),
      maxStragglerDistanceMeters: Math.max(100, Math.min(50000, Math.round(config.maxStragglerDistanceMeters))),
      soundAlertEnabled: Boolean(config.soundAlertEnabled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncCoLeaderAssignment(
  roomId: string,
  coLeaderUid: string
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      coLeaderUid: coLeaderUid.slice(0, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Gagal menyinkronkan Co-Leader:', error);
  }
}

export async function triggerCoLeaderFailover(
  roomId: string,
  actingLeaderUid: string,
  reason: string
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      actingLeaderUid: actingLeaderUid.slice(0, 128),
      leaderTroubleActive: true,
      leaderTroubleReason: reason.slice(0, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function recoverOriginalLeader(
  roomId: string,
  originalLeaderUid: string
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      actingLeaderUid: originalLeaderUid.slice(0, 128),
      leaderTroubleActive: false,
      leaderTroubleReason: '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addRoomCheckpoint(
  roomId: string,
  createdByUid: string,
  cp: RestCheckpoint
): Promise<void> {
  const safeId = cp.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `cp-${Date.now()}`;
  const path = `rooms/${roomId}/checkpoints/${safeId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId, 'checkpoints', safeId), {
      id: safeId,
      roomId,
      createdByUid,
      name: (cp.name.trim() || 'Rest Area').slice(0, 100),
      latitude: cp.latitude,
      longitude: cp.longitude,
      xFraction: Math.max(0, Math.min(1, cp.xFraction)),
      yFraction: Math.max(0, Math.min(1, cp.yFraction)),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeRoomCheckpoint(
  roomId: string,
  checkpointId: string
): Promise<void> {
  const path = `rooms/${roomId}/checkpoints/${checkpointId}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId, 'checkpoints', checkpointId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function sendRoomMessage(
  roomId: string,
  msg: {
    id: string;
    senderUid: string;
    senderName: string;
    senderVehicle: string;
    senderAvatarPreset: AvatarPreset;
    type: ChatMessageType;
    textContent: string;
    voiceDurationSec?: number;
  }
): Promise<void> {
  const safeId = msg.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `msg-${Date.now()}`;
  const path = `rooms/${roomId}/messages/${safeId}`;
  const now = new Date();
  const timestampLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  try {
    await setDoc(doc(db, 'rooms', roomId, 'messages', safeId), {
      id: safeId,
      roomId,
      senderUid: msg.senderUid,
      senderName: (msg.senderName.trim() || 'Rider').slice(0, 80),
      senderVehicle: (msg.senderVehicle || '').slice(0, 80),
      senderAvatarPreset: msg.senderAvatarPreset || 'HELMET_TOURING',
      type: msg.type,
      textContent: (msg.textContent.trim() || '-').slice(0, 500),
      voiceDurationSec: Math.max(0, Math.min(600, Math.round(msg.voiceDurationSec ?? 0))),
      timestampLabel,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function triggerSyncedSos(
  roomId: string,
  sender: {
    uid: string;
    fullName: string;
    vehicleDetail: string;
    latitude: number;
    longitude: number;
    locationText: string;
    triggeredAtLabel: string;
  }
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      sosActive: true,
      sosSenderUid: sender.uid,
      sosSenderName: sender.fullName.slice(0, 80),
      sosSenderVehicle: sender.vehicleDetail.slice(0, 80),
      sosLat: sender.latitude,
      sosLng: sender.longitude,
      sosLocationText: sender.locationText.slice(0, 160),
      sosTriggeredAtLabel: sender.triggeredAtLabel.slice(0, 32),
      updatedAt: serverTimestamp(),
    });
    await updateSyncedMemberCondition(roomId, sender.uid, 'SOS');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function resolveSyncedSos(
  roomId: string,
  senderUid: string
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      sosActive: false,
      sosSenderUid: '',
      sosSenderName: '',
      sosSenderVehicle: '',
      sosLat: 0,
      sosLng: 0,
      sosLocationText: '',
      sosTriggeredAtLabel: '',
      updatedAt: serverTimestamp(),
    });
    if (senderUid && senderUid === auth.currentUser?.uid) {
      await updateSyncedMemberCondition(roomId, senderUid, 'AMAN');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function finishSyncedRoom(roomId: string): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'FINISHED',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveTripRecordToFirestore(
  uid: string,
  record: TripHistoryRecord
): Promise<void> {
  const safeId = record.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `trip-${Date.now()}`;
  const path = `users/${uid}/trips/${safeId}`;
  const geoPoints = record.waypoints
    .filter((pt) => Number.isFinite(pt.latitude) && Number.isFinite(pt.longitude) && (Math.abs(pt.latitude) > 0.001 || Math.abs(pt.longitude) > 0.001))
    .slice(0, 140)
    .map((pt) => ({ lat: pt.latitude, lng: pt.longitude }));
  const encodedPolyline = geoPoints.length >= 2 ? encodePolyline(geoPoints).slice(0, 16384) : '';
  try {
    await setDoc(doc(db, 'users', uid, 'trips', safeId), {
      id: safeId,
      ownerUid: uid,
      roomId: record.roomId.slice(0, 32),
      tourTitle: record.tourTitle.slice(0, 100),
      dateLabel: record.dateLabel.slice(0, 32),
      timeRangeLabel: record.timeRangeLabel.slice(0, 32),
      durationLabel: record.durationLabel.slice(0, 32),
      durationMinutes: Math.max(0, Math.min(10080, Math.round(record.durationMinutes))),
      distanceKm: Math.max(0, Math.min(20000, Number(record.distanceKm))),
      avgSpeedKmh: Math.max(0, Math.min(350, Math.round(record.avgSpeedKmh))),
      maxSpeedKmh: Math.max(0, Math.min(350, Math.round(record.maxSpeedKmh))),
      userRole: record.userRole,
      destinationName: record.destinationName.slice(0, 120),
      destinationAddress: record.destinationAddress.slice(0, 240),
      encodedPolyline,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function loadUserTripsFromFirestore(
  uid: string
): Promise<TripHistoryRecord[]> {
  const path = `users/${uid}/trips`;
  try {
    const q = query(
      collection(db, 'users', uid, 'trips'),
      where('ownerUid', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        const encoded = typeof d.encodedPolyline === 'string' ? d.encodedPolyline : '';
        const decodedPoints = encoded ? decodePolyline(encoded) : [];
        const restoredWaypoints: RoutePoint[] =
          decodedPoints.length >= 2 ? downsampleRoutePoints(decodedPoints, 120) : [];
        return {
          sortMs: toMillis(d.createdAt),
          record: {
            id: String(d.id || docSnap.id),
            roomId: String(d.roomId || ''),
            tourTitle: String(d.tourTitle || ''),
            dateLabel: String(d.dateLabel || ''),
            timeRangeLabel: String(d.timeRangeLabel || ''),
            durationLabel: String(d.durationLabel || ''),
            durationMinutes: Number(d.durationMinutes || 0),
            distanceKm: Number(d.distanceKm || 0),
            avgSpeedKmh: Number(d.avgSpeedKmh || 0),
            maxSpeedKmh: Number(d.maxSpeedKmh || 0),
            userRole: (d.userRole === 'TOUR_LEADER' ? 'TOUR_LEADER' : 'MEMBER') as UserRole,
            destinationName: String(d.destinationName || ''),
            destinationAddress: String(d.destinationAddress || ''),
            waypoints: restoredWaypoints,
            visitedCheckpoints: [],
            participants: [],
          } satisfies TripHistoryRecord,
        };
      })
      .sort((a, b) => b.sortMs - a.sortMs)
      .map((item) => item.record);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// --- Admin Backend, Global Config & Active Presence Monitoring ---

export const ADMIN_EMAIL = 'ekie.ray@gmail.com';

export function isAdminEmailAddress(email?: string | null): boolean {
  return normalizeProfileEmail(email) === ADMIN_EMAIL;
}

export function isVerifiedAdminSession(
  user?: { email?: string | null; emailVerified?: boolean } | null
): boolean {
  return Boolean(
    user &&
      normalizeProfileEmail(user.email) === ADMIN_EMAIL &&
      user.emailVerified === true
  );
}

export const DEFAULT_GLOBAL_APP_CONFIG: GlobalAppConfig = {
  configId: 'global',
  defaultOffRouteToleranceMeters: 75,
  defaultMaxStragglerDistanceMeters: 1000,
  defaultSoundAlertEnabled: true,
  maintenanceMode: false,
  maintenanceMessage:
    'Aplikasi sedang dalam pemeliharaan berkala. Mohon tunggu beberapa saat.',
  announcementActive: false,
  announcementTitle: 'Info KonvoiKu',
  announcementMessage: '',
  allowGuestMode: true,
  allowNewRooms: true,
};

export function subscribeToGlobalAppConfig(
  callback: (config: GlobalAppConfig) => void
): () => void {
  const path = 'app_config/global';
  return onSnapshot(
    doc(db, 'app_config', 'global'),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_GLOBAL_APP_CONFIG);
        return;
      }
      const d = snap.data();
      callback({
        configId: 'global',
        defaultOffRouteToleranceMeters: Math.max(
          10,
          Math.min(5000, Number(d.defaultOffRouteToleranceMeters ?? 75))
        ),
        defaultMaxStragglerDistanceMeters: Math.max(
          100,
          Math.min(50000, Number(d.defaultMaxStragglerDistanceMeters ?? 1000))
        ),
        defaultSoundAlertEnabled: Boolean(d.defaultSoundAlertEnabled ?? true),
        maintenanceMode: Boolean(d.maintenanceMode),
        maintenanceMessage: String(
          d.maintenanceMessage || DEFAULT_GLOBAL_APP_CONFIG.maintenanceMessage
        ),
        announcementActive: Boolean(d.announcementActive),
        announcementTitle: String(d.announcementTitle || 'Info KonvoiKu'),
        announcementMessage: String(d.announcementMessage || ''),
        allowGuestMode: Boolean(d.allowGuestMode ?? true),
        allowNewRooms: Boolean(d.allowNewRooms ?? true),
        updatedByUid: typeof d.updatedByUid === 'string' ? d.updatedByUid : undefined,
        updatedAtLabel: toClockLabel(d.updatedAt, 'Baru saja'),
      });
    },
    (error) => {
      console.warn('Gagal membaca pengaturan global:', error);
      callback(DEFAULT_GLOBAL_APP_CONFIG);
    }
  );
}

export async function saveGlobalAppConfig(
  uid: string,
  config: GlobalAppConfig
): Promise<void> {
  const path = 'app_config/global';
  try {
    await setDoc(doc(db, 'app_config', 'global'), {
      configId: 'global',
      defaultOffRouteToleranceMeters: Math.max(
        10,
        Math.min(5000, Math.round(config.defaultOffRouteToleranceMeters || 75))
      ),
      defaultMaxStragglerDistanceMeters: Math.max(
        100,
        Math.min(50000, Math.round(config.defaultMaxStragglerDistanceMeters || 1000))
      ),
      defaultSoundAlertEnabled: Boolean(config.defaultSoundAlertEnabled),
      maintenanceMode: Boolean(config.maintenanceMode),
      maintenanceMessage: (config.maintenanceMessage || '').trim().slice(0, 240),
      announcementActive: Boolean(config.announcementActive),
      announcementTitle: (config.announcementTitle || '').trim().slice(0, 80),
      announcementMessage: (config.announcementMessage || '').trim().slice(0, 240),
      allowGuestMode: Boolean(config.allowGuestMode),
      allowNewRooms: Boolean(config.allowNewRooms),
      updatedByUid: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function publishUserPresence(
  uid: string,
  payload: {
    fullName: string;
    email: string;
    isTraveling: boolean;
    activeRoomId: string;
    speedKmh: number;
  }
): Promise<void> {
  const path = `presence/${uid}`;
  try {
    await setDoc(doc(db, 'presence', uid), {
      uid,
      fullName: (payload.fullName.trim() || 'Rider KonvoiKu').slice(0, 80),
      email: normalizeProfileEmail(payload.email).slice(0, 160),
      platform: 'web',
      isTraveling: Boolean(payload.isTraveling),
      activeRoomId: (payload.activeRoomId || '').trim().slice(0, 32),
      speedKmh: Math.max(0, Math.min(350, Math.round(payload.speedKmh || 0))),
      lastSeenAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToAdminMonitoring(callbacks: {
  onPresence: (items: UserPresenceRecord[]) => void;
  onRooms: (rooms: AdminRoomOverview[]) => void;
  onUsers: (users: AdminUserSummary[]) => void;
  onError: (msg: string) => void;
}): () => void {
  const memberUnsubs = new Map<string, () => void>();
  let latestRoomsBase: Omit<AdminRoomOverview, 'members'>[] = [];
  const membersByRoom = new Map<string, ConvoyMember[]>();

  const emitRooms = () => {
    const combined: AdminRoomOverview[] = latestRoomsBase
      .map((r) => ({
        ...r,
        members: membersByRoom.get(r.roomId) || [],
      }))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
        return b.updatedAtMs - a.updatedAtMs;
      });
    callbacks.onRooms(combined);
  };

  const unsubPresence = onSnapshot(
    collection(db, 'presence'),
    (snap) => {
      const list: UserPresenceRecord[] = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          const seenMs = toMillis(d.lastSeenAt);
          return {
            uid: String(d.uid || docSnap.id),
            fullName: String(d.fullName || 'Rider'),
            email: String(d.email || ''),
            platform: (d.platform === 'android' ? 'android' : 'web') as 'web' | 'android',
            isTraveling: Boolean(d.isTraveling),
            activeRoomId: String(d.activeRoomId || ''),
            speedKmh: Number(d.speedKmh || 0),
            lastSeenMs: seenMs,
            lastSeenLabel: toClockLabel(d.lastSeenAt, 'Baru saja'),
          };
        })
        .sort((a, b) => b.lastSeenMs - a.lastSeenMs);
      callbacks.onPresence(list);
    },
    (err) => {
      callbacks.onError(`Gagal memuat presence aktif: ${err.message}`);
    }
  );

  const unsubUsers = onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const list: AdminUserSummary[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: String(d.uid || docSnap.id),
          fullName: String(d.fullName || 'Rider KonvoiKu'),
          email: String(d.email || ''),
          authProvider: sanitizeAuthProvider(
            typeof d.authProvider === 'string' ? d.authProvider : 'google'
          ),
          clubName: String(d.clubName || ''),
          homeCity: String(d.homeCity || ''),
          vehicleType: (d.vehicleType === 'MOTOR' ? 'MOTOR' : 'MOBIL') as VehicleType,
          vehicleDetail: String(d.vehicleDetail || ''),
          licensePlate: String(d.licensePlate || ''),
          avatarPreset: (d.avatarPreset || 'HELMET_TOURING') as AvatarPreset,
          avatarPhotoUrl:
            typeof d.avatarPhotoUrl === 'string' && d.avatarPhotoUrl.length > 0
              ? d.avatarPhotoUrl
              : undefined,
          updatedAtLabel: toClockLabel(d.updatedAt, '-'),
        };
      });
      callbacks.onUsers(list);
    },
    (err) => {
      callbacks.onError(`Gagal memuat daftar pengguna: ${err.message}`);
    }
  );

  const unsubRooms = onSnapshot(
    collection(db, 'rooms'),
    (snap) => {
      const activeIds = new Set<string>();
      latestRoomsBase = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const roomId = String(d.roomId || docSnap.id);
        activeIds.add(roomId);

        if (!memberUnsubs.has(roomId)) {
          const unsubM = onSnapshot(
            collection(db, 'rooms', roomId, 'members'),
            (mSnap) => {
              const members: ConvoyMember[] = mSnap.docs.map((mDoc, idx) => {
                const md = mDoc.data();
                return {
                  id: String(md.uid || mDoc.id),
                  fullName: String(md.fullName || 'Rider'),
                  vehicleType: (md.vehicleType === 'MOTOR' ? 'MOTOR' : 'MOBIL') as VehicleType,
                  vehicleDetail: String(md.vehicleDetail || ''),
                  licensePlate: String(md.licensePlate || ''),
                  emergencyContact: '',
                  role: (md.role === 'TOUR_LEADER' ? 'TOUR_LEADER' : 'MEMBER') as UserRole,
                  joinedAtLabel: toClockLabel(md.joinedAt, 'Aktif'),
                  isCurrentUser: false,
                  isSweeper: Boolean(md.isSweeper),
                  avatarPreset: (md.avatarPreset || 'HELMET_TOURING') as AvatarPreset,
                  conditionStatus: (md.conditionStatus || 'AMAN') as MemberConditionStatus,
                  connectionStatus: (md.connectionStatus || 'CONNECTED') as ConnectionStatus,
                  lastLocationText: String(md.lastLocationText || 'GPS Live'),
                  lastUpdatedLabel: toClockLabel(md.updatedAt, 'Baru saja'),
                  routeDistanceMeters: 0,
                  offRouteMeters: 0,
                  convoyOrderRank: idx + 1,
                  mapPosition: {
                    routeProgress: Number(md.routeProgress ?? 0),
                    xFraction: Number(md.xFraction ?? 0.5),
                    yFraction: Number(md.yFraction ?? 0.5),
                    latitude: Number(md.latitude ?? 0),
                    longitude: Number(md.longitude ?? 0),
                    speedKmh: Number(md.speedKmh ?? 0),
                    heading: Number(md.heading ?? 0),
                    accuracyMeters: Number(md.accuracyMeters ?? 20),
                  },
                };
              });
              membersByRoom.set(roomId, members);
              emitRooms();
            },
            () => {}
          );
          memberUnsubs.set(roomId, unsubM);
        }

        return {
          roomId,
          roomTitle: String(d.roomTitle || 'Konvoi Live'),
          leaderUid: String(d.leaderUid || ''),
          destinationName: String(d.destinationName || '-'),
          status: d.status === 'FINISHED' ? 'FINISHED' : 'ACTIVE',
          sosActive: Boolean(d.sosActive),
          sosSenderName: String(d.sosSenderName || ''),
          offRouteToleranceMeters: Number(d.offRouteToleranceMeters || 75),
          maxStragglerDistanceMeters: Number(d.maxStragglerDistanceMeters || 1000),
          createdAtLabel: toClockLabel(d.createdAt, '-'),
          updatedAtMs: toMillis(d.updatedAt),
          updatedAtLabel: toClockLabel(d.updatedAt, '-'),
        };
      });

      for (const [rId, unsub] of memberUnsubs.entries()) {
        if (!activeIds.has(rId)) {
          unsub();
          memberUnsubs.delete(rId);
          membersByRoom.delete(rId);
        }
      }
      emitRooms();
    },
    (err) => {
      callbacks.onError(`Gagal memuat daftar room konvoi: ${err.message}`);
    }
  );

  return () => {
    unsubPresence();
    unsubUsers();
    unsubRooms();
    memberUnsubs.forEach((unsub) => unsub());
    memberUnsubs.clear();
  };
}

export async function adminSetRoomStatus(
  roomId: string,
  status: 'ACTIVE' | 'FINISHED'
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminResolveRoomSos(roomId: string): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      sosActive: false,
      sosSenderUid: '',
      sosSenderName: '',
      sosSenderVehicle: '',
      sosLat: 0,
      sosLng: 0,
      sosLocationText: '',
      sosTriggeredAtLabel: '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteRoom(roomId: string): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

