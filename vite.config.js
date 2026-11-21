import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { Readable } from 'node:stream';

// High-End Security: SSRF (Server-Side Request Forgery) protection & IP blacklisting
function isBlockedHost(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().trim();

  // Localhost, 0.0.0.0 and IPv6 loopback
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host === '[::1]') {
    return true;
  }

  // 127.0.0.0/8 (IPv4 Loopback)
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // 10.0.0.0/8 (Private Network)
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // 192.168.0.0/16 (Private Network)
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // 172.16.0.0/12 (Private Network: 172.16.x.x - 172.31.x.x)
  const match172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const octet2 = parseInt(match172[1], 10);
    if (octet2 >= 16 && octet2 <= 31) return true;
  }
  // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Cloud Metadata: 169.254.169.254)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  // 100.64.0.0/10 (Shared Address Space / CGNAT)
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;

  // IPv6 local & link-local
  if (host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd00:')) {
    return true;
  }

  // Internal and local domains
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.corp')) {
    return true;
  }

  return false;
}

export default defineConfig({
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https: http:; media-src 'self' blob: data: https: http:; img-src 'self' data: blob: https: http:; connect-src 'self' blob: data: https: http:; worker-src 'self' blob:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; frame-ancestors 'self';"
    }
  },
  plugins: [
    react(),
    {
      name: 'vlc-cors-stream-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/proxy')) {
            return next();
          }

          // Security & CORS Headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('X-Frame-Options', 'SAMEORIGIN');

          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            return res.end();
          }

          try {
            const parsedReq = new URL(req.url, 'http://localhost');
            const target = parsedReq.searchParams.get('url');

            if (!target) {
              res.statusCode = 400;
              return res.end('Missing "url" query parameter');
            }

            let parsedTarget;
            try {
              parsedTarget = new URL(target);
            } catch {
              res.statusCode = 400;
              return res.end('Invalid URL parameter');
            }

            // High-End Security: Enforce valid HTTP/HTTPS protocol
            if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
              res.statusCode = 403;
              return res.end('Forbidden: Only HTTP and HTTPS protocols allowed');
            }

            // High-End Security: SSRF Protection
            if (isBlockedHost(parsedTarget.hostname)) {
              res.statusCode = 403;
              return res.end('Forbidden: Access to private or local network resources is restricted');
            }

            // VLC-optimized forward request headers
            const requestHeaders = {
              'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20 (Windows; x64)',
              'Accept': '*/*',
              'Referer': `${parsedTarget.protocol}//${parsedTarget.host}/`,
              'Connection': 'keep-alive'
            };

            if (req.headers.range) {
              requestHeaders['Range'] = req.headers.range;
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 18000);

            const upstreamRes = await fetch(target, {
              headers: requestHeaders,
              redirect: 'follow',
              signal: controller.signal
            }).finally(() => clearTimeout(timeout));

            if (!upstreamRes.ok && upstreamRes.status !== 206) {
              res.statusCode = upstreamRes.status;
              return res.end(`Upstream returned status ${upstreamRes.status}`);
            }

            const finalUrl = upstreamRes.url || target;
            const contentType = upstreamRes.headers.get('content-type') || '';
            const isM3u = contentType.includes('mpegurl') || 
                          contentType.includes('application/x-mpegURL') || 
                          finalUrl.includes('.m3u8') || 
                          finalUrl.includes('.m3u') ||
                          target.includes('.m3u8') || 
                          target.includes('.m3u');

            if (isM3u) {
              const text = await upstreamRes.text();

              // If it's a playlist of multiple channels (e.g. index.m3u), return raw text
              const isIptvPlaylist = text.includes('#EXTINF:') && 
                                     !text.includes('#EXT-X-TARGETDURATION') && 
                                     !text.includes('#EXT-X-STREAM-INF') &&
                                     !text.includes('#EXT-X-MEDIA-SEQUENCE');

              if (isIptvPlaylist) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=300');
                return res.end(text);
              }

              // HLS Stream Manifest: rewrite sub-playlists, AES keys, and .ts segments for zero-CORS streaming
              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

              const lines = text.split(/\r?\n/);
              const rewrittenLines = lines.map(line => {
                const trimmed = line.trim();
                if (!trimmed) return line;

                // Rewrite any directive with URI="..." or URI=... (like #EXT-X-KEY or #EXT-X-MEDIA)
                if (trimmed.startsWith('#EXT') && trimmed.includes('URI=')) {
                  return trimmed.replace(/URI=(["']?)([^"',\s]+)\1/g, (match, quote, uri) => {
                    try {
                      const absoluteUri = new URL(uri, finalUrl).href;
                      return `URI="/api/proxy?url=${encodeURIComponent(absoluteUri)}"`;
                    } catch {
                      return match;
                    }
                  });
                }

                if (trimmed.startsWith('#')) {
                  return line;
                }

                // Rewrite stream playlist or segment (.ts / .key / chunks) resolved against finalUrl
                try {
                  const absoluteUrl = new URL(trimmed, finalUrl).href;
                  return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                } catch {
                  return line;
                }
              });

              return res.end(rewrittenLines.join('\n'));
            }

            // Binary media segment (.ts chunks, AES keys, audio, fmp4) - stream directly
            res.setHeader('Content-Type', contentType || 'video/MP2T');
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=3600');

            if (upstreamRes.headers.get('content-length')) {
              res.setHeader('Content-Length', upstreamRes.headers.get('content-length'));
            }
            if (upstreamRes.headers.get('content-range')) {
              res.setHeader('Content-Range', upstreamRes.headers.get('content-range'));
              res.statusCode = 206;
            }

            if (upstreamRes.body) {
              const nodeStream = Readable.fromWeb(upstreamRes.body);
              nodeStream.on('error', (err) => {
                console.error('[Stream Pipe Error]', err.message);
                if (!res.headersSent) res.statusCode = 502;
                res.end();
              });
              nodeStream.pipe(res);
            } else {
              res.end();
            }

          } catch (err) {
            console.error('[Stream Proxy Error]', err.message);
            if (!res.headersSent) {
              res.statusCode = 502;
              return res.end(`Stream proxy error: ${err.message}`);
            }
            res.end();
          }
        });
      }
    }
  ]
});
