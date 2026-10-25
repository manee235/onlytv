/**
 * Robust M3U and IPTV Playlist Parser for OnlyTV Web Player
 */

export const DEFAULT_IPTV_URL = "https://iptv-org.github.io/iptv/index.m3u";

export const SAMPLE_PLAYLISTS = [
  {
    name: "Global IPTV Index (iptv-org)",
    description: "Default worldwide TV channel index from IPTV-Org",
    url: DEFAULT_IPTV_URL,
    category: "Worldwide",
    count: "~11,000+ channels"
  },
  {
    name: "Global Free News (IPTV-Org)",
    description: "24/7 International news channels (Bloomberg, DW, France 24, Sky, etc.)",
    url: "https://iptv-org.github.io/iptv/categories/news.m3u",
    category: "News",
    count: "~150 channels"
  },
  {
    name: "General Entertainment (IPTV-Org)",
    description: "Curated worldwide entertainment and general interest streams",
    url: "https://iptv-org.github.io/iptv/categories/general.m3u",
    category: "Entertainment",
    count: "~120 channels"
  },
  {
    name: "Music & Live Concerts",
    description: "Global music TV, EDM, jazz, and pop live broadcasts",
    url: "https://iptv-org.github.io/iptv/categories/music.m3u",
    category: "Music",
    count: "~90 channels"
  },
  {
    name: "Sports Highlights & Live",
    description: "Sports news, racing, extreme sports, and community athletic streams",
    url: "https://iptv-org.github.io/iptv/categories/sports.m3u",
    category: "Sports",
    count: "~60 channels"
  },
  {
    name: "Demo HLS & Multi-Bitrate Streams",
    description: "Ultra-fast verified test streams (Mux, Apple, Akamai, Tears of Steel)",
    url: "DEMO_INTERNAL",
    category: "Demo",
    count: "6 channels"
  }
];

export const DEMO_CHANNELS = [
  {
    id: "demo-mux-1",
    name: "Mux Big Buck Bunny (Adaptive HLS)",
    group: "Movies & Demo",
    logo: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=120&auto=format&fit=crop&q=80",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    quality: "1080p Multi-bitrate",
    isLive: false
  },
  {
    id: "demo-apple-bipbop",
    name: "Apple BipBop 16x9 Advanced Test",
    group: "Technical Test",
    logo: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=120&auto=format&fit=crop&q=80",
    url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8",
    quality: "720p HLS",
    isLive: false
  },
  {
    id: "demo-tears-of-steel",
    name: "Tears of Steel (Blender Open Movie)",
    group: "Movies & Demo",
    logo: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=120&auto=format&fit=crop&q=80",
    url: "https://test-streams.mux.dev/tos_hls/master.m3u8",
    quality: "1080p HLS",
    isLive: false
  },
  {
    id: "demo-redbull-tv",
    name: "Red Bull TV Live Extreme Sports",
    group: "Sports",
    logo: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=120&auto=format&fit=crop&q=80",
    url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8",
    quality: "1080p 60fps",
    isLive: true
  },
  {
    id: "demo-nasa-tv",
    name: "NASA TV Public HD Live Stream",
    group: "Science & Space",
    logo: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=120&auto=format&fit=crop&q=80",
    url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
    quality: "720p HD",
    isLive: true
  }
];

/**
 * Cleanly unwrap and return a stream URL without nested proxy paths
 */
export function unwrapStreamUrl(url) {
  if (!url) return "";
  let clean = url.trim();

  // If URL has an embedded /api/proxy?url=
  const match = clean.match(/api\/proxy\?url=(.+)$/i);
  if (match && match[1]) {
    try {
      clean = decodeURIComponent(match[1]);
    } catch {
      clean = match[1];
    }
  }

  // If URL has corsproxy.io/?url=
  const corsMatch = clean.match(/corsproxy\.io\/\?url=(.+)$/i);
  if (corsMatch && corsMatch[1]) {
    try {
      clean = decodeURIComponent(corsMatch[1]);
    } catch {
      clean = corsMatch[1];
    }
  }

  return clean;
}

/**
 * Returns a proxy URL that bypasses CORS restrictions
 */
export function getProxiedStreamUrl(streamUrl) {
  if (!streamUrl) return "";
  const cleanUrl = unwrapStreamUrl(streamUrl);
  if (!cleanUrl) return "";
  return `/api/proxy?url=${encodeURIComponent(cleanUrl)}`;
}

/**
 * Parses raw M3U / M3U8 string content into an array of channel objects
 */
