// Vercel / Netlify Serverless Proxy Function for Deployed Web Versions
import { Readable } from 'node:stream';

export default async function handler(req, res) {
  // Preflight and CORS headers for web deployments
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url: target } = req.query;
  if (!target) {
    return res.status(400).send('Missing "url" query parameter');
  }

  try {
    const parsedTarget = new URL(target);
    const requestHeaders = {
      'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20 (Windows; x64)',
      'Accept': '*/*',
      'Referer': `${parsedTarget.protocol}//${parsedTarget.host}/`
    };

    if (req.headers.range) {
      requestHeaders['Range'] = req.headers.range;
    }

    const upstreamRes = await fetch(target, {
      headers: requestHeaders,
      redirect: 'follow'
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).send(`Upstream returned ${upstreamRes.status}`);
    }

    const finalUrl = upstreamRes.url || target;
    const contentType = upstreamRes.headers.get('content-type') || '';
    const isM3u = contentType.includes('mpegurl') || 
                  finalUrl.includes('.m3u8') || 
                  finalUrl.includes('.m3u') ||
                  target.includes('.m3u8') || 
                  target.includes('.m3u');

    if (isM3u) {
      const text = await upstreamRes.text();
      const isIptvPlaylist = text.includes('#EXTINF:') && 
                             !text.includes('#EXT-X-TARGETDURATION') && 
                             !text.includes('#EXT-X-STREAM-INF') &&
                             !text.includes('#EXT-X-MEDIA-SEQUENCE');

      if (isIptvPlaylist) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).send(text);
      }

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      const lines = text.split(/\r?\n/);
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

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

        if (trimmed.startsWith('#')) return line;

        try {
          const absoluteUrl = new URL(trimmed, finalUrl).href;
          return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        } catch {
          return line;
        }
      });

      return res.status(200).send(rewrittenLines.join('\n'));
    }

    // Binary media segments (.ts, fmp4)
    res.setHeader('Content-Type', contentType || 'video/MP2T');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=1800');

    if (upstreamRes.headers.get('content-length')) {
      res.setHeader('Content-Length', upstreamRes.headers.get('content-length'));
    }
    if (upstreamRes.headers.get('content-range')) {
      res.setHeader('Content-Range', upstreamRes.headers.get('content-range'));
      res.status(206);
    } else {
      res.status(200);
    }

    if (upstreamRes.body) {
      const nodeStream = Readable.fromWeb(upstreamRes.body);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error('[Serverless Proxy Error]', err.message);
    res.status(502).send(`Proxy error: ${err.message}`);
  }
}
