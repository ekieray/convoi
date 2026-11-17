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
  AvatarPreset,
  ChatMessageType,
  ConnectionStatus,
  ConvoyMember,
  ConvoyRouteConfig,
  MemberConditionStatus,
  RestCheckpoint,
  RoomMessage,
  RoutePoint,
  SosEmergencyState,
  TourRoom,
  TripHistoryRecord,
  UserRole,
  VehicleProfile,
  VehicleType,
} from '../types/convoy';
import { decodePolyline, downsampleRoutePoints, encodePolyline } from '../utils/geo';

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

export async function saveUserPrivateProfile(
  uid: string,
  profile: VehicleProfile
): Promise<void> {
  const path = `users/${uid}`;
  const docRef = doc(db, 'users', uid);
  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        uid,
        fullName: (profile.fullName.trim() || 'Rider KonvoiKu').slice(0, 80),
        vehicleType: profile.vehicleType,
        vehicleDetail: (profile.vehicleDetail.trim() || '').slice(0, 80),
        licensePlate: (profile.licensePlate.trim() || '').slice(0, 24),
        emergencyContact: (profile.emergencyContact.trim() || '').slice(0, 40),
        avatarPreset: profile.avatarPreset || 'HELMET_TOURING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        fullName: (profile.fullName.trim() || 'Rider KonvoiKu').slice(0, 80),
        vehicleType: profile.vehicleType,
        vehicleDetail: (profile.vehicleDetail.trim() || '').slice(0, 80),
        licensePlate: (profile.licensePlate.trim() || '').slice(0, 24),
        emergencyContact: (profile.emergencyContact.trim() || '').slice(0, 40),
        avatarPreset: profile.avatarPreset || 'HELMET_TOURING',
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
    return {
      fullName: String(data.fullName || ''),
      vehicleType: (data.vehicleType === 'MOTOR' ? 'MOTOR' : 'MOBIL') as VehicleType,
      vehicleDetail: String(data.vehicleDetail || ''),
      licensePlate: String(data.licensePlate || ''),
      emergencyContact: String(data.emergencyContact || ''),
      avatarPreset: (data.avatarPreset || 'HELMET_TOURING') as AvatarPreset,
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

  const roomPath = `rooms/${roomId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId), {
      roomId,
      roomTitle: (roomTitle.trim() || 'Konvoi Touring').slice(0, 100),
      leaderUid,
      destinationName: routeConfig.destinationName.slice(0, 120),
      destinationAddress: routeConfig.destinationAddress.slice(0, 240),
      destLat: dest.latitude,
      destLng: dest.longitude,
      originLat: origin.latitude,
      originLng: origin.longitude,
      encodedPolyline,
      totalRouteMeters: Math.max(100, Math.min(5000000, Math.round(routeConfig.totalRouteMeters))),
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
  const { roomId, uid, profile, initialLat, initialLng } = params;
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

      const nextConfig: ConvoyRouteConfig = {
        destinationName: String(d.destinationName || 'Tujuan Konvoi'),
        destinationAddress: String(d.destinationAddress || ''),
        waypoints,
        checkpoints: cachedExistingConfig?.checkpoints ?? [],
        totalRouteMeters: Number(d.totalRouteMeters || 12000),
        offRouteToleranceMeters: Number(d.offRouteToleranceMeters || 50),
        maxStragglerDistanceMeters: Number(d.maxStragglerDistanceMeters || 1000),
        soundAlertEnabled: Boolean(d.soundAlertEnabled ?? true),
      };
      cachedExistingConfig = nextConfig;

      callbacks.onRoomUpdate({
        room: {
          roomId: String(d.roomId || roomId),
          roomTitle: String(d.roomTitle || 'Konvoi Live'),
          inviteLink: `https://konvoiku.id/join/${roomId}`,
          createdAtLabel: toClockLabel(d.createdAt, 'Aktif sekarang'),
          leaderUid: String(d.leaderUid || ''),
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

  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      destinationName: config.destinationName.slice(0, 120),
      destinationAddress: config.destinationAddress.slice(0, 240),
      ...(origin ? { originLat: origin.latitude, originLng: origin.longitude } : {}),
      ...(dest ? { destLat: dest.latitude, destLng: dest.longitude } : {}),
      encodedPolyline,
      totalRouteMeters: Math.max(100, Math.min(5000000, Math.round(config.totalRouteMeters))),
      offRouteToleranceMeters: Math.max(10, Math.min(5000, Math.round(config.offRouteToleranceMeters))),
      maxStragglerDistanceMeters: Math.max(100, Math.min(50000, Math.round(config.maxStragglerDistanceMeters))),
      soundAlertEnabled: Boolean(config.soundAlertEnabled),
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
            waypoints: [],
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