export function parseM3U(m3uContent, baseUrl = "") {
  if (!m3uContent || typeof m3uContent !== "string") {
    return [];
  }

  const lines = m3uContent.split(/\r?\n/);
  const channels = [];
  let currentChannel = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    // Check if it's an EXTINF line
    if (line.startsWith("#EXTINF:")) {
      currentChannel = {};

      const afterExtinf = line.substring(8);
      const commaIdx = afterExtinf.indexOf(",");

      let attributesStr = "";
      let title = "";

      if (commaIdx !== -1) {
        attributesStr = afterExtinf.substring(0, commaIdx);
        title = afterExtinf.substring(commaIdx + 1).trim();
      } else {
        attributesStr = afterExtinf;
        title = "Channel " + (channels.length + 1);
      }

      currentChannel.name = title || `Channel ${channels.length + 1}`;

      // Extract tvg-logo
      const logoMatch = attributesStr.match(/tvg-logo=["']([^"']+)["']/i);
      if (logoMatch && logoMatch[1]) {
        currentChannel.logo = logoMatch[1].trim();
      }

      // Extract group-title
      const groupMatch = attributesStr.match(/group-title=["']([^"']+)["']/i);
      if (groupMatch && groupMatch[1]) {
        currentChannel.group = groupMatch[1].trim();
      } else {
        currentChannel.group = "General";
      }

      // Extract tvg-id
      const idMatch = attributesStr.match(/tvg-id=["']([^"']+)["']/i);
      if (idMatch && idMatch[1]) {
        currentChannel.tvgId = idMatch[1].trim();
      }

      // Extract quality if present
      const resMatch = (title + " " + attributesStr).match(/\b(4K|FHD|1080p|720p|HD|SD|480p)\b/i);
      if (resMatch) {
        currentChannel.quality = resMatch[1].toUpperCase();
      } else {
        currentChannel.quality = "HD";
      }

    } else if (line.startsWith("#")) {
      // Directives like #EXTGRP or #EXTVLCOPT
      if (line.startsWith("#EXTGRP:") && currentChannel) {
        currentChannel.group = line.substring(8).trim() || currentChannel.group;
      }
      continue;
    } else {
      // It's a stream URL
      let streamUrl = unwrapStreamUrl(line);

      // Only resolve relative if baseUrl is provided AND streamUrl doesn't start with http/https
      if (baseUrl && !streamUrl.startsWith("http://") && !streamUrl.startsWith("https://")) {
        try {
          streamUrl = new URL(streamUrl, baseUrl).href;
        } catch {
          // ignore
        }
      }

      if (currentChannel) {
        currentChannel.url = streamUrl;
        currentChannel.id = currentChannel.tvgId 
          ? `ch-${currentChannel.tvgId}-${channels.length}`
          : `ch-${channels.length + 1}`;
        
        channels.push(currentChannel);
        currentChannel = null;
      } else if (streamUrl.startsWith("http://") || streamUrl.startsWith("https://")) {
        channels.push({
          id: `ch-${channels.length + 1}`,
          name: `Stream ${channels.length + 1}`,
          url: streamUrl,
          group: "General",
          quality: "LIVE",
          logo: ""
        });
      }
    }
  }

  return channels;
}

/**
 * Fetches playlist content from a URL with built-in CORS proxy support
 */
export async function fetchPlaylistFromUrl(url) {
  if (url === "DEMO_INTERNAL") {
    return { channels: DEMO_CHANNELS, raw: "", isDirect: true };
  }

  const isDirectStream = /\.(m3u8|mp4|webm|mkv|avi|mov)($|\?)/i.test(url);

  // Strategy 1: Local server proxy /api/proxy (fastest & handles all CORS!)
  try {
    const localProxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(localProxyUrl, {
      method: "GET",
      headers: { Accept: "*/*" }
    });

    if (res.ok) {
      const text = await res.text();
      if (text.includes("#EXTM3U") || text.includes("#EXTINF") || !isDirectStream) {
        const channels = parseM3U(text, url);
        if (channels.length > 0) {
          return { channels, raw: text, isProxy: true };
        }
      }
      if (isDirectStream) {
        return {
          channels: [{
            id: "direct-stream-1",
            name: extractStreamName(url),
            url: url,
            group: "Live Stream",
            quality: "LIVE",
            logo: ""
          }],
          raw: text,
          isDirect: true
        };
      }
    }
  } catch (err) {
    console.warn("Local proxy fetch failed, trying direct/external fallback:", err);
  }

  // Strategy 2: Direct fetch (e.g. if hosted with open CORS headers like github.io)
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "*/*" }
    });

    if (res.ok) {
      const text = await res.text();
      if (text.includes("#EXTM3U") || text.includes("#EXTINF") || !isDirectStream) {
        const channels = parseM3U(text, url);
        if (channels.length > 0) {
          return { channels, raw: text, isDirect: true };
        }
      }
      if (isDirectStream) {
        return {
          channels: [{
            id: "direct-stream-1",
            name: extractStreamName(url),
            url: url,
            group: "Live Stream",
            quality: "LIVE",
            logo: ""
          }],
          raw: text,
          isDirect: true
        };
      }
    }
  } catch (err) {
    console.warn("Direct fetch failed (likely CORS), attempting external fallback:", err);
  }

  if (isDirectStream || url.startsWith("http")) {
    return {
      channels: [{
        id: "stream-manual-1",
        name: extractStreamName(url),
        url: url,
        group: "Direct Stream",
        quality: "LIVE",
        logo: ""
      }],
      raw: "",
      isSingle: true
    };
  }

  throw new Error("Unable to load playlist or stream. Please check the URL or upload an M3U file directly.");
}

function extractStreamName(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
    if (filename && filename.length > 3) {
      return decodeURIComponent(filename.replace(/\.(m3u8|mp4|webm|ts)/i, "")).replace(/[-_]/g, " ");
    }
    return parsed.hostname;
  } catch {
    return "Live Stream";
  }
}
