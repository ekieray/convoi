export type UserRole = 'TOUR_LEADER' | 'MEMBER';

export type VehicleType = 'MOBIL' | 'MOTOR';

export type ConnectionStatus = 'CONNECTED' | 'WEAK_SIGNAL' | 'OFFLINE';

export type MemberConditionStatus = 'AMAN' | 'ISTIRAHAT' | 'MOGOK' | 'SOS';

export type ChatMessageType = 'TEXT' | 'VOICE' | 'SOS_ALERT' | 'SYSTEM';

export type ScreenRoute =
  | 'role_selection'
  | 'vehicle_profile'
  | 'tour_leader'
  | 'join_tour'
  | 'live_map'
  | 'trip_history'
  | 'trip_detail'
  | 'about_app';

export type AvatarPreset =
  | 'HELMET_TOURING'
  | 'HELMET_SPORT'
  | 'RIDER_CAPTAIN'
  | 'PILOT_CLASSIC'
  | 'RALLY_PRO'
  | 'STANDARD_USER';

export interface RoomMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderVehicle: string;
  type: ChatMessageType;
  textContent: string;
  timestampLabel: string;
  voiceDurationSec?: number;
  voiceAudioUrl?: string;
  isFromCurrentUser?: boolean;
  senderAvatarPreset?: AvatarPreset;
  senderAvatarPhotoUrl?: string;
}

export interface SosEmergencyState {
  isActive: boolean;
  senderId: string;
  senderName: string;
  senderVehicle: string;
  latitude: number;
  longitude: number;
  locationText: string;
  triggeredAtLabel: string;
}

export interface RoutePoint {
  xFraction: number;
  yFraction: number;
  latitude: number;
  longitude: number;
}

export interface DestinationPreset {
  name: string;
  endPoint: RoutePoint;
  totalMeters: number;
}

export interface RestCheckpoint {
  id: string;
  name: string;
  xFraction: number;
  yFraction: number;
  latitude: number;
  longitude: number;
}

export interface ConvoyRouteConfig {
  destinationName: string;
  destinationAddress: string;
  waypoints: RoutePoint[];
  checkpoints: RestCheckpoint[];
  totalRouteMeters: number;
  offRouteToleranceMeters: number;
  maxStragglerDistanceMeters: number;
  soundAlertEnabled: boolean;
}

export interface StragglerAlertState {
  isTriggered: boolean;
  trailingMember: ConvoyMember | null;
  aheadMember: ConvoyMember | null;
  gapMeters: number;
  maxAllowedMeters: number;
}

export interface OffRouteAlertState {
  isOffRoute: boolean;
  deviationMeters: number;
  toleranceMeters: number;
}

export interface MapPosition {
  routeProgress: number;
  xFraction: number;
  yFraction: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  heading?: number;
  accuracyMeters?: number;
}

export interface VehicleProfile {
  fullName: string;
  vehicleType: VehicleType;
  vehicleDetail: string;
  licensePlate: string;
  emergencyContact: string;
  avatarPreset: AvatarPreset;
  avatarPhotoUrl?: string;
}

export interface ConvoyMember {
  id: string;
  fullName: string;
  vehicleType: VehicleType;
  vehicleDetail: string;
  licensePlate: string;
  emergencyContact: string;
  role: UserRole;
  joinedAtLabel: string;
  isCurrentUser: boolean;
  isSweeper: boolean;
  avatarPreset: AvatarPreset;
  avatarPhotoUrl?: string;
  conditionStatus: MemberConditionStatus;
  connectionStatus: ConnectionStatus;
  lastLocationText: string;
  lastUpdatedLabel: string;
  routeDistanceMeters: number;
  offRouteMeters: number;
  convoyOrderRank: number;
  mapPosition: MapPosition;
}

export interface TourRoom {
  roomId: string;
  roomTitle: string;
  inviteLink: string;
  createdAtLabel: string;
  isSyncedRoom?: boolean;
  leaderUid?: string;
  members: ConvoyMember[];
}

export interface DestinationEtaInfo {
  remainingMeters: number;
  speedKmh: number;
  etaMinutes: number | null;
  isStopped: boolean;
  isArrived: boolean;
  durationLabel: string;
  arrivalClockLabel: string;
  distanceLabel: string;
}

export interface TripParticipantSummary {
  id: string;
  fullName: string;
  vehicleType: VehicleType;
  vehicleDetail: string;
  licensePlate: string;
  role: UserRole;
  isSweeper?: boolean;
  avatarPreset: AvatarPreset;
  avatarPhotoUrl?: string;
}

export interface VisitedCheckpointLog {
  id: string;
  name: string;
  arrivedAtLabel: string;
  xFraction: number;
  yFraction: number;
  latitude: number;
  longitude: number;
}

export interface TripHistoryRecord {
  id: string;
  roomId: string;
  tourTitle: string;
  dateLabel: string;
  timeRangeLabel: string;
  durationLabel: string;
  durationMinutes: number;
  distanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  userRole: UserRole;
  destinationName: string;
  destinationAddress: string;
  waypoints: RoutePoint[];
  visitedCheckpoints: VisitedCheckpointLog[];
  participants: TripParticipantSummary[];
}

export type TripCardTheme =
  | 'DARK_CARBON'
  | 'SATELLITE'
  | 'MINIMAL_LIGHT'
  | 'CUSTOM_PHOTO';

