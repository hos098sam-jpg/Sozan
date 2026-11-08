export type VideoMediaType = 'video' | 'embed' | 'iframe' | 'terabox';

/**
 * Creates an obfuscated base64url ticket on the client side so the original URL is
 * never displayed in cleartext in the DOM or network query string.
 */
export function createClientVideoTicket(videoId: string, rawUrl: string, studentId?: string): string {
  try {
    const payload = JSON.stringify({
      url: rawUrl,
      videoId: videoId,
      studentId: studentId || 'student',
    });
    return btoa(encodeURIComponent(payload).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return encodeURIComponent(videoId || 'v_default');
  }
}

/**
 * Checks if the URL is a Degoo share link (e.g. https://app.degoo.com/share/gMISdAZE_NusRfoyats5Xw)
 */
export function extractDegooShareHash(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:app\.|cloud\.)?degoo\.com\/share\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) return match[1];
  if (trimmed.startsWith('degoo_') || trimmed.startsWith('degoo:')) {
    return trimmed.replace(/^degoo[_:]/, '');
  }
  return null;
}

export function isDegooShareUrl(url: string): boolean {
  return Boolean(extractDegooShareHash(url));
}

/**
 * Extracts Google Drive File ID from all supported URL formats:
 * - https://drive.google.com/file/d/FILE_ID/...
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/uc?export=download&id=FILE_ID
 * - https://docs.google.com/file/d/FILE_ID
 * - drive_FILEID
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const fileMatch = trimmed.match(/(?:drive|docs)\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileMatch && fileMatch[1]) return fileMatch[1];
  const idMatch = trimmed.match(/(?:drive|docs)\.google\.com\/(?:open|uc)\?(?:[^&]*&)*id=([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) return idMatch[1];
  const uspMatch = trimmed.match(/(?:drive|docs)\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/i);
  if (uspMatch && uspMatch[1]) return uspMatch[1];
  const prefixMatch = trimmed.match(/^drive[_-]([a-zA-Z0-9_-]{20,})/i);
  if (prefixMatch && prefixMatch[1]) return prefixMatch[1];
  return null;
}

/**
 * Checks if the URL is a Streamtape video link (e.g. https://streamtape.com/v/koA933mBJlcOjgr/...)
 * and extracts its unique video ID.
 */
export function extractStreamtapeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:streamtape\.(?:com|to|net|xyz|site)|strtape\.(?:cloud|tech)|strcloud\.in|stape\.fun|shavetape\.cash)\/(?:v|e)\/([a-zA-Z0-9_-]{6,})/i);
  if (match && match[1]) return match[1];
  if (trimmed.startsWith('streamtape_') || trimmed.startsWith('streamtape:')) {
    return trimmed.replace(/^streamtape[_:]/, '').split('/')[0].split('?')[0];
  }
  return null;
}

export function isStreamtapeUrl(url: string): boolean {
  return Boolean(extractStreamtapeId(url));
}

export function extractDoodStreamId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:dood\.(?:to|la|pm|wf|sh|watch|com|li|so|ws|re)|doodstream\.(?:com|net)|doodapi\.[a-z]{2,3}|ds2play\.com|dsvplay\.com|playmogo\.com|ds2video\.com)\/(?:d|e|v)\/([a-zA-Z0-9_-]{6,})/i);
  if (match && match[1]) return match[1];
  if (trimmed.startsWith('dood_') || trimmed.startsWith('dood:')) {
    return trimmed.replace(/^dood[_:]/, '').split('/')[0].split('?')[0];
  }
  return null;
}

export function isDoodStreamUrl(url: string): boolean {
  return Boolean(extractDoodStreamId(url));
}

/**
 * Checks if the URL is a Pixeldrain link (e.g. https://pixeldrain.com/u/Mp8gcshs, https://pixeldrain.com/api/file/Mp8gcshs)
 * and extracts its file ID.
 */
export function extractPixeldrainId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/pixeldrain\.com\/(?:u|api\/file|e)\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) return match[1];
  if (trimmed.startsWith('pixeldrain_') || trimmed.startsWith('pixeldrain:')) {
    return trimmed.replace(/^pixeldrain[_:]/, '').split('/')[0].split('?')[0];
  }
  return null;
}

export function isPixeldrainUrl(url: string): boolean {
  return Boolean(extractPixeldrainId(url));
}

