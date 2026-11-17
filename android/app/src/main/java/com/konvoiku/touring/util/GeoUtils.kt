package com.konvoiku.touring.util

import com.konvoiku.touring.model.RoutePoint
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

data class LatLngGeo(val lat: Double, val lng: Double)

data class RouteEvaluationResult(
    val routeProgress: Float,
    val distanceTraveledMeters: Int,
    val remainingMeters: Int,
    val offRouteMeters: Int
)

object GeoUtils {
    private const val EARTH_RADIUS_METERS = 6_371_000.0

    fun haversineMeters(a: LatLngGeo, b: LatLngGeo): Double {
        val dLat = Math.toRadians(b.lat - a.lat)
        val dLng = Math.toRadians(b.lng - a.lng)
        val lat1 = Math.toRadians(a.lat)
        val lat2 = Math.toRadians(b.lat)

        val sinDLat = sin(dLat / 2.0)
        val sinDLng = sin(dLng / 2.0)
        val h = sinDLat * sinDLat + cos(lat1) * cos(lat2) * sinDLng * sinDLng
        return 2.0 * EARTH_RADIUS_METERS * asin(min(1.0, sqrt(h)))
    }

    fun evaluatePositionAlongRoute(
        pos: LatLngGeo,
        waypoints: List<RoutePoint>,
        totalRouteMetersFallback: Int = 12000
    ): RouteEvaluationResult {
        if (waypoints.size < 2) {
            val dest = waypoints.firstOrNull()
            val dist = if (dest != null) {
                haversineMeters(pos, LatLngGeo(dest.latitude, dest.longitude)).roundToInt()
            } else 0
            return RouteEvaluationResult(
                routeProgress = 0f,
                distanceTraveledMeters = 0,
                remainingMeters = dist,
                offRouteMeters = dist
            )
        }

        val refLatRad = Math.toRadians(waypoints.first().latitude)
        val metersPerDegLat = 111_132.92
        val metersPerDegLng = 111_412.84 * cos(refLatRad)

        fun toXY(pt: LatLngGeo): Pair<Double, Double> =
            (pt.lng - waypoints.first().longitude) * metersPerDegLng to
                (pt.lat - waypoints.first().latitude) * metersPerDegLat

        val (px, py) = toXY(pos)
        var cumulative = 0.0
        val segStarts = DoubleArray(waypoints.size - 1)
        val segLengths = DoubleArray(waypoints.size - 1)

        for (i in 0 until waypoints.size - 1) {
            segStarts[i] = cumulative
            val len = haversineMeters(
                LatLngGeo(waypoints[i].latitude, waypoints[i].longitude),
                LatLngGeo(waypoints[i + 1].latitude, waypoints[i + 1].longitude)
            )
            segLengths[i] = len
            cumulative += len
        }

        val totalMeters = cumulative.coerceAtLeast(totalRouteMetersFallback.toDouble()).coerceAtLeast(100.0)
        var minPerpMeters = Double.MAX_VALUE
        var bestTraveled = 0.0

        for (i in 0 until waypoints.size - 1) {
            val (ax, ay) = toXY(LatLngGeo(waypoints[i].latitude, waypoints[i].longitude))
            val (bx, by) = toXY(LatLngGeo(waypoints[i + 1].latitude, waypoints[i + 1].longitude))
            val abx = bx - ax
            val aby = by - ay
            val abLenSq = abx * abx + aby * aby
            val t = if (abLenSq > 0.0) {
                (((px - ax) * abx + (py - ay) * aby) / abLenSq).coerceIn(0.0, 1.0)
            } else 0.0
            val projX = ax + t * abx
            val projY = ay + t * aby
            val perp = hypot(px - projX, py - projY)
            if (perp < minPerpMeters) {
                minPerpMeters = perp
                bestTraveled = segStarts[i] + t * segLengths[i]
            }
        }

        val progress = (bestTraveled / totalMeters).toFloat().coerceIn(0f, 1f)
        val remaining = (totalMeters - bestTraveled).roundToInt().coerceAtLeast(0)
        return RouteEvaluationResult(
            routeProgress = progress,
            distanceTraveledMeters = bestTraveled.roundToInt(),
            remainingMeters = remaining,
            offRouteMeters = if (minPerpMeters == Double.MAX_VALUE) 0 else minPerpMeters.roundToInt()
        )
    }

