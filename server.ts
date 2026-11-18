import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_FALLBACK_URL =
  'https://ais-dev-mbwxrxf647cphhl5i4ggug-588877716211.asia-southeast1.run.app';
const SHARED_FALLBACK_URL =
  'https://ais-pre-mbwxrxf647cphhl5i4ggug-588877716211.asia-southeast1.run.app';

function resolveBaseUrl(req: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  const forwardedProto = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host');
  if (host) {
    return `${forwardedProto}://${host}`;
  }
  return DEV_FALLBACK_URL;
}

function escapeHtmlLiteral(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());

  const DEFAULT_TOMTOM_TRIAL_KEY = 'fxxBdOwiITup2btha0dFUl6IOxczJm4f';
  const getTomTomApiKey = (): string =>
    process.env.TOMTOM_API_KEY?.trim() || DEFAULT_TOMTOM_TRIAL_KEY;

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'konvoiku' });
  });

  app.get('/api/tomtom/status', (_req: Request, res: Response) => {
    res.json({
      configured: Boolean(getTomTomApiKey()),
      provider: 'tomtom',
      mode: process.env.TOMTOM_API_KEY?.trim() ? 'env' : 'trial',
    });
  });

  // Proxy TomTom Raster Map, Satellite, Labels & Traffic Flow tiles
  app.get('/api/tomtom/tile/:layer/:style/:z/:x/:y', async (req: Request, res: Response) => {
    const { layer, style, z, x, y } = req.params;
    const allowedLayers = new Set(['basic', 'sat', 'labels', 'traffic']);
    const allowedStyles = new Set(['main', 'night', 'relative0']);
    if (
      !allowedLayers.has(layer) ||
      !allowedStyles.has(style) ||
      !/^\d+$/.test(z) ||
      !/^\d+$/.test(x) ||
      !/^\d+$/.test(y)
    ) {
      res.status(400).send('Invalid tile parameters');
      return;
    }

    const apiKey = getTomTomApiKey();
    let targetUrl = '';
    if (layer === 'traffic') {
      targetUrl = `https://api.tomtom.com/traffic/map/4/tile/flow/${style}/${z}/${x}/${y}.png?key=${encodeURIComponent(apiKey)}&tileSize=256`;
    } else if (layer === 'sat') {
      targetUrl = `https://api.tomtom.com/map/1/tile/sat/main/${z}/${x}/${y}.jpg?key=${encodeURIComponent(apiKey)}&tileSize=256`;
    } else {
      targetUrl = `https://api.tomtom.com/map/1/tile/${layer}/${style}/${z}/${x}/${y}.png?key=${encodeURIComponent(apiKey)}&tileSize=256`;
    }

    try {
      const upstream = await fetch(targetUrl);
      if (!upstream.ok) {
        res.status(upstream.status).send('TomTom tile unavailable');
        return;
      }
      const contentType =
        upstream.headers.get('content-type') ||
        (layer === 'sat' ? 'image/jpeg' : 'image/png');
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Cache-Control',
        layer === 'traffic' ? 'public, max-age=60' : 'public, max-age=3600'
      );
      res.send(buf);
    } catch {
      res.status(502).send('Failed to fetch TomTom tile');
    }
  });

  // Proxy TomTom Routing API (supports motorcycle/car & live traffic ETA)
  app.get('/api/tomtom/route', async (req: Request, res: Response) => {
    const points = typeof req.query.points === 'string' ? req.query.points.trim() : '';
    const travelMode =
      req.query.travelMode === 'car' ? 'car' : 'motorcycle';

    if (!points || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?(:-?\d+(\.\d+)?,-?\d+(\.\d+)?)+$/.test(points)) {
      res.status(400).json({ error: 'Format parameter points tidak valid.' });
      return;
    }

    const apiKey = getTomTomApiKey();
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${encodeURIComponent(points)}/json?key=${encodeURIComponent(apiKey)}&traffic=true&travelMode=${travelMode}&routeType=fastest`;

    try {
      const upstream = await fetch(url);
      if (upstream.status === 403 || upstream.status === 429) {
        res.status(429).json({
          quotaExceeded: true,
          error: 'Kuota harian TomTom API Trial tercapai.',
        });
        return;
      }
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Gagal menghitung rute TomTom.' });
        return;
      }

      const data = (await upstream.json()) as {
        routes?: Array<{
          summary?: {
            lengthInMeters?: number;
            travelTimeInSeconds?: number;
            trafficDelayInSeconds?: number;
          };
          legs?: Array<{
            points?: Array<{ latitude: number; longitude: number }>;
          }>;
        }>;
      };

      const route = data.routes?.[0];
      if (!route) {
        res.status(404).json({ error: 'Rute tidak ditemukan.' });
        return;
      }

      const pathPoints: Array<{ lat: number; lng: number }> = [];
      for (const leg of route.legs ?? []) {
        for (const pt of leg.points ?? []) {
          if (Number.isFinite(pt.latitude) && Number.isFinite(pt.longitude)) {
            pathPoints.push({ lat: pt.latitude, lng: pt.longitude });
          }
        }
      }

      res.json({
        distanceMeters: Number(route.summary?.lengthInMeters ?? 0),
        durationMillis: Number(route.summary?.travelTimeInSeconds ?? 0) * 1000,
        trafficDelaySeconds: Number(route.summary?.trafficDelayInSeconds ?? 0),
        path: pathPoints,
      });
    } catch {
      res.status(502).json({ error: 'Tidak dapat menghubungi TomTom Routing API.' });
    }
  });

  // Proxy TomTom Fuzzy Place Search (Indonesia prioritized)
  app.get('/api/tomtom/search', async (req: Request, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) {
      res.json({ results: [] });
      return;
    }

    const apiKey = getTomTomApiKey();
    const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(q)}.json?key=${encodeURIComponent(apiKey)}&countrySet=ID&limit=6&language=id-ID`;

    try {
      const upstream = await fetch(url);
      if (upstream.status === 403 || upstream.status === 429) {
        res.status(429).json({ quotaExceeded: true, results: [] });
        return;
      }
      if (!upstream.ok) {
        res.status(upstream.status).json({ results: [] });
        return;
      }
      const data = (await upstream.json()) as {
        results?: Array<{
          id?: string;
          poi?: { name?: string };
          address?: { freeformAddress?: string; municipality?: string };
          position?: { lat?: number; lon?: number };
        }>;
      };

      const results = (data.results ?? [])
        .filter((item) => item.position?.lat != null && item.position?.lon != null)
        .map((item, idx) => {
          const lat = Number(item.position!.lat);
          const lng = Number(item.position!.lon);
          const address =
            item.address?.freeformAddress ||
            item.address?.municipality ||
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          const name = item.poi?.name || address.split(',')[0] || 'Lokasi Dipilih';
          return {
            id: item.id || `${idx}-${lat}-${lng}`,
            name,
            address,
            lat,
            lng,
          };
        });

      res.json({ results });
    } catch {
      res.status(502).json({ results: [] });
    }
  });

  // Proxy TomTom Reverse Geocoding
  app.get('/api/tomtom/reverse', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Koordinat tidak valid.' });
      return;
    }

    const apiKey = getTomTomApiKey();
    const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${encodeURIComponent(apiKey)}&language=id-ID`;

    try {
      const upstream = await fetch(url);
      if (!upstream.ok) {
        res.status(upstream.status).json({
          name: `Titik Peta (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
          address: `Koordinat GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        });
        return;
      }
      const data = (await upstream.json()) as {
        addresses?: Array<{
          address?: {
            streetName?: string;
            street?: string;
            municipalitySecondarySubdivision?: string;
            municipality?: string;
            freeformAddress?: string;
          };
        }>;
      };
      const addr = data.addresses?.[0]?.address;
      const street = addr?.streetName || addr?.street || '';
      const area =
        addr?.municipalitySecondarySubdivision || addr?.municipality || '';
      const name =
        [street, area].filter(Boolean).join(', ') ||
        `Titik Peta (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
      const address =
        addr?.freeformAddress ||
        `${name} · ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      res.json({ name, address });
    } catch {
      res.json({
        name: `Titik Peta (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
        address: `Koordinat GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
    }
  });

  app.get('/api/auth/instagram/url', (req: Request, res: Response) => {
    const clientId = process.env.INSTAGRAM_CLIENT_ID?.trim();
    const baseUrl = resolveBaseUrl(req);
    const redirectUri = `${baseUrl}/auth/callback`;
    const callbackUrls = [
      `${DEV_FALLBACK_URL}/auth/callback`,
      `${SHARED_FALLBACK_URL}/auth/callback`,
    ];

    if (!clientId) {
      res.status(200).json({
        configured: false,
        redirectUri,
        callbackUrls,
        message:
          'INSTAGRAM_CLIENT_ID belum diatur di environment server AI Studio.',
      });
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: process.env.INSTAGRAM_OAUTH_SCOPE?.trim() || 'user_profile',
    });

    const providerAuthUrl =
      process.env.INSTAGRAM_AUTH_URL?.trim() ||
      'https://api.instagram.com/oauth/authorize';
    const authUrl = `${providerAuthUrl}?${params.toString()}`;

    res.json({
      configured: true,
      url: authUrl,
      redirectUri,
      callbackUrls,
    });
  });

  const handleInstagramCallback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const oauthError =
      typeof req.query.error_description === 'string'
        ? req.query.error_description
        : typeof req.query.error === 'string'
          ? req.query.error
          : '';

    const clientId = process.env.INSTAGRAM_CLIENT_ID?.trim();
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET?.trim();
    const redirectUri = `${resolveBaseUrl(req)}/auth/callback`;

    if (oauthError || !code) {
      const errMsg = oauthError || 'Kode otorisasi Instagram tidak ditemukan.';
      const safeJson = JSON.stringify({
        type: 'OAUTH_AUTH_ERROR',
        provider: 'instagram',
        error: errMsg,
      });
      res.status(400).send(`
        <!doctype html>
        <html lang="id">
          <body style="font-family:sans-serif;padding:24px;text-align:center;">
            <h3>Autentikasi Instagram Gagal</h3>
            <p>${escapeHtmlLiteral(errMsg)}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage(${safeJson}, '*');
                setTimeout(() => window.close(), 1200);
              }
            </script>
          </body>
        </html>
      `);
      return;
    }

    if (!clientId || !clientSecret) {
      const safeJson = JSON.stringify({
        type: 'OAUTH_AUTH_ERROR',
        provider: 'instagram',
        error: 'INSTAGRAM_CLIENT_ID / INSTAGRAM_CLIENT_SECRET belum dikonfigurasi.',
      });
      res.status(500).send(`
        <!doctype html>
        <html lang="id">
          <body style="font-family:sans-serif;padding:24px;text-align:center;">
            <h3>Konfigurasi Server Belum Lengkap</h3>
            <script>
              if (window.opener) {
                window.opener.postMessage(${safeJson}, '*');
                setTimeout(() => window.close(), 1200);
              }
            </script>
          </body>
        </html>
      `);
      return;
    }

    try {
      const formBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      });

      const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
      });

      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        user_id?: string | number;
        error_message?: string;
      };

      if (!tokenRes.ok || !tokenData.access_token) {
        throw new Error(
          tokenData.error_message || 'Gagal menukar token OAuth Instagram.'
        );
      }

      const profileRes = await fetch(
        `https://graph.instagram.com/me?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(tokenData.access_token)}`
      );
      const profileJson = (await profileRes.json()) as {
        id?: string;
        username?: string;
        name?: string;
        profile_picture_url?: string;
      };

      const username = profileJson.username || `ig_rider_${String(tokenData.user_id || '').slice(-4)}`;
      const fullName = profileJson.name || `@${username}`;
      const payload = {
        type: 'OAUTH_AUTH_SUCCESS',
        provider: 'instagram',
        profile: {
          id: String(profileJson.id || tokenData.user_id || ''),
          username,
          fullName,
          avatarPhotoUrl: profileJson.profile_picture_url || '',
        },
      };

      res.send(`
        <!doctype html>
        <html lang="id">
          <body style="font-family:sans-serif;padding:24px;text-align:center;">
            <h3>Instagram Terhubung!</h3>
            <p>Menyinkronkan akun @${escapeHtmlLiteral(username)} ke KonvoiKu...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage(${JSON.stringify(payload)}, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat memverifikasi akun Instagram.';
      res.status(500).send(`
        <!doctype html>
        <html lang="id">
          <body style="font-family:sans-serif;padding:24px;text-align:center;">
            <h3>Verifikasi Instagram Gagal</h3>
            <p>${escapeHtmlLiteral(message)}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage(${JSON.stringify({
                  type: 'OAUTH_AUTH_ERROR',
                  provider: 'instagram',
                  error: message,
                })}, '*');
                setTimeout(() => window.close(), 1500);
              }
            </script>
          </body>
        </html>
      `);
    }
  };

  app.get(['/auth/callback', '/auth/callback/'], handleInstagramCallback);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KonvoiKu server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KonvoiKu server:', err);
  process.exit(1);
});
