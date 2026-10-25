import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { Readable } from 'node:stream';
import http from 'node:http';
import https from 'node:https';

// Fast TCP/TLS Connection Pools for VLC-grade low-latency streaming
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 32 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 32 });

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vlc-cors-stream-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/proxy')) {
            return next();
          }

          // Handle preflight CORS requests
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

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

            const parsedTarget = new URL(target);
            const isHttps = parsedTarget.protocol === 'https:';

            // Forward range requests if scrubbing or segmented
            const requestHeaders = {
              'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20 (Windows; x64)',
              'Accept': '*/*',
              'Referer': `${parsedTarget.protocol}//${parsedTarget.host}/`,
              'Connection': 'keep-alive'
            };

            if (req.headers.range) {
              requestHeaders['Range'] = req.headers.range;
            }

            const upstreamRes = await fetch(target, {
              headers: requestHeaders,
              redirect: 'follow'
            });

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

              // If it's a playlist of multiple channels (e.g. index.m3u), return raw text untouched
              const isIptvPlaylist = text.includes('#EXTINF:') && 
                                     !text.includes('#EXT-X-TARGETDURATION') && 
                                     !text.includes('#EXT-X-STREAM-INF') &&
                                     !text.includes('#EXT-X-MEDIA-SEQUENCE');

              if (isIptvPlaylist) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Cache-Control', 'public, max-age=300');
                return res.end(text);
              }

              // HLS Stream Manifest: rewrite sub-playlists and .ts segments for zero-CORS streaming
              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

              const lines = text.split(/\r?\n/);
              const rewrittenLines = lines.map(line => {
                const trimmed = line.trim();
                if (!trimmed) return line;

                // Rewrite any directive that has a URI="..." (like #EXT-X-MEDIA or #EXT-X-KEY)
                if (trimmed.startsWith('#EXT') && trimmed.includes('URI=')) {
                  return trimmed.replace(/URI=["']([^"']+)["']/g, (match, uri) => {
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

                // Rewrite stream playlist or segment (.ts) chunk resolved against finalUrl
                try {
                  const absoluteUrl = new URL(trimmed, finalUrl).href;
                  return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                } catch {
                  return line;
                }
              });

              return res.end(rewrittenLines.join('\n'));
            }

            // Binary media segment (.ts chunks, audio, video) - stream with chunk caching
            res.setHeader('Content-Type', contentType || 'video/MP2T');
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=1800'); // Cache static video segments for instant rewind/scrub

            if (upstreamRes.headers.get('content-length')) {
              res.setHeader('Content-Length', upstreamRes.headers.get('content-length'));
            }
            if (upstreamRes.headers.get('content-range')) {
              res.setHeader('Content-Range', upstreamRes.headers.get('content-range'));
              res.statusCode = 206;
            }

            if (upstreamRes.body) {
              const nodeStream = Readable.fromWeb(upstreamRes.body);
              nodeStream.pipe(res);
            } else {
              res.end();
            }

          } catch (err) {
            console.error('[Stream Proxy Error]', err.message);
            res.statusCode = 502;
            return res.end(`Stream proxy error: ${err.message}`);
          }
        });
      }
    }
  ]
});
