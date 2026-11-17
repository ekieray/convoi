import { TripHistoryRecord } from '../types/convoy';

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildTripGpxXml(trip: TripHistoryRecord): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="KonvoiKu Touring App" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${escapeXml(trip.tourTitle)} (${escapeXml(trip.roomId)})</name>`,
    `    <desc>Konvoi Touring menuju ${escapeXml(trip.destinationName)} · ${trip.distanceKm.toFixed(1)} km · Rata-rata ${trip.avgSpeedKmh} km/j</desc>`,
    '  </metadata>',
  ];

  const start = trip.waypoints[0];
  if (start) {
    lines.push(
      `  <wpt lat="${start.latitude.toFixed(6)}" lon="${start.longitude.toFixed(6)}">`,
      '    <name>Titik Mulai Konvoi</name>',
      '    <type>Start</type>',
      '  </wpt>'
    );
  }

  trip.visitedCheckpoints.forEach((cp) => {
    lines.push(
      `  <wpt lat="${cp.latitude.toFixed(6)}" lon="${cp.longitude.toFixed(6)}">`,
      `    <name>${escapeXml(cp.name)}</name>`,
      `    <desc>Titik Istirahat · Tiba ${escapeXml(cp.arrivedAtLabel)}</desc>`,
      '    <type>Rest Area</type>',
      '  </wpt>'
    );
  });

  const end = trip.waypoints[trip.waypoints.length - 1];
  if (end) {
    lines.push(
      `  <wpt lat="${end.latitude.toFixed(6)}" lon="${end.longitude.toFixed(6)}">`,
      `    <name>Tujuan: ${escapeXml(trip.destinationName)}</name>`,
      `    <desc>${escapeXml(trip.destinationAddress)}</desc>`,
      '    <type>Destination</type>',
      '  </wpt>'
    );
  }

  lines.push('  <trk>', `    <name>${escapeXml(trip.tourTitle)}</name>`, '    <trkseg>');
  trip.waypoints.forEach((pt) => {
    lines.push(
      `      <trkpt lat="${pt.latitude.toFixed(6)}" lon="${pt.longitude.toFixed(6)}"/>`
    );
  });
  lines.push('    </trkseg>', '  </trk>', '</gpx>');

  return lines.join('\n');
}

export function buildTripJsonLog(trip: TripHistoryRecord): string {
  return JSON.stringify(
    {
      app: 'KonvoiKu',
      roomId: trip.roomId,
      tourTitle: trip.tourTitle,
      date: trip.dateLabel,
      timeRange: trip.timeRangeLabel,
      duration: trip.durationLabel,
      distanceKm: Number(trip.distanceKm.toFixed(1)),
      avgSpeedKmh: trip.avgSpeedKmh,
      maxSpeedKmh: trip.maxSpeedKmh,
      destination: trip.destinationName,
      userRole: trip.userRole === 'TOUR_LEADER' ? 'Tour Leader' : 'Anggota',
      participants: trip.participants.map((p) => ({
        name: p.fullName,
        role: p.role === 'TOUR_LEADER' ? 'Tour Leader' : 'Anggota',
        vehicle: p.vehicleDetail,
        plate: p.licensePlate,
        sweeper: Boolean(p.isSweeper),
      })),
      checkpoints: trip.visitedCheckpoints.map((cp) => ({
        name: cp.name,
        arrivedAt: cp.arrivedAtLabel,
        lat: Number(cp.latitude.toFixed(6)),
        lng: Number(cp.longitude.toFixed(6)),
      })),
      trackPoints: trip.waypoints.map((pt) => ({
        lat: Number(pt.latitude.toFixed(6)),
        lng: Number(pt.longitude.toFixed(6)),
      })),
    },
    null,
    2
  );
}

export function buildTripShareSummaryText(trip: TripHistoryRecord): string {
  const cpText =
    trip.visitedCheckpoints.length === 0
      ? 'Tidak ada perhentian khusus'
      : trip.visitedCheckpoints
          .map((cp) => `${cp.name} (${cp.arrivedAtLabel})`)
          .join(', ');
  const memberText = trip.participants.map((p) => p.fullName).join(', ');
  return [
    '🏁 REKAP TOUR KONVOIKU',
    `Tour: ${trip.tourTitle} (${trip.roomId})`,
    `Tanggal: ${trip.dateLabel} (${trip.timeRangeLabel})`,
    `Tujuan: ${trip.destinationName}`,
    `Jarak Tempuh: ${trip.distanceKm.toFixed(1)} km · Durasi: ${trip.durationLabel}`,
    `Kecepatan Rata-rata: ${trip.avgSpeedKmh} km/j (Maks ${trip.maxSpeedKmh} km/j)`,
    `Titik Istirahat: ${cpText}`,
    `Peserta (${trip.participants.length}): ${memberText}`,
  ].join('\n');
}

export function triggerFileDownload(
  filename: string,
  content: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