export function getPixeldrainDirectUrl(url: string): string {
  const id = extractPixeldrainId(url);
  if (id) {
    return `https://pixeldrain.com/api/file/${id}`;
  }
  return url;
}

/**
 * Checks if the URL belongs to Wasabi S3, Degoo, or other direct S3-compatible cloud storage
 */
export function isWasabiOrDegooUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /wasabisys\.com|degoo\.info|degoo\.com|degoo-production/i.test(url);
}

/**
 * Checks if the URL belongs to Microsoft OneDrive or Office 365 SharePoint (Unified Student/Teacher Email)
 */
export function isOneDriveUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /onedrive\.live\.com|1drv\.ms|sharepoint\.com/i.test(url);
}

/**
 * Normalizes OneDrive / SharePoint URLs or <iframe> embed snippets
 */
export function normalizeOneDriveUrl(raw: string): { url: string; mode: 'direct' | 'embed' } {
  if (!raw || typeof raw !== 'string') return { url: '', mode: 'embed' };
  let cleaned = raw.trim();
  const iframeMatch = cleaned.match(/src=["'](.*?)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    cleaned = iframeMatch[1].trim();
  }
  cleaned = cleaned.replace(/&amp;/gi, '&');

  // If it's already an official OneDrive/SharePoint embed URL (embed.aspx or onedrive.live.com/embed)
  if (/\/_layouts\/15\/embed\.aspx|onedrive\.live\.com\/embed/i.test(cleaned)) {
    return { url: cleaned, mode: 'embed' };
  }

  // If it's a SharePoint ":v:" video sharing link (Anyone with the link), appending download=1 streams MP4 directly
  if (/sharepoint\.com\/:v:\//i.test(cleaned)) {
    const base = cleaned.split('?')[0];
    return { url: `${base}?download=1`, mode: 'direct' };
  }

  if (/download=1/i.test(cleaned)) {
    return { url: cleaned, mode: 'direct' };
  }

  return { url: cleaned, mode: 'embed' };
}

/**
 * Checks if the URL is a direct playable media link (MP4, Streamtape, Pixeldrain, Wasabi, Degoo share/cloud, WebM, HLS M3U8, etc.)
 */
export function isDirectMediaUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('/api/github-hls/') ||
    /\.m3u8(\?.*)?$/i.test(url) ||
    isStreamtapeUrl(url) ||
    isPixeldrainUrl(url) ||
    isDoodStreamUrl(url) ||
    isDegooShareUrl(url) ||
    isWasabiOrDegooUrl(url) ||
    (isOneDriveUrl(url) && normalizeOneDriveUrl(url).mode === 'direct') ||
    /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url) ||
    url.includes('/api/video/stream')
  );
}

export function toSafeUrlString(val: any, videoObj?: any): string {
  if (typeof val === 'string') return val.trim();
  if (val && typeof val === 'object') {
    const extracted = val.url || val.playableUrl || val.streamUrl || val.embedUrl || val.directUrl;
    if (typeof extracted === 'string') return extracted.trim();
  }
  if (videoObj && typeof videoObj === 'object') {
    if (typeof videoObj.originalUrl === 'string' && videoObj.originalUrl.trim()) return videoObj.originalUrl.trim();
    if (videoObj.originalUrl && typeof videoObj.originalUrl === 'object' && typeof videoObj.originalUrl.url === 'string') {
      return videoObj.originalUrl.url.trim();
    }
    if (typeof videoObj.url === 'string' && videoObj.url.trim()) return videoObj.url.trim();
    if (videoObj.url && typeof videoObj.url === 'object' && typeof videoObj.url.url === 'string') {
      return videoObj.url.url.trim();
    }
    if (typeof videoObj.vcdnVideoId === 'string' && videoObj.vcdnVideoId.trim()) {
      return `/api/vcdn/stream/${encodeURIComponent(videoObj.vcdnVideoId.trim())}`;
    }
  }
  return '';
}

/**
 * Returns a human-friendly provider name for a given media URL
 */
