// Vercel / Netlify Serverless Proxy Function for Deployed Web Versions
import { Readable } from 'node:stream';

// High-End Security: SSRF Protection & IP Blacklisting
function isBlockedHost(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().trim();

  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host === '[::1]') {
    return true;
  }

  // IPv4 Loopback & Private ranges
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;

  const match172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const octet2 = parseInt(match172[1], 10);
    if (octet2 >= 16 && octet2 <= 31) return true;
  }

  // Cloud metadata & link-local
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;

  if (host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd00:')) {
    return true;
  }

  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.corp')) {
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  // Security & Preflight headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url: target } = req.query;
  if (!target) {
    return res.status(400).send('Missing "url" query parameter');
  }

  let parsedTarget;
  try {
    parsedTarget = new URL(target);
  } catch {
    return res.status(400).send('Invalid target URL');
  }

  // High-End Security: Protocol enforcement
  if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
    return res.status(403).send('Forbidden: Only HTTP and HTTPS protocols allowed');
  }

  // High-End Security: SSRF validation
  if (isBlockedHost(parsedTarget.hostname)) {
    return res.status(403).send('Forbidden: Access to private or local network resources is restricted');
  }

  try {
    const requestHeaders = {
      'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20 (Windows; x64)',
      'Accept': '*/*',
      'Referer': `${parsedTarget.protocol}//${parsedTarget.host}/`
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
      return res.status(upstreamRes.status).send(`Upstream returned ${upstreamRes.status}`);
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
          return trimmed.replace(/URI=(["']?)([^"',\s]+)\1/g, (match, quote, uri) => {
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

    // Binary media segments (.ts, .key, fmp4)
    res.setHeader('Content-Type', contentType || 'video/MP2T');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

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