    fun computeBearingDegrees(a: LatLngGeo, b: LatLngGeo): Int {
        val lat1 = Math.toRadians(a.lat)
        val lat2 = Math.toRadians(b.lat)
        val dLng = Math.toRadians(b.lng - a.lng)
        val y = sin(dLng) * cos(lat2)
        val x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLng)
        return ((Math.toDegrees(atan2(y, x)) + 360.0) % 360.0).roundToInt()
    }

    fun encodePolyline(points: List<LatLngGeo>): String {
        var lastLat = 0
        var lastLng = 0
        val out = StringBuilder()

        fun encodeValue(v: Int) {
            var value = if (v < 0) (v shl 1).inv() else v shl 1
            while (value >= 0x20) {
                out.append(((0x20 or (value and 0x1f)) + 63).toChar())
                value = value shr 5
            }
            out.append((value + 63).toChar())
        }

        for (pt in points) {
            val lat = (pt.lat * 1e5).roundToInt()
            val lng = (pt.lng * 1e5).roundToInt()
            encodeValue(lat - lastLat)
            encodeValue(lng - lastLng)
            lastLat = lat
            lastLng = lng
        }
        return out.toString()
    }

    fun decodePolyline(encoded: String): List<LatLngGeo> {
        if (encoded.isBlank()) return emptyList()
        val points = mutableListOf<LatLngGeo>()
        var index = 0
        var lat = 0
        var lng = 0
        while (index < encoded.length) {
            var b: Int
            var shift = 0
            var result = 0
            do {
                b = encoded[index++].code - 63
                result = result or ((b and 0x1f) shl shift)
                shift += 5
            } while (b >= 0x20 && index < encoded.length)
            val dLat = if ((result and 1) != 0) (result shr 1).inv() else result shr 1
            lat += dLat

            shift = 0
            result = 0
            do {
                b = encoded[index++].code - 63
                result = result or ((b and 0x1f) shl shift)
                shift += 5
            } while (b >= 0x20 && index < encoded.length)
            val dLng = if ((result and 1) != 0) (result shr 1).inv() else result shr 1
            lng += dLng

            points.add(LatLngGeo(lat / 1e5, lng / 1e5))
        }
        return points
    }

    fun toRoutePoints(points: List<LatLngGeo>): List<RoutePoint> {
        if (points.isEmpty()) return emptyList()
        var minLat = Double.POSITIVE_INFINITY
        var maxLat = Double.NEGATIVE_INFINITY
        var minLng = Double.POSITIVE_INFINITY
        var maxLng = Double.NEGATIVE_INFINITY
        for (pt in points) {
            if (pt.lat < minLat) minLat = pt.lat
            if (pt.lat > maxLat) maxLat = pt.lat
            if (pt.lng < minLng) minLng = pt.lng
            if (pt.lng > maxLng) maxLng = pt.lng
        }
        val latSpan = (maxLat - minLat).coerceAtLeast(0.01)
        val lngSpan = (maxLng - minLng).coerceAtLeast(0.01)
        return points.map { pt ->
            RoutePoint(
                xFraction = (0.1 + ((pt.lng - minLng) / lngSpan) * 0.8).toFloat().coerceIn(0.08f, 0.92f),
                yFraction = (0.9 - ((pt.lat - minLat) / latSpan) * 0.8).toFloat().coerceIn(0.08f, 0.90f),
                latitude = pt.lat,
                longitude = pt.lng
            )
        }
    }
}
