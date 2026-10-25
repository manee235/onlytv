import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { Readable } from 'node:stream';

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

            // Fetch upstream stream with standard player headers
            const upstreamRes = await fetch(target, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': `${parsedTarget.protocol}//${parsedTarget.host}/`
              },
              redirect: 'follow'
            });

            if (!upstreamRes.ok) {
              res.statusCode = upstreamRes.status;
              return res.end(`Upstream returned status ${upstreamRes.status}`);
            }

            // CRITICAL: Use the final URL after all HTTP 301/302 redirects!
            const finalUrl = upstreamRes.url || target;
            const contentType = upstreamRes.headers.get('content-type') || '';
            const isM3u8 = contentType.includes('mpegurl') || 
                           contentType.includes('application/x-mpegURL') || 
                           finalUrl.includes('.m3u8') || 
                           finalUrl.includes('.m3u') ||
                           target.includes('.m3u8') || 
                           target.includes('.m3u');

            if (isM3u8) {
              res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
              const text = await upstreamRes.text();

              // Rewrite every relative and absolute media/segment URL to go back through /api/proxy
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

                // Leave other comments and directives as is
                if (trimmed.startsWith('#')) {
                  return line;
                }

                // It's a stream playlist or segment (.ts) chunk! Resolve against finalUrl
                try {
                  const absoluteUrl = new URL(trimmed, finalUrl).href;
                  return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
                } catch {
                  return line;
                }
              });

              return res.end(rewrittenLines.join('\n'));
            }

            // Binary media segment (.ts chunks, video, audio) - pipe stream directly
            res.setHeader('Content-Type', contentType || 'video/MP2T');
            res.setHeader('Accept-Ranges', 'bytes');
            if (upstreamRes.headers.get('content-length')) {
              res.setHeader('Content-Length', upstreamRes.headers.get('content-length'));
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
