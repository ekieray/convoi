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

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'konvoiku' });
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