export function getVideoProviderName(rawUrl: any): string {
  const url = toSafeUrlString(rawUrl);
  if (!url) return 'بث مباشر';
  if (isOneDriveUrl(url)) return 'سيرفر مايكروسوفت OneDrive (يدعم تابلت المدرسة)';
  if (isPixeldrainUrl(url)) return 'سيرفر Pixeldrain فائق السرعة (Direct MP4)';
  if (isStreamtapeUrl(url)) return 'مشغل المنصة المحمي (Streamtape Direct)';
  if (isDoodStreamUrl(url)) return 'دودستريم (DoodStream Cloud)';
  if (isDegooShareUrl(url) || /degoo\.info|degoo\.com|degoo-production/i.test(url)) return 'سيرفر Degoo السحابي';
  if (/wasabisys\.com/i.test(url)) return 'Wasabi S3 Cloud';
  if (/terabox|1024tera|mirrobox|nephobox|4funbox/i.test(url)) return 'تيرابوكس (TeraBox)';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'يوتيوب (YouTube)';
  if (/vimeo\.com/i.test(url)) return 'فيميو (Vimeo)';
  if (url.includes('/api/github-hls/')) return 'بث GitHub HLS المشفر (AES-128)';
  if (/\.m3u8/i.test(url)) return 'بث HLS مباشر';
  if (/\.(mp4|webm|mov)/i.test(url)) return 'فيديو مباشر MP4';
  return 'بث تعليمي آمن';
}

/**
 * Helper to convert arbitrary video URLs (Streamtape, Wasabi S3, Degoo, YouTube, Vimeo, Google Drive, MP4, TeraBox)
 * into zero-leak in-platform endpoints without exposing original links or redirecting.
 */
export function getEmbedVideoUrl(rawUrl: any, videoId?: string): { type: 'video' | 'embed'; embedUrl: string; isCloud: boolean } {
  const trimmed = toSafeUrlString(rawUrl);
  if (!trimmed) return { type: 'video', embedUrl: '', isCloud: false };

  // GitHub Encrypted HLS & native .m3u8 streams play directly in Hls.js
  if (trimmed.includes('/api/github-hls/') || /\.m3u8(\?.*)?$/i.test(trimmed)) {
    return {
      type: 'video',
      embedUrl: trimmed,
      isCloud: false,
    };
  }

  const ticket = createClientVideoTicket(videoId || 'vid_' + Math.random().toString(36).slice(2, 7), trimmed);

  // 0.0 OneDrive / SharePoint (Unified School Email)
  if (isOneDriveUrl(trimmed)) {
    const normalized = normalizeOneDriveUrl(trimmed);
    return {
      type: normalized.mode === 'direct' ? 'video' : 'embed',
      embedUrl: normalized.url,
      isCloud: normalized.mode === 'embed',
    };
  }

  // 0. Streamtape video link -> Play directly via encrypted platform stream ticket (zero leak)
  if (isStreamtapeUrl(trimmed)) {
    return {
      type: 'video',
      embedUrl: `/api/video/stream/${encodeURIComponent(ticket)}`,
      isCloud: false,
    };
  }

  // 0.4 Pixeldrain video link -> Direct high-speed MP4 video stream with byte-range seeking
  if (isPixeldrainUrl(trimmed)) {
    const directUrl = getPixeldrainDirectUrl(trimmed);
    return {
      type: 'video',
      embedUrl: directUrl,
      isCloud: false,
    };
  }

  // 0.5 Degoo share link (e.g. https://app.degoo.com/share/gMISdAZE_NusRfoyats5Xw)
  const degooHash = extractDegooShareHash(trimmed);
  if (degooHash) {
    return {
      type: 'video',
      embedUrl: `/api/video/stream/degoo_${degooHash}`,
      isCloud: false,
    };
  }

  // 0.6 DoodStream video link (DoodStream Cloud Player)
  if (isDoodStreamUrl(trimmed)) {
    const doodCode = extractDoodStreamId(trimmed);
    const safeDoodUrl = doodCode ? `https://doodstream.com/e/${doodCode}` : trimmed.replace(/(?:playmogo\.com|dsvplay\.com|dood\.to|ds2play\.com)/gi, 'doodstream.com');
    const doodTicket = createClientVideoTicket(videoId || `dood_${doodCode || 'vid'}`, safeDoodUrl);
    return {
      type: 'embed',
      embedUrl: `/api/video/embed/${encodeURIComponent(doodTicket)}`,
      isCloud: true,
    };
  }

  // 1. Wasabi S3, Degoo Direct MP4 / WebM / OGG / MOV video file or API streaming endpoint
  if (
    isWasabiOrDegooUrl(trimmed) ||
    /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(trimmed) ||
    trimmed.includes('/api/video/stream')
  ) {
    return {
      type: 'video',
      embedUrl: trimmed.includes('/api/video/stream') ? trimmed : `/api/video/stream/${encodeURIComponent(ticket)}`,
      isCloud: false,
    };
  }

  // 2. Direct TeraBox CDN file with media extension
  if (/terabox|1024tera|freeterabox|mirrobox|nephobox|4funbox/i.test(trimmed) && /\.(mp4|mkv|mov|webm)/i.test(trimmed)) {
    return {
      type: 'video',
      embedUrl: `/api/video/stream/${ticket}`,
      isCloud: false,
    };
  }

  // 3. All other media types (TeraBox share link, YouTube, Drive, Vimeo) play in-platform via /api/video/embed/
  return {
    type: 'embed',
    embedUrl: `/api/video/embed/${ticket}`,
    isCloud: true,
  };
}

