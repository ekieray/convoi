package com.konvoiku.touring.data

import com.google.firebase.FirebaseApp
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.konvoiku.touring.model.AuthProviderType
import com.konvoiku.touring.model.AvatarPreset
import com.konvoiku.touring.model.ChatMessageType
import com.konvoiku.touring.model.ConnectionStatus
import com.konvoiku.touring.model.ConvoyMember
import com.konvoiku.touring.model.ConvoyRouteConfig
import com.konvoiku.touring.model.MapPosition
import com.konvoiku.touring.model.MemberConditionStatus
import com.konvoiku.touring.model.RestCheckpoint
import com.konvoiku.touring.model.RoomMessage
import com.konvoiku.touring.model.SosEmergencyState
import com.konvoiku.touring.model.UserRole
import com.konvoiku.touring.model.VehicleProfile
import com.konvoiku.touring.model.VehicleType
import com.konvoiku.touring.util.GeoUtils
import com.konvoiku.touring.util.LatLngGeo
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class SyncedRoomHeader(
    val roomId: String,
    val roomTitle: String,
    val leaderUid: String,
    val routeConfig: ConvoyRouteConfig,
    val sosState: SosEmergencyState
)

class FirestoreConvoyRepository {

    companion object {
        // Named Firestore database provisioned for KonvoiKu Web & Android sync
        private const val FIRESTORE_DB_ID =
            "ai-studio-konvoikutouringc-4b128c6d-2347-4d6f-afba-25201f26dbcb"
    }

    private fun getAuth(): FirebaseAuth? = runCatching {
        if (FirebaseApp.getApps(FirebaseApp.getInstance().applicationContext).isEmpty()) null
        else FirebaseAuth.getInstance()
    }.getOrNull()

    private fun getFirestore(): FirebaseFirestore? = runCatching {
        val app = FirebaseApp.getInstance()
        FirebaseFirestore.getInstance(app, FIRESTORE_DB_ID)
    }.getOrElse {
        runCatching { FirebaseFirestore.getInstance() }.getOrNull()
    }

    fun isAvailable(): Boolean = getFirestore() != null && getAuth() != null

    fun currentUid(): String? = getAuth()?.currentUser?.uid

    fun currentUserEmail(): String = getAuth()?.currentUser?.email.orEmpty()

    suspend fun ensureSignedInUid(): String? {
        val auth = getAuth() ?: return null
        auth.currentUser?.uid?.let { return it }
        return runCatching {
            auth.signInAnonymously().await().user?.uid
        }.getOrNull()
    }

    suspend fun signUpWithEmail(
        fullName: String,
        email: String,
        password: String
    ): Result<String> {
        val auth = getAuth() ?: return Result.failure(IllegalStateException("Firebase Auth tidak tersedia."))
        return runCatching {
            val result = auth.createUserWithEmailAndPassword(email.trim(), password).await()
            val user = result.user ?: throw IllegalStateException("Gagal membuat akun Firebase.")
            val cleanName = fullName.trim()
            if (cleanName.isNotEmpty()) {
                val req = UserProfileChangeRequest.Builder()
                    .setDisplayName(cleanName)
                    .build()
                runCatching { user.updateProfile(req).await() }
            }
            user.uid
        }
    }

    suspend fun signInWithEmail(
        email: String,
        password: String
    ): Result<String> {
        val auth = getAuth() ?: return Result.failure(IllegalStateException("Firebase Auth tidak tersedia."))
        return runCatching {
            val result = auth.signInWithEmailAndPassword(email.trim(), password).await()
            result.user?.uid ?: throw IllegalStateException("Gagal masuk dengan email.")
        }
    }

    fun signOutAuth() {
        runCatching { getAuth()?.signOut() }
    }

