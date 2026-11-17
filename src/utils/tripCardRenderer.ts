import { TripCardTheme, TripHistoryRecord } from '../types/convoy';

interface RenderTripCardOptions {
  trip: TripHistoryRecord;
  theme: TripCardTheme;
  customPhotoUrl?: string;
  defaultScenicPhotoUrl: string;
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function renderTripCardPngBlob({
  trip,
  theme,
  customPhotoUrl,
  defaultScenicPhotoUrl,
}: RenderTripCardOptions): Promise<Blob> {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  const isLight = theme === 'MINIMAL_LIGHT';
  const primaryColor = isLight ? '#0F172A' : '#FFFFFF';
  const secondaryColor = isLight ? '#475569' : '#CBD5E1';
  const borderColor =
    theme === 'MINIMAL_LIGHT'
      ? '#CBD5E1'
      : theme === 'SATELLITE'
        ? '#1E4E45'
        : '#334155';

  // 1. Background Layer
  if (theme === 'DARK_CARBON') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#090E17');
    grad.addColorStop(0.55, '#111827');
    grad.addColorStop(1, '#172133');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x += 72) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 72) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const glow = ctx.createRadialGradient(
      width * 0.85,
      height * 0.16,
      10,
      width * 0.85,
      height * 0.16,
      width * 0.45
    );
    glow.addColorStop(0, 'rgba(234, 88, 12, 0.22)');
    glow.addColorStop(1, 'rgba(234, 88, 12, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  } else if (theme === 'SATELLITE') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0B1F1D');
    grad.addColorStop(0.5, '#112A2B');
    grad.addColorStop(1, '#0B1821');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(45, 212, 191, 0.12)';
    ctx.lineWidth = 3;
    for (let i = 1; i <= 6; i++) {
      ctx.beginPath();
      ctx.arc(width * 0.72, height * 0.42, width * 0.18 * i, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.setLineDash([18, 14]);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.25);
    ctx.lineTo(width, height * 0.76);
    ctx.stroke();
    ctx.restore();
  } else if (theme === 'MINIMAL_LIGHT') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x += 84) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 84) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  } else {
    const targetSrc = customPhotoUrl || defaultScenicPhotoUrl;
    const img = await loadImageElement(targetSrc);
    if (img) {
      const scale = Math.max(width / img.width, height / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      const ox = (width - sw) / 2;
      const oy = (height - sh) / 2;
      ctx.drawImage(img, ox, oy, sw, sh);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#312E81');
      grad.addColorStop(0.5, '#9A3412');
      grad.addColorStop(1, '#090D16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
    const scrim = ctx.createLinearGradient(0, 0, 0, height);
    scrim.addColorStop(0, 'rgba(0, 0, 0, 0.56)');
    scrim.addColorStop(0.45, 'rgba(0, 0, 0, 0.36)');
    scrim.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, width, height);
  }

  const pad = 72;

  // 2. Top Header: Brand Mark & Tour Leader Avatar
  drawRoundedRectPath(ctx, pad, pad, 72, 72, 20);
  ctx.fillStyle = '#EA580C';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(pad + 36, pad + 16);
  ctx.lineTo(pad + 56, pad + 54);
  ctx.lineTo(pad + 36, pad + 44);
  ctx.lineTo(pad + 16, pad + 54);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = primaryColor;
  ctx.font = '800 38px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('KonvoiKu', pad + 92, pad + 36);

  ctx.fillStyle = secondaryColor;
  ctx.font = '600 24px "JetBrains Mono", monospace';
  ctx.fillText(trip.roomId, pad + 92, pad + 68);

  const leader =
    trip.participants.find((p) => p.role === 'TOUR_LEADER') ??
    trip.participants[0];

  if (leader) {
    const avRadius = 40;
    const avCx = width - pad - avRadius;
    const avCy = pad + 36;

    const leaderImg = leader.avatarPhotoUrl
      ? await loadImageElement(leader.avatarPhotoUrl)
      : null;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avCx, avCy, avRadius, 0, Math.PI * 2);
    ctx.clip();
    if (leaderImg) {
      ctx.drawImage(
        leaderImg,
        avCx - avRadius,
        avCy - avRadius,
        avRadius * 2,
        avRadius * 2
      );
    } else {
      ctx.fillStyle =
        leader.avatarPreset === 'HELMET_SPORT'
          ? '#1D4ED8'
          : leader.avatarPreset === 'PILOT_CLASSIC'
            ? '#0F766E'
            : '#EA580C';
      ctx.fillRect(avCx - avRadius, avCy - avRadius, avRadius * 2, avRadius * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        (leader.fullName[0] || 'L').toUpperCase(),
        avCx,
        avCy + 2
      );
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(avCx, avCy, avRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = primaryColor;
    ctx.font = '700 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(leader.fullName, avCx - avRadius - 20, pad + 32);

    ctx.fillStyle = isLight ? '#1D4ED8' : '#FDBA74';
    ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Tour Leader', avCx - avRadius - 20, pad + 64);
    ctx.textAlign = 'left';
  }

  // 3. Tour Title & Date
  ctx.fillStyle = primaryColor;
  ctx.font = '700 52px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(trip.tourTitle, pad, 248, width - pad * 2);

  ctx.fillStyle = secondaryColor;
  ctx.font = '500 28px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `${trip.dateLabel} · ${trip.destinationName}`,
    pad,
    296,
    width - pad * 2
  );

  // 4. Polyline Map Area
  const mapLeft = pad;
  const mapTop = 350;
  const mapWidth = width - pad * 2;
  const mapHeight = 620;

  if (trip.waypoints.length >= 2) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(
      mapLeft + trip.waypoints[0].xFraction * mapWidth,
      mapTop + trip.waypoints[0].yFraction * mapHeight
    );
    for (let i = 1; i < trip.waypoints.length; i++) {
      ctx.lineTo(
        mapLeft + trip.waypoints[i].xFraction * mapWidth,
        mapTop + trip.waypoints[i].yFraction * mapHeight
      );
    }

    ctx.strokeStyle = isLight
      ? 'rgba(147, 197, 253, 0.5)'
      : 'rgba(234, 88, 12, 0.36)';
    ctx.lineWidth = 34;
    ctx.stroke();

    ctx.strokeStyle = isLight ? '#1D4ED8' : '#FB923C';
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.restore();
  }

  const startPt = trip.waypoints[0];
  if (startPt) {
    const cx = mapLeft + startPt.xFraction * mapWidth;
    const cy = mapTop + startPt.yFraction * mapHeight;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#EA580C';
    ctx.fill();
  }

  const endPt = trip.waypoints[trip.waypoints.length - 1];
  if (endPt) {
    const cx = mapLeft + endPt.xFraction * mapWidth;
    const cy = mapTop + endPt.yFraction * mapHeight;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#16A34A';
    ctx.fill();
  }

  trip.visitedCheckpoints.forEach((cp) => {
    const cx = mapLeft + cp.xFraction * mapWidth;
    const cy = mapTop + cp.yFraction * mapHeight;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#0F766E';
    ctx.fill();
  });

  // 5. Achievement Metrics Grid
  const colWidth = (width - pad * 2) / 4;
  const stats = [
    { label: 'Jarak', value: `${trip.distanceKm.toFixed(1)} km` },
    { label: 'Durasi', value: trip.durationLabel },
    { label: 'Rata-rata', value: `${trip.avgSpeedKmh} km/j` },
    { label: 'Checkpoint', value: `${trip.visitedCheckpoints.length} titik` },
  ];

  stats.forEach((item, idx) => {
    const x = pad + colWidth * idx;
    ctx.fillStyle = secondaryColor;
    ctx.font = '500 25px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(item.label, x, 1085);

    ctx.fillStyle = primaryColor;
    ctx.font = '700 40px "JetBrains Mono", monospace';
    ctx.fillText(item.value, x, 1140);
  });

  // Divider & Footer
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, 1190);
  ctx.lineTo(width - pad, 1190);
  ctx.stroke();

  ctx.fillStyle = secondaryColor;
  ctx.font = '500 26px "Plus Jakarta Sans", system-ui, sans-serif';
  const names = trip.participants
    .slice(0, 4)
    .map((p) => p.fullName)
    .join(', ');
  ctx.fillText(
    `${trip.participants.length} Peserta Konvoi · ${names}`,
    pad,
    1248,
    width - pad * 2
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Gagal merender kartu PNG'));
      },
      'image/png',
      1.0
    );
  });
}