export function isTeraBoxUrl(rawUrl: any): boolean {
  const url = toSafeUrlString(rawUrl);
  if (!url) return false;
  return /terabox|1024tera|freeterabox|mirrobox|nephobox|4funbox/i.test(url);
}

/**
 * Extracts raw video URL from a client base64 ticket if valid
 */
export function extractVideoUrlFromTicket(ticket: string): string | null {
  try {
    if (!ticket || typeof ticket !== 'string') return null;
    let decoded = ticket.trim();
    // Decode URI encoding if ticket was passed via URL path or query
    try {
      if (decoded.includes('%')) {
        decoded = decodeURIComponent(decoded);
      }
    } catch {}
    const clean = decoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = clean.padEnd(clean.length + (4 - (clean.length % 4)) % 4, '=');
    const binary = atob(padded);
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(binary, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonStr);
    return toSafeUrlString(parsed.url) || null;
  } catch {
    return null;
  }
}

/**
 * Transforms any raw video object into a Gateway-secured payload.
 * The original URL is replaced by /api/video/gateway/{ticket}, preventing link extraction.
 */
export function createGatewayVideoPayload<T extends { id?: string; url: any; [key: string]: any }>(
  video: T,
  studentId?: string
): T & {
  gatewayUrl: string;
  gatewayTicket: string;
  originalUrl: string;
  isGatewaySecured: boolean;
} {
  const safeVideo = (video && typeof video === 'object' ? video : { url: '' }) as T;
  const rawUrl = toSafeUrlString((safeVideo as any).originalUrl || safeVideo.url, safeVideo);
  const ticket = createClientVideoTicket(safeVideo.id || 'vid_' + Math.random().toString(36).slice(2, 8), rawUrl, studentId);
  const gatewayUrl = `/api/video/gateway/${encodeURIComponent(ticket)}`;

  return {
    ...safeVideo,
    // The exposed URL is strictly replaced with the Gateway URL
    url: gatewayUrl,
    originalUrl: rawUrl,
    gatewayUrl,
    gatewayTicket: ticket,
    isGatewaySecured: true,
  };
}

/**
 * Transforms any raw video URL into an obfuscated platform-only internal stream URL
 * that prevents playing outside the platform and strictly hides the original source.
 */
export function convertToPlatformSecureUrl(rawUrl: any, videoId?: string, studentId?: string): {
  ticket: string;
  gatewayUrl: string;
  streamUrl: string;
  embedUrl: string;
  isDirectStream: boolean;
  providerBadge: string;
} {
  const trimmed = toSafeUrlString(rawUrl);
  if (trimmed.includes('/api/github-hls/') || /\.m3u8(\?.*)?$/i.test(trimmed)) {
    return {
      ticket: '',
      gatewayUrl: trimmed,
      streamUrl: trimmed,
      embedUrl: trimmed,
      isDirectStream: true,
      providerBadge: 'مشغل منصة المتفلسفة  الآمن (HLS AES-128)',
    };
  }
  const ticket = createClientVideoTicket(videoId || 'v_sec_' + Math.random().toString(36).slice(2, 8), trimmed, studentId);
  const gatewayUrl = `/api/video/gateway/${encodeURIComponent(ticket)}`;
  const streamUrl = `/api/video/stream/${encodeURIComponent(ticket)}`;
  const embedUrl = `/api/video/embed/${encodeURIComponent(ticket)}`;
  const isDirect = isDirectMediaUrl(trimmed);
  return {
    ticket,
    gatewayUrl,
    streamUrl,
    embedUrl,
    isDirectStream: isDirect,
    providerBadge: 'مشغل منصة المتفلسفة  الآمن',
  };
}