    suspend fun saveUserPrivateProfile(uid: String, profile: VehicleProfile): Boolean {
        val db = getFirestore() ?: return false
        return runCatching {
            val docRef = db.collection("users").document(uid)
            val snap = docRef.get().await()
            val safePhoto = profile.avatarPhotoUri
                ?.takeIf { it.startsWith("http") && it.length <= 120_000 }
                ?: ""

            if (!snap.exists()) {
                val createData = hashMapOf(
                    "uid" to uid,
                    "email" to profile.email.trim().lowercase().take(160),
                    "authProvider" to profile.authProvider.id,
                    "fullName" to profile.fullName.trim().ifBlank { "Rider KonvoiKu" }.take(80),
                    "clubName" to profile.clubName.trim().take(80),
                    "homeCity" to profile.homeCity.trim().take(80),
                    "bio" to profile.bio.trim().take(240),
                    "instagramHandle" to profile.instagramHandle.trim().take(60),
                    "avatarPhotoUrl" to safePhoto,
                    "vehicleType" to profile.vehicleType.name,
                    "vehicleDetail" to profile.vehicleDetail.trim().take(80),
                    "licensePlate" to profile.licensePlate.trim().take(24),
                    "emergencyContact" to profile.emergencyContact.trim().take(40),
                    "avatarPreset" to profile.avatarPreset.name,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                docRef.set(createData).await()
            } else {
                val updateData = hashMapOf<String, Any>(
                    "email" to profile.email.trim().lowercase().take(160),
                    "authProvider" to profile.authProvider.id,
                    "fullName" to profile.fullName.trim().ifBlank { "Rider KonvoiKu" }.take(80),
                    "clubName" to profile.clubName.trim().take(80),
                    "homeCity" to profile.homeCity.trim().take(80),
                    "bio" to profile.bio.trim().take(240),
                    "instagramHandle" to profile.instagramHandle.trim().take(60),
                    "avatarPhotoUrl" to safePhoto,
                    "vehicleType" to profile.vehicleType.name,
                    "vehicleDetail" to profile.vehicleDetail.trim().take(80),
                    "licensePlate" to profile.licensePlate.trim().take(24),
                    "emergencyContact" to profile.emergencyContact.trim().take(40),
                    "avatarPreset" to profile.avatarPreset.name,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                docRef.update(updateData).await()
            }
            true
        }.getOrDefault(false)
    }

    suspend fun loadUserPrivateProfile(uid: String): VehicleProfile? {
        val db = getFirestore() ?: return null
        return runCatching {
            val snap = db.collection("users").document(uid).get().await()
            if (!snap.exists()) return@runCatching null
            VehicleProfile(
                fullName = snap.getString("fullName").orEmpty(),
                email = snap.getString("email").orEmpty().trim().lowercase(),
                authProvider = AuthProviderType.fromId(snap.getString("authProvider")),
                clubName = snap.getString("clubName").orEmpty(),
                homeCity = snap.getString("homeCity").orEmpty(),
                bio = snap.getString("bio").orEmpty(),
                instagramHandle = snap.getString("instagramHandle").orEmpty(),
                vehicleType = runCatching {
                    VehicleType.valueOf(snap.getString("vehicleType") ?: "MOBIL")
                }.getOrDefault(VehicleType.MOBIL),
                vehicleDetail = snap.getString("vehicleDetail").orEmpty(),
                licensePlate = snap.getString("licensePlate").orEmpty(),
                emergencyContact = snap.getString("emergencyContact").orEmpty(),
                avatarPreset = runCatching {
                    AvatarPreset.valueOf(snap.getString("avatarPreset") ?: "HELMET_TOURING")
                }.getOrDefault(AvatarPreset.HELMET_TOURING),
                avatarPhotoUri = snap.getString("avatarPhotoUrl")?.takeIf { it.isNotBlank() }
            )
        }.getOrNull()
    }

    suspend fun createSyncedRoom(
        roomId: String,
        roomTitle: String,
        leaderUid: String,
        profile: VehicleProfile,
        routeConfig: ConvoyRouteConfig,
        initialLat: Double,
        initialLng: Double
    ): Boolean {
        val db = getFirestore() ?: return false
        val origin = routeConfig.waypoints.firstOrNull()
        val dest = routeConfig.waypoints.lastOrNull()
        val encoded = GeoUtils.encodePolyline(
            routeConfig.waypoints.map { LatLngGeo(it.latitude, it.longitude) }
        ).take(16000)

        return runCatching {
            val roomData = hashMapOf(
                "roomId" to roomId,
                "roomTitle" to roomTitle.trim().ifBlank { "Konvoi Touring" }.take(100),
                "leaderUid" to leaderUid,
                "destinationName" to routeConfig.destinationName.take(120),
                "destinationAddress" to routeConfig.destinationAddress.take(240),
                "destLat" to (dest?.latitude ?: -6.645),
                "destLng" to (dest?.longitude ?: 106.99),
                "originLat" to (origin?.latitude ?: initialLat),
                "originLng" to (origin?.longitude ?: initialLng),
                "encodedPolyline" to encoded,
                "totalRouteMeters" to routeConfig.totalRouteMeters.coerceIn(100, 5_000_000),
                "offRouteToleranceMeters" to routeConfig.offRouteToleranceMeters.coerceIn(10, 5000),
                "maxStragglerDistanceMeters" to routeConfig.maxStragglerDistanceMeters.coerceIn(100, 50000),
                "soundAlertEnabled" to routeConfig.soundAlertEnabled,
                "status" to "ACTIVE",
                "sosActive" to false,
                "sosSenderUid" to "",
                "sosSenderName" to "",
                "sosSenderVehicle" to "",
                "sosLat" to 0.0,
                "sosLng" to 0.0,
                "sosLocationText" to "",
                "sosTriggeredAtLabel" to "",
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            db.collection("rooms").document(roomId).set(roomData).await()

            val memberData = hashMapOf(
                "uid" to leaderUid,
                "roomId" to roomId,
                "fullName" to profile.fullName.trim().ifBlank { "Tour Leader" }.take(80),
                "vehicleType" to profile.vehicleType.name,
                "vehicleDetail" to profile.displayVehicleLabel.take(80),
                "licensePlate" to profile.licensePlate.ifBlank { "B 1001 LDR" }.take(24),
                "role" to UserRole.TOUR_LEADER.name,
                "isSweeper" to false,
                "avatarPreset" to profile.avatarPreset.name,
                "conditionStatus" to MemberConditionStatus.AMAN.name,
                "connectionStatus" to ConnectionStatus.CONNECTED.name,
                "lastLocationText" to "GPS Aktif",
                "latitude" to initialLat,
                "longitude" to initialLng,
                "speedKmh" to 0,
                "heading" to 0,
                "accuracyMeters" to 15,
                "routeProgress" to 0.05,
                "xFraction" to 0.14,
                "yFraction" to 0.86,
                "joinedAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            db.collection("rooms").document(roomId)
                .collection("members").document(leaderUid)
                .set(memberData).await()

            routeConfig.checkpoints.forEach { cp ->
                addCheckpoint(roomId, leaderUid, cp)
            }
            true
        }.getOrDefault(false)
    }

    suspend fun joinSyncedRoom(
        roomId: String,
        uid: String,
        profile: VehicleProfile,
        initialLat: Double,
        initialLng: Double
    ): Result<UserRole> {
        val db = getFirestore() ?: return Result.failure(IllegalStateException("Firestore unavailable"))
        return runCatching {
            val snap = db.collection("rooms").document(roomId).get().await()
            if (!snap.exists()) {
                throw IllegalArgumentException("Room $roomId tidak ditemukan di server.")
            }
            val leaderUid = snap.getString("leaderUid").orEmpty()
            val role = if (leaderUid == uid) UserRole.TOUR_LEADER else UserRole.MEMBER

            val memberData = hashMapOf(
                "uid" to uid,
                "roomId" to roomId,
                "fullName" to profile.fullName.trim().ifBlank { "Anggota" }.take(80),
                "vehicleType" to profile.vehicleType.name,
                "vehicleDetail" to profile.displayVehicleLabel.take(80),
                "licensePlate" to profile.licensePlate.ifBlank { "B 2026 KNV" }.take(24),
                "role" to role.name,
                "isSweeper" to false,
                "avatarPreset" to profile.avatarPreset.name,
                "conditionStatus" to MemberConditionStatus.AMAN.name,
                "connectionStatus" to ConnectionStatus.CONNECTED.name,
                "lastLocationText" to "GPS Aktif",
                "latitude" to initialLat,
                "longitude" to initialLng,
                "speedKmh" to 0,
                "heading" to 0,
                "accuracyMeters" to 20,
                "routeProgress" to 0.05,
                "xFraction" to 0.2,
                "yFraction" to 0.8,
                "joinedAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            db.collection("rooms").document(roomId)
                .collection("members").document(uid)
                .set(memberData).await()
            role
        }
    }

    fun subscribeToRoom(
        roomId: String,
        currentUid: String,
        onRoomHeader: (SyncedRoomHeader) -> Unit,
        onMembers: (List<ConvoyMember>) -> Unit,
        onCheckpoints: (List<RestCheckpoint>) -> Unit,
        onMessages: (List<RoomMessage>) -> Unit
    ): () -> Unit {
        val db = getFirestore() ?: return {}
        val regs = mutableListOf<ListenerRegistration>()

        regs += db.collection("rooms").document(roomId)
            .addSnapshotListener { snap, _ ->
                if (snap == null || !snap.exists()) return@addSnapshotListener
                val decoded = GeoUtils.decodePolyline(snap.getString("encodedPolyline").orEmpty())
                val waypoints = if (decoded.size >= 2) {
                    GeoUtils.toRoutePoints(decoded)
                } else {
                    listOf(
                        com.konvoiku.touring.model.RoutePoint(
                            0.14f, 0.86f,
                            snap.getDouble("originLat") ?: -6.648,
                            snap.getDouble("originLng") ?: 106.845
                        ),
                        com.konvoiku.touring.model.RoutePoint(
                            0.86f, 0.14f,
                            snap.getDouble("destLat") ?: -6.7003,
                            snap.getDouble("destLng") ?: 106.996
                        )
                    )
                }
                val cfg = ConvoyRouteConfig(
                    destinationName = snap.getString("destinationName") ?: "Tujuan Konvoi",
                    destinationAddress = snap.getString("destinationAddress") ?: "",
                    waypoints = waypoints,
                    checkpoints = emptyList(),
                    totalRouteMeters = (snap.getLong("totalRouteMeters") ?: 12000L).toInt(),
                    offRouteToleranceMeters = (snap.getLong("offRouteToleranceMeters") ?: 75L).toInt(),
                    maxStragglerDistanceMeters = (snap.getLong("maxStragglerDistanceMeters") ?: 1000L).toInt(),
                    soundAlertEnabled = snap.getBoolean("soundAlertEnabled") ?: true
                )
                val sos = SosEmergencyState(
                    isActive = snap.getBoolean("sosActive") ?: false,
                    senderId = snap.getString("sosSenderUid") ?: "",
                    senderName = snap.getString("sosSenderName") ?: "",
                    senderVehicle = snap.getString("sosSenderVehicle") ?: "",
                    latitude = snap.getDouble("sosLat") ?: 0.0,
                    longitude = snap.getDouble("sosLng") ?: 0.0,
                    locationText = snap.getString("sosLocationText") ?: "",
                    triggeredAtLabel = snap.getString("sosTriggeredAtLabel") ?: ""
                )
                onRoomHeader(
                    SyncedRoomHeader(
                        roomId = snap.getString("roomId") ?: roomId,
                        roomTitle = snap.getString("roomTitle") ?: "Konvoi Live",
                        leaderUid = snap.getString("leaderUid") ?: "",
                        routeConfig = cfg,
                        sosState = sos
                    )
                )
            }

        regs += db.collection("rooms").document(roomId)
            .collection("members")
            .whereEqualTo("roomId", roomId)
            .addSnapshotListener { snap, _ ->
                if (snap == null) return@addSnapshotListener
                val members = snap.documents.mapIndexed { idx, doc ->
                    val uid = doc.getString("uid") ?: doc.id
                    ConvoyMember(
                        id = uid,
                        fullName = doc.getString("fullName") ?: "Rider",
                        vehicleType = runCatching {
                            VehicleType.valueOf(doc.getString("vehicleType") ?: "MOBIL")
                        }.getOrDefault(VehicleType.MOBIL),
                        vehicleDetail = doc.getString("vehicleDetail") ?: "",
                        licensePlate = doc.getString("licensePlate") ?: "",
                        emergencyContact = "",
                        role = runCatching {
                            UserRole.valueOf(doc.getString("role") ?: "MEMBER")
                        }.getOrDefault(UserRole.MEMBER),
                        joinedAtLabel = formatTimestamp(doc.getTimestamp("joinedAt"), "Aktif"),
                        isCurrentUser = uid == currentUid,
                        isSweeper = doc.getBoolean("isSweeper") ?: false,
                        avatarPreset = runCatching {
                            AvatarPreset.valueOf(doc.getString("avatarPreset") ?: "HELMET_TOURING")
                        }.getOrDefault(AvatarPreset.HELMET_TOURING),
                        conditionStatus = runCatching {
                            MemberConditionStatus.valueOf(doc.getString("conditionStatus") ?: "AMAN")
                        }.getOrDefault(MemberConditionStatus.AMAN),
                        connectionStatus = runCatching {
                            ConnectionStatus.valueOf(doc.getString("connectionStatus") ?: "CONNECTED")
                        }.getOrDefault(ConnectionStatus.CONNECTED),
                        lastLocationText = doc.getString("lastLocationText") ?: "GPS Live",
                        lastUpdatedLabel = formatTimestamp(doc.getTimestamp("updatedAt"), "Baru saja"),
                        convoyOrderRank = idx + 1,
                        mapPosition = MapPosition(
                            routeProgress = (doc.getDouble("routeProgress") ?: 0.05).toFloat(),
                            xFraction = (doc.getDouble("xFraction") ?: 0.5).toFloat(),
                            yFraction = (doc.getDouble("yFraction") ?: 0.5).toFloat(),
                            latitude = doc.getDouble("latitude") ?: -6.67,
                            longitude = doc.getDouble("longitude") ?: 106.92,
                            speedKmh = (doc.getLong("speedKmh") ?: 0L).toInt(),
                            heading = (doc.getLong("heading") ?: 0L).toInt(),
                            accuracyMeters = (doc.getLong("accuracyMeters") ?: 20L).toInt()
                        )
                    )
                }
                onMembers(members)
            }

        regs += db.collection("rooms").document(roomId)
            .collection("checkpoints")
            .whereEqualTo("roomId", roomId)
            .addSnapshotListener { snap, _ ->
                if (snap == null) return@addSnapshotListener
                val cps = snap.documents.map { doc ->
                    RestCheckpoint(
                        id = doc.getString("id") ?: doc.id,
                        name = doc.getString("name") ?: "Rest Area",
                        xFraction = (doc.getDouble("xFraction") ?: 0.5).toFloat(),
                        yFraction = (doc.getDouble("yFraction") ?: 0.5).toFloat(),
                        latitude = doc.getDouble("latitude") ?: -6.68,
                        longitude = doc.getDouble("longitude") ?: 106.92
                    )
                }
                onCheckpoints(cps)
            }

        regs += db.collection("rooms").document(roomId)
            .collection("messages")
            .whereEqualTo("roomId", roomId)
            .addSnapshotListener { snap, _ ->
                if (snap == null) return@addSnapshotListener
                val msgs = snap.documents.sortedBy {
                    it.getTimestamp("createdAt")?.toDate()?.time ?: 0L
                }.takeLast(80).map { doc ->
                    val senderUid = doc.getString("senderUid") ?: ""
                    RoomMessage(
                        id = doc.getString("id") ?: doc.id,
                        senderId = senderUid,
                        senderName = doc.getString("senderName") ?: "Rider",
                        senderVehicle = doc.getString("senderVehicle") ?: "",
                        type = runCatching {
                            ChatMessageType.valueOf(doc.getString("type") ?: "TEXT")
                        }.getOrDefault(ChatMessageType.TEXT),
                        textContent = doc.getString("textContent") ?: "",
                        timestampLabel = doc.getString("timestampLabel") ?: "Baru saja",
                        voiceDurationSec = (doc.getLong("voiceDurationSec") ?: 0L).toInt(),
                        isFromCurrentUser = senderUid == currentUid,
                        senderAvatarPreset = runCatching {
                            AvatarPreset.valueOf(doc.getString("senderAvatarPreset") ?: "HELMET_TOURING")
                        }.getOrDefault(AvatarPreset.HELMET_TOURING)
                    )
                }
                onMessages(msgs)
            }

        return { regs.forEach { it.remove() } }
    }

    fun publishTelemetry(
        roomId: String,
        uid: String,
        latitude: Double,
        longitude: Double,
        speedKmh: Int,
        heading: Int,
        accuracyMeters: Int,
        routeProgress: Float
    ) {
        val db = getFirestore() ?: return
        db.collection("rooms").document(roomId)
            .collection("members").document(uid)
            .update(
                mapOf(
                    "latitude" to latitude.coerceIn(-90.0, 90.0),
                    "longitude" to longitude.coerceIn(-180.0, 180.0),
                    "speedKmh" to speedKmh.coerceIn(0, 350),
                    "heading" to heading.coerceIn(0, 360),
                    "accuracyMeters" to accuracyMeters.coerceIn(0, 500_000),
                    "routeProgress" to routeProgress.toDouble().coerceIn(0.0, 1.0),
                    "lastLocationText" to "GPS Live (±${accuracyMeters}m)",
                    "connectionStatus" to ConnectionStatus.CONNECTED.name,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
    }

    fun updateRouteConfig(roomId: String, config: ConvoyRouteConfig) {
        val db = getFirestore() ?: return
        val dest = config.waypoints.lastOrNull()
        val encoded = GeoUtils.encodePolyline(
            config.waypoints.map { LatLngGeo(it.latitude, it.longitude) }
        ).take(16000)
        val updates = hashMapOf<String, Any>(
            "destinationName" to config.destinationName.take(120),
            "destinationAddress" to config.destinationAddress.take(240),
            "encodedPolyline" to encoded,
            "totalRouteMeters" to config.totalRouteMeters.coerceIn(100, 5_000_000),
            "offRouteToleranceMeters" to config.offRouteToleranceMeters.coerceIn(10, 5000),
            "maxStragglerDistanceMeters" to config.maxStragglerDistanceMeters.coerceIn(100, 50000),
            "soundAlertEnabled" to config.soundAlertEnabled,
            "updatedAt" to FieldValue.serverTimestamp()
        )
        if (dest != null) {
            updates["destLat"] = dest.latitude
            updates["destLng"] = dest.longitude
        }
        db.collection("rooms").document(roomId).update(updates)
    }

    fun addCheckpoint(roomId: String, uid: String, cp: RestCheckpoint) {
        val db = getFirestore() ?: return
        db.collection("rooms").document(roomId)
            .collection("checkpoints").document(cp.id)
            .set(
                mapOf(
                    "id" to cp.id,
                    "roomId" to roomId,
                    "createdByUid" to uid,
                    "name" to cp.name.take(100),
                    "latitude" to cp.latitude,
                    "longitude" to cp.longitude,
                    "xFraction" to cp.xFraction.toDouble().coerceIn(0.0, 1.0),
                    "yFraction" to cp.yFraction.toDouble().coerceIn(0.0, 1.0),
                    "createdAt" to FieldValue.serverTimestamp()
                )
            )
    }

    fun removeCheckpoint(roomId: String, checkpointId: String) {
        val db = getFirestore() ?: return
        db.collection("rooms").document(roomId)
            .collection("checkpoints").document(checkpointId)
            .delete()
    }

    fun sendMessage(roomId: String, senderUid: String, msg: RoomMessage) {
        val db = getFirestore() ?: return
        db.collection("rooms").document(roomId)
            .collection("messages").document(msg.id)
            .set(
                mapOf(
                    "id" to msg.id,
                    "roomId" to roomId,
                    "senderUid" to senderUid,
                    "senderName" to msg.senderName.take(80),
                    "senderVehicle" to msg.senderVehicle.take(80),
                    "senderAvatarPreset" to msg.senderAvatarPreset.name,
                    "type" to msg.type.name,
                    "textContent" to msg.textContent.take(500),
                    "voiceDurationSec" to msg.voiceDurationSec.coerceIn(0, 600),
                    "timestampLabel" to msg.timestampLabel.take(32),
                    "createdAt" to FieldValue.serverTimestamp()
                )
            )
    }

    fun triggerSos(roomId: String, sos: SosEmergencyState, uid: String) {
        val db = getFirestore() ?: return
        db.collection("rooms").document(roomId).update(
            mapOf(
                "sosActive" to true,
                "sosSenderUid" to uid,
                "sosSenderName" to sos.senderName.take(80),
                "sosSenderVehicle" to sos.senderVehicle.take(80),
                "sosLat" to sos.latitude,
                "sosLng" to sos.longitude,
                "sosLocationText" to sos.locationText.take(160),
                "sosTriggeredAtLabel" to sos.triggeredAtLabel.take(32),
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )
        updateMemberCondition(roomId, uid, MemberConditionStatus.SOS)
    }

    fun resolveSos(roomId: String, uid: String) {
        val db = getFirestore() ?: return
        db.collection("rooms").document(roomId).update(
            mapOf(
                "sosActive" to false,
                "sosSenderUid" to "",
                "sosSenderName" to "",
                "sosSenderVehicle" to "",
                "sosLat" to 0.0,
                "sosLng" to 0.0,
                "sosLocationText" to "",
                "sosTriggeredAtLabel" to "",
                "updatedAt" to FieldValue.serverTimestamp()
            )
        )
        updateMemberCondition(roomId, uid, MemberConditionStatus.AMAN)
    }

    fun updateMemberCondition(roomId: String, uid: String, status: MemberConditionStatus) {
        val db = getFirestore() ?: return
        db.collection("rooms").document(roomId)
            .collection("members").document(uid)
            .update(
                mapOf(
                    "conditionStatus" to status.name,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
    }

    fun assignSweeper(roomId: String, targetMemberUid: String, allMemberUids: List<String>) {
        val db = getFirestore() ?: return
        allMemberUids.forEach { memberUid ->
            db.collection("rooms").document(roomId)
                .collection("members").document(memberUid)
                .update(
                    mapOf(
                        "isSweeper" to (memberUid == targetMemberUid),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
        }
    }

    private fun formatTimestamp(ts: Timestamp?, fallback: String): String {
        val date: Date = ts?.toDate() ?: return fallback
        return SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
    }
}
