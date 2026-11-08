import React, { useEffect, useRef, useState, useMemo } from 'react';
import Hls from 'hls.js';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  RefreshCw,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sparkles,
  AlertCircle,
  Settings,
  Gauge,
  Check,
  Sliders,
  Smartphone,
  X,
  CheckCircle,
  ExternalLink,
  WifiOff,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { User } from '../types';
import {
  extractDegooShareHash,
  extractStreamtapeId,
  isStreamtapeUrl,
  extractDoodStreamId,
  isDoodStreamUrl,
  extractPixeldrainId,
  isPixeldrainUrl,
  getPixeldrainDirectUrl,
  convertToPlatformSecureUrl,
  extractVideoUrlFromTicket,
} from '../utils/mediaUtils';
import { getVideoProgress, saveVideoProgress, clearVideoProgress } from '../utils/videoProgress';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface VideoQualityOption {
  id: string; // 'auto', '1080p', '720p', '480p', '360p', '240p'
  label: string; // e.g. '1080p FHD'
  shortLabel: string; // e.g. '1080p'
  badge: string; // e.g. 'فائقة الدقة'
  ytQualityCode: string;
  height?: number;
}

export const PLATFORM_QUALITIES: VideoQualityOption[] = [
  { id: 'auto', label: 'تلقائي (Auto)', shortLabel: 'تلقائي', badge: 'حسب سرعة الاتصال', ytQualityCode: 'default' },
  { id: '1080p', label: '1080p FHD', shortLabel: '1080p', badge: 'فائقة الدقة', ytQualityCode: 'hd1080', height: 1080 },
  { id: '720p', label: '720p HD', shortLabel: '720p', badge: 'عالية (موصى بها)', ytQualityCode: 'hd720', height: 720 },
  { id: '480p', label: '480p SD', shortLabel: '480p', badge: 'متوسطة متوازنة', ytQualityCode: 'large', height: 480 },
  { id: '360p', label: '360p', shortLabel: '360p', badge: 'توفير باقة النت', ytQualityCode: 'medium', height: 360 },
  { id: '240p', label: '240p', shortLabel: '240p', badge: 'للسرعات الضعيفة', ytQualityCode: 'small', height: 240 },
];

export interface QualityLevel {
  id: number;
  height: number;
  bitrate?: number;
  label: string;
}

export interface SecureVideoPlayerProps {
  videoId?: string;
  rawTeraBoxUrl?: string;
  video?: {
    id?: string;
    title?: string;
    url?: string;
    duration?: string;
    description?: string;
    sourceType?: string;
    order?: number;
    isLive?: boolean;
    liveScheduledAt?: string;
  };
  currentUser?: User | null;
  onEnded?: () => void;
}

/**
 * Checks if a given URL is a TeraBox share link (or known mirrors)
 */
export function isTeraBoxShareUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /terabox\.com|1024terabox\.com|1024tera\.com|teraboxapp\.com|terabox\.app|mirrobox\.com|nephobox\.com|4funbox\.com|freeterabox\.com/i.test(
    url
  );
}

/**
 * Extracts the TeraBox share code (surl) cleanly from any TeraBox link format
 */
export function getTeraBoxSurl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    const surlParam = parsed.searchParams.get('surl');
    if (surlParam) return surlParam.replace(/^1/, '');
  } catch {}

  const match = trimmed.match(/\/s\/(?:1)?([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1].replace(/^1/, '');
  }

  const match2 = trimmed.match(/surl=(?:1)?([a-zA-Z0-9_-]+)/);
  if (match2 && match2[1]) {
    return match2[1].replace(/^1/, '');
  }

  return null;
}

/**
 * Generates the official embedded HTML5 player URL for TeraBox
 */
export function getTeraBoxEmbedUrl(url: string, mirror: boolean = false): string | null {
  const surl = getTeraBoxSurl(url);
  if (!surl) return null;
  const domain = mirror ? '1024terabox.com' : 'www.terabox.app';
  return `https://${domain}/sharing/embed?surl=${surl}`;
}

/**
 * Extracts YouTube Video ID from standard YouTube URL formats
 */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:youtu\.be\/|(?:youtube\.com|youtube-nocookie\.com)\/(?:embed\/|v\/|live\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  if (match && match[1]) return match[1];
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Cleans any raw video URL (e.g. extracts src from <iframe src="..."></iframe> or unwraps { url } objects)
 */
export function cleanRawVideoInput(raw: any): string {
  if (!raw) return '';
  const str =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'object'
      ? String(raw.url || raw.playableUrl || raw.streamUrl || raw.embedUrl || '')
      : '';
  if (!str) return '';
  const trimmed = str.trim();
  const iframeMatch = trimmed.match(/src=["'](.*?)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    return iframeMatch[1].trim().replace(/&amp;/gi, '&');
  }
  return trimmed.replace(/&amp;/gi, '&');
}

/**
 * Detects whether a URL belongs to the AVCaption video platform
 */
export function isAvcaptionUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /avcaption\.com|avcaption/i.test(url);
}

/**
 * Extracts the AVCaption Video ID or Slug cleanly
 */
export function extractAvcaptionId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleaned = cleanRawVideoInput(url).trim();
  const match = cleaned.match(/avcaption\.com\/(?:watch\/|v\/|video\/|embed\/|e\/|d\/)?([a-zA-Z0-9_-]{5,})/i);
  if (match && match[1] && !/^(embed|watch|video|player)$/i.test(match[1])) return match[1];
  return null;
}

/**
 * Resolves the optimal embed/player URL for AVCaption's official player
 * Official AVCaption iframe embed format is: https://avcaption.com/watch/{embed_token}
 */
export function getAvcaptionEmbedUrl(url: string, mirror: boolean = false): string {
  if (!url || typeof url !== 'string') return '';
  const cleaned = cleanRawVideoInput(url).trim();

  // If the user pasted a /watch/ URL, keep it intact (including any query params)
  if (/avcaption\.com\/watch\//i.test(cleaned)) {
    return mirror ? cleaned.replace(/\/watch\//i, '/embed/') : cleaned;
  }

  const videoId = extractAvcaptionId(cleaned);
  if (videoId) {
    return mirror
      ? `https://avcaption.com/embed/${videoId}`
      : `https://avcaption.com/watch/${videoId}`;
  }

  return cleaned;
}

/**
 * Extracts Google Drive File ID from all supported URL formats:
 * - https://drive.google.com/file/d/FILE_ID/...
 * - https://drive.google.com/file/u/0/d/FILE_ID/...
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://docs.google.com/file/d/FILE_ID
 * - https://drive.google.com/file/d/FILE_ID/preview
 * - Naked Drive IDs
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleaned = cleanRawVideoInput(url);

  // 1. Match /file/d/ID or /file/u/0/d/ID or /d/ID
  const fileMatch = cleaned.match(/(?:drive|docs)\.google\.com\/(?:file\/)?(?:u\/\d+\/)?(?:file\/)?d\/([a-zA-Z0-9_-]{20,})/i);
  if (fileMatch && fileMatch[1]) return fileMatch[1];

  // 2. id= query parameter
  const idMatch = cleaned.match(/(?:drive|docs)\.google\.com\/(?:open|uc)\?(?:[^&]*&)*id=([a-zA-Z0-9_-]{20,})/i);
  if (idMatch && idMatch[1]) return idMatch[1];

  // 3. folders/ or drive_ prefix
  const prefixMatch = cleaned.match(/^drive[_-]([a-zA-Z0-9_-]{20,})/i);
  if (prefixMatch && prefixMatch[1]) return prefixMatch[1];

  // 4. Naked 25-45 char ID if domain looks like google or starts with drive
  if (cleaned.includes('google') || cleaned.includes('drive')) {
    const genericIdMatch = cleaned.match(/([a-zA-Z0-9_-]{25,45})/);
    if (genericIdMatch && genericIdMatch[1]) return genericIdMatch[1];
  }

  return null;
}

/**
 * Extracts Vimeo Video ID
 */
export function extractVimeoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|)(\d+)/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Extracts Dailymotion Video ID
 */
export function extractDailymotionId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.trim().match(/dailymotion\.com\/(?:video|embed\/video)\/([a-zA-Z0-9]+)/i) || url.trim().match(/dai\.ly\/([a-zA-Z0-9]+)/i);
  return match && match[1] ? match[1] : null;
}

/**
 * Checks if a given URL or mime-type is an HLS streaming manifest (.m3u8)
 */
export function isHlsStream(url?: string): boolean {
  if (!url) return false;
  const testUrl = url.trim().toLowerCase();
  return (
    /\.m3u8($|\?|#)/i.test(testUrl) ||
    testUrl.includes('/hls/') ||
    testUrl.includes('format=m3u8') ||
    testUrl.includes('type=m3u8') ||
    testUrl.includes('manifest.m3u8') ||
    testUrl.includes('master.m3u8') ||
    testUrl.includes('playlist.m3u8')
  );
}

// Format seconds into MM:SS or HH:MM:SS (with 2-digit padded hours e.g. 01:35:51)
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const SecureVideoPlayer: React.FC<SecureVideoPlayerProps> = ({
  videoId,
  rawTeraBoxUrl,
  video,
  currentUser,
  onEnded,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const avcaptionIframeRef = useRef<HTMLIFrameElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const ytMountRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef<boolean>(false);
  const pendingPlayRef = useRef<boolean>(false);
  const ytIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Protection alert state (silent block: right-click & long-press are blocked without showing any overlay message)
  const [showContextMenuAlert] = useState<boolean>(false);

  const triggerProtectionAlert = () => {
    // Intentionally silent: block context menu / long-press without displaying any popup or interrupting playback
  };

  // Video identifiers & URLs - extract ticket if Gateway URL is provided
  const rawInput = cleanRawVideoInput((video as any)?.originalUrl || rawTeraBoxUrl || video?.url || '');
  const extractedTicket = rawInput.includes('/api/video/gateway/')
    ? rawInput.replace(/.*\/api\/video\/gateway\//, '').split('?')[0]
    : rawInput.includes('/api/video/stream/')
    ? rawInput.replace(/.*\/api\/video\/stream\//, '').split('?')[0]
    : rawInput.includes('/api/video/embed/')
    ? rawInput.replace(/.*\/api\/video\/embed\//, '').split('?')[0]
    : (video as any)?.gatewayTicket || null;

  const resolvedUrl = (video as any)?.originalUrl
    ? cleanRawVideoInput((video as any).originalUrl)
    : extractedTicket
    ? (extractVideoUrlFromTicket(extractedTicket) || rawInput)
    : rawInput;

  const rawCleanedUrl = cleanRawVideoInput(resolvedUrl);
  const effectiveRawUrl =
    rawCleanedUrl.includes('/api/github-hls/') && rawCleanedUrl.endsWith('/stream.mp4')
      ? rawCleanedUrl.replace(/\/stream\.mp4$/, '/master.m3u8')
      : rawCleanedUrl;

  //Classify video type
  const vcdnUrlMatch = effectiveRawUrl.match(/(?:embed\.vcdn\.me\/embed\/|cdn\.vcdn\.me\/(?:stream|api\/v1\/videos)\/|\/api\/vcdn\/stream\/)([a-zA-Z0-9_-]{8,})/i);
  const extractedVcdnIdFromUrl = vcdnUrlMatch && vcdnUrlMatch[1] ? vcdnUrlMatch[1] : null;

  const isVcdn = Boolean(
    (video as any)?.sourceType === 'vcdn' ||
    (video as any)?.vcdnVideoId ||
    effectiveRawUrl.startsWith('vcdn:') ||
    extractedVcdnIdFromUrl
  );
  const vcdnVideoId = (video as any)?.vcdnVideoId ||
    (effectiveRawUrl.startsWith('vcdn:') ? effectiveRawUrl.replace(/^vcdn:/, '') : extractedVcdnIdFromUrl);

  const [vcdnStreamUrl, setVcdnStreamUrl] = useState<string | null>(null);
  const [vcdnStatus, setVcdnStatus] = useState<'uploading' | 'processing' | 'ready' | 'failed' | null>(
    (video as any)?.vcdnStatus || null
  );
  const [vcdnLoading, setVcdnLoading] = useState<boolean>(Boolean(isVcdn && vcdnVideoId));
  const [vcdnError, setVcdnError] = useState<string | null>(null);
  const [avcaptionStreamUrl, setAvcaptionStreamUrl] = useState<string | null>(null);

  // Lesson & Video Subscription Authorization Check (Server-side Base64 token decoding)
  const [authBlockedMessage, setAuthBlockedMessage] = useState<string | null>(null);
  const [decryptedYouTubeId, setDecryptedYouTubeId] = useState<string | null>(null);

  useEffect(() => {
    // Never block when a direct/course video URL is already provided or during teacher preview
    if (effectiveRawUrl) {
      setAuthBlockedMessage(null);
      return;
    }
    const targetId = video?.id || videoId;
    if (!targetId) return;

    let isMounted = true;
    const authUrl = `/api/lessons/${encodeURIComponent(targetId)}/video-auth?studentId=${encodeURIComponent(currentUser?.id || 'preview_student')}`;

    fetch(authUrl)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.status === 'allowed' && data.secureToken) {
          setAuthBlockedMessage(null);
          try {
            const rawDecoded = atob(data.secureToken);
            if (rawDecoded && rawDecoded.length >= 4) {
              setDecryptedYouTubeId(rawDecoded);
            }
          } catch (e) {
            console.warn('[Video Auth] Token decode warning:', e);
          }
        }
      })
      .catch((err) => {
        console.warn('[Video Auth Network Notice]:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [video?.id, videoId, currentUser?.id, effectiveRawUrl]);

  // Fetch VCDN temporary playback token & HLS URL securely from backend
  useEffect(() => {
    if (!isVcdn || !vcdnVideoId) return;

    let isMounted = true;
    let pollTimer: any = null;

    const requestVcdnPlayback = async () => {
      setVcdnLoading(true);
      setVcdnError(null);
      try {
        const res = await fetch(`/api/vcdn/videos/${encodeURIComponent(vcdnVideoId)}/playback-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: currentUser?.id,
            studentName: currentUser?.name,
            studentPhone: currentUser?.phone,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'فشل استخراج تصريح تشغيل فيديو VCDN.');
        }

        const data = await res.json();
        if (isMounted) {
          const rawStreamUrl = data.hlsUrl || data.playbackUrl || data.embedUrl || '';
          setVcdnStreamUrl(rawStreamUrl);
          setVcdnStatus('ready');
          const isEmbedStream = Boolean(
            data.streamType === 'embed' ||
            rawStreamUrl.includes('embed.vcdn.me') ||
            rawStreamUrl.includes('/embed/')
          );
          const isRealHls = Boolean(
            !isEmbedStream &&
            (data.streamType === 'hls' || (rawStreamUrl && (rawStreamUrl.includes('.m3u8') || rawStreamUrl.includes('/hls/'))))
          );
          if (isEmbedStream) {
            setEmbedUrl(data.embedUrl || rawStreamUrl);
            setPlayerMode('embed');
          } else {
            setPlayerMode(isRealHls ? 'hls' : 'direct');
          }
          setVcdnLoading(false);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setVcdnStatus('processing');
          setVcdnLoading(false);
          setLoading(false);
          pollTimer = setTimeout(requestVcdnPlayback, 4000);
        }
      }
    };

    requestVcdnPlayback();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [isVcdn, vcdnVideoId, currentUser?.id]);

  const ytId = extractYouTubeId(effectiveRawUrl) || decryptedYouTubeId;
  const gDriveId = extractGoogleDriveId(effectiveRawUrl);
  const vimeoId = extractVimeoId(effectiveRawUrl);
  const dailymotionId = extractDailymotionId(effectiveRawUrl);
  const isTeraBox = isTeraBoxShareUrl(effectiveRawUrl);
  const isAvcaption = isAvcaptionUrl(effectiveRawUrl);
  const streamtapeId = extractStreamtapeId(effectiveRawUrl);
  const isStreamtape = Boolean(streamtapeId || isStreamtapeUrl(effectiveRawUrl) || (video as any)?.sourceType === 'streamtape');
  const isPixeldrain = Boolean(extractPixeldrainId(effectiveRawUrl) || isPixeldrainUrl(effectiveRawUrl) || (video as any)?.sourceType === 'pixeldrain');
  const pixeldrainDirectUrl = isPixeldrain ? getPixeldrainDirectUrl(effectiveRawUrl) : '';
  const isHls =
    !isStreamtape &&
    !isPixeldrain &&
    (isHlsStream(effectiveRawUrl) ||
      (isVcdn && Boolean(vcdnStreamUrl?.includes('.m3u8'))) ||
      (isAvcaption && Boolean(avcaptionStreamUrl && (avcaptionStreamUrl.includes('.m3u8') || avcaptionStreamUrl.includes('/avcaption-hls')))));
  const isDropbox = /dropbox\.com/i.test(effectiveRawUrl);
  const isOneDriveEmbed = /onedrive\.live\.com\/embed|\/_layouts\/15\/embed\.aspx|1drv\.ms/i.test(effectiveRawUrl);
  const isOneDriveDirectShare = /sharepoint\.com\/:v:\//i.test(effectiveRawUrl) || (/sharepoint\.com|onedrive\.live\.com/i.test(effectiveRawUrl) && /download=1/i.test(effectiveRawUrl));
  const isDood = Boolean(extractDoodStreamId(effectiveRawUrl) || isDoodStreamUrl(effectiveRawUrl) || (video as any)?.sourceType === 'doodstream');
  const isDirectFile =
    isStreamtape ||
    isPixeldrain ||
    isOneDriveDirectShare ||
    /\.(mp4|webm|ogg|mov|m4v|mkv|avi|flv|ts|3gp|wmv)($|\?|#)/i.test(effectiveRawUrl) ||
    isDropbox ||
    effectiveRawUrl.includes('/api/vcdn/stream/') ||
    effectiveRawUrl.includes('/api/video/stream/');
  const isExternalEmbed = Boolean(
    !isStreamtape &&
    !isPixeldrain &&
    !isOneDriveDirectShare &&
    (ytId ||
      gDriveId ||
      vimeoId ||
      dailymotionId ||
      isTeraBox ||
      isAvcaption ||
      isOneDriveEmbed ||
      Boolean(extractDoodStreamId(effectiveRawUrl) || (video as any)?.sourceType === 'doodstream') ||
      /sharepoint\.com|onedrive\.live\.com|mediadelivery\.net|bunnycdn\.com|b-cdn\.net|wistia\.com|loom\.com|ok\.ru|vk\.com|streamable\.com|vidyard\.com|cloudflarestream\.com|mux\.com|dailymotion\.com|facebook\.com|tiktok\.com|instagram\.com|twitch\.tv|rumble\.com|odysee\.com|bilibili\.com|rutube\.ru|sproutvideo\.com|jwplayer\.com|vdocipher\.com|gumlet\.io|brightcove\.net|kaltura\.com|panopto\.com|peertube/i.test(effectiveRawUrl))
  );

  // Convert raw URL into an obfuscated platform-only internal stream URL
  const platformSecure = useMemo(() => {
    return convertToPlatformSecureUrl(effectiveRawUrl, videoId || video?.id, currentUser?.id);
  }, [effectiveRawUrl, videoId, video?.id, currentUser?.id]);

  // Direct playable stream URL for Pixeldrain, Streamtape, and Dropbox (dl=0 -> raw=1)
  const playableDirectUrl = useMemo(() => {
    return (isPixeldrain || isStreamtape)
      ? platformSecure.streamUrl
      : isDropbox
      ? effectiveRawUrl.replace(/([?&])dl=0/i, '$1raw=1') + (effectiveRawUrl.includes('raw=1') ? '' : effectiveRawUrl.includes('?') ? '&raw=1' : '?raw=1')
      : effectiveRawUrl;
  }, [isPixeldrain, isStreamtape, platformSecure.streamUrl, isDropbox, effectiveRawUrl]);

  const [useMirror, setUseMirror] = useState<boolean>(false);
  const [ytSilentDirectUrl, setYtSilentDirectUrl] = useState<string | null>(null);

  const playableSrc = useMemo(() => {
    if (ytId && ytSilentDirectUrl) {
      return ytSilentDirectUrl;
    }
    const degooHash = extractDegooShareHash(effectiveRawUrl);
    return isVcdn
      ? (vcdnStreamUrl || (vcdnVideoId ? `/api/vcdn/stream/${encodeURIComponent(vcdnVideoId)}` : ''))
      : (isStreamtape || isPixeldrain)
      ? platformSecure.streamUrl
      : isAvcaption && avcaptionStreamUrl
      ? avcaptionStreamUrl
      : degooHash
      ? `/api/video/stream/degoo_${degooHash}`
      : effectiveRawUrl.startsWith('http') && !isDropbox
      ? platformSecure.streamUrl
      : playableDirectUrl;
  }, [ytId, ytSilentDirectUrl, isVcdn, vcdnStreamUrl, vcdnVideoId, isStreamtape, isPixeldrain, platformSecure.streamUrl, isAvcaption, avcaptionStreamUrl, effectiveRawUrl, isDropbox, playableDirectUrl]);

  // Helper to build embed URL - ALWAYS DISABLE NATIVE CONTROLS FOR YOUTUBE (controls=0)
  const resolveEmbedUrl = (mirror: boolean, forceQualityCode?: string) => {
    if (ytId) {
      const originParam = typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '';
      const vqParam = forceQualityCode && forceQualityCode !== 'default' ? `&vq=${encodeURIComponent(forceQualityCode)}` : '';
      return `https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&autoplay=1&modestbranding=1&rel=0&playsinline=1&controls=0&iv_load_policy=3&fs=0&disablekb=1${originParam}${vqParam}`;
    }
    // Google Drive direct preview (ensures clean playback without nested sandbox blocks)
    if (gDriveId) {
      return `https://drive.google.com/file/d/${gDriveId}/preview`;
    }
    // AVCaption native player embed inside platform
    if (isAvcaption) {
      return getAvcaptionEmbedUrl(effectiveRawUrl, mirror) || effectiveRawUrl;
    }
    // Vimeo
    if (vimeoId) {
      return `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0&dnt=1`;
    }
    // Dailymotion (ad-free parameters)
    if (dailymotionId) {
      return `https://www.dailymotion.com/embed/video/${dailymotionId}?autoplay=1&ui-logo=0&sharing-enable=0&syndication=0`;
    }
    // Facebook Video
    if (/facebook\.com\/.*\/videos\/|fb\.watch/i.test(effectiveRawUrl)) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(effectiveRawUrl)}&show_text=0&autoplay=1`;
    }
    // Streamable
    const streamableMatch = effectiveRawUrl.match(/streamable\.com\/(?:e\/)?([a-zA-Z0-9]+)/i);
    if (streamableMatch && streamableMatch[1]) {
      return `https://streamable.com/e/${streamableMatch[1]}?autoplay=1`;
    }
    // Loom
    const loomMatch = effectiveRawUrl.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
    if (loomMatch && loomMatch[1]) {
      return `https://www.loom.com/embed/${loomMatch[1]}`;
    }
    // OK.ru (Odnoklassniki)
    const okMatch = effectiveRawUrl.match(/ok\.ru\/(?:video|videoembed)\/(\d+)/i);
    if (okMatch && okMatch[1]) {
      return `https://ok.ru/videoembed/${okMatch[1]}?autoplay=1`;
    }
    // Route cloud providers (TeraBox) strictly through the platform's anti-redirect embed proxy
    if (isTeraBox) {
      const tbInfo = getTeraBoxEmbedUrl(effectiveRawUrl, mirror);
      return tbInfo || platformSecure.embedUrl;
    }
    // DoodStream Cloud Video Embed: route through platform secure embed proxy
    const doodCode = extractDoodStreamId(effectiveRawUrl);
    if (doodCode || isDood) {
      return platformSecure.embedUrl;
    }
    // Any external web hosting URL (Bunny CDN, Cloudflare Stream, Wistia, VdoCipher, or any website)
    if (effectiveRawUrl.startsWith('http://') || effectiveRawUrl.startsWith('https://')) {
      return effectiveRawUrl;
    }
    return platformSecure.embedUrl;
  };

  // Video Tracking Key for resume playback
  const videoTrackingId = String(video?.id || videoId || (video as any)?.title || effectiveRawUrl || 'current_video').trim();

  // Initial resume progress
  const initialProgress = getVideoProgress(videoTrackingId, currentUser?.id);
  const initialResumeTimeRef = useRef<number>(
    initialProgress.currentTime > 5 && !initialProgress.completed ? initialProgress.currentTime : 0
  );
  const [resumedTime, setResumedTime] = useState<number>(initialResumeTimeRef.current);
  const hasSeekedRef = useRef<boolean>(false);
  const lastSavedTimeRef = useRef<number>(0);

  // Force YouTube & Streamtape videos into platform custom player, while AVCaption uses its own native embedded player
  const [playerMode, setPlayerMode] = useState<'hls' | 'embed' | 'direct' | 'youtube' | 'avcaption'>(() => {
    if (isVcdn) return 'direct';
    if (isStreamtape || isPixeldrain) return 'direct';
    if (ytId) return 'youtube';
    if (isAvcaption) return 'embed';
    if (isExternalEmbed) return 'embed';
    if (isDirectFile) return 'direct';
    if (isHls) return 'hls';
    if (effectiveRawUrl.startsWith('http://') || effectiveRawUrl.startsWith('https://')) return 'embed';
    return 'direct';
  });

  const [embedUrl, setEmbedUrl] = useState<string>(() => resolveEmbedUrl(false));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [watermarkPos, setWatermarkPos] = useState<{ top: number; left: number }>({ top: 22, left: 18 });

  // Custom Video Controls State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isControlsVisible, setIsControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quality settings state — Default to 1080p FHD so whiteboard writing is crystal clear from the first second
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 is Auto
  const [selectedQualityId, setSelectedQualityId] = useState<string>('1080p');
  const selectedQualityIdRef = useRef<string>('1080p');
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);

  // Dynamic visual clarity & resolution scaling for HTML5 <video> streams based on selected quality
  // (keeps YouTube iframe untouched so mobile Chromium never down-rasterizes scaled iframes)
  const getHtml5QualityStyle = (qualityId: string): React.CSSProperties => {
    switch (qualityId) {
      case '1080p':
        return {
          filter: 'contrast(1.06) saturate(1.06) brightness(1.01)',
          imageRendering: 'auto',
        };
      case '720p':
        return {
          filter: 'contrast(1.03) saturate(1.02)',
          imageRendering: 'auto',
        };
      case '480p':
        return {
          filter: 'none',
          imageRendering: 'auto',
        };
      case '360p':
        return {
          filter: 'blur(0.45px) contrast(0.98)',
          imageRendering: 'auto',
        };
      case '240p':
        return {
          filter: 'blur(1.1px) contrast(0.95)',
          imageRendering: 'pixelated',
        };
      case 'auto':
      default:
        return {
          filter: 'contrast(1.04) saturate(1.04)',
          imageRendering: 'auto',
        };
    }
  };
  const qualityVisualFilter = 'none';

  // Map selected quality ID to exact landscape virtual viewport dimensions (width > height ALWAYS so YouTube never triggers portrait 360p cap)
  const getYouTubeVirtualDimensions = (qualityId: string): { width: number; height: number; videoHeight: number } => {
    switch (qualityId) {
      case '720p':
        return { width: 1280, height: 720, videoHeight: 720 };
      case '480p':
        return { width: 854, height: 480, videoHeight: 480 };
      case '360p':
        return { width: 640, height: 360, videoHeight: 360 };
      case '240p':
        return { width: 426, height: 240, videoHeight: 240 };
      case '144p':
        return { width: 256, height: 144, videoHeight: 144 };
      case '1080p':
      case 'auto':
      default:
        return { width: 1920, height: 1080, videoHeight: 1080 };
    }
  };

  // Landscape & Auto-fullscreen state (default to false so portrait mode on phones stays inline and never overflows)
  const [autoLandscapeOnPlay, setAutoLandscapeOnPlay] = useState<boolean>(false);
  const [isPseudoLandscape, setIsPseudoLandscape] = useState<boolean>(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 960, height: 540 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 20) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateSize);
      ro.observe(el);
    }
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, [isFullscreen, isPseudoLandscape]);

  // Resolve the highest available quality on YouTube for the current video (or the closest match to a manual selection)
  const hasLockedInitialMaxQualityRef = useRef<boolean>(false);
  const userManuallySelectedQualityRef = useRef<boolean>(false);

  const resolveAvailableYouTubeQuality = (player: any, requestedCode: string, preferHighestAvailable = false): string => {
    const rankOrder = ['highres', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
    try {
      const available: string[] =
        player && typeof player.getAvailableQualityLevels === 'function'
          ? player.getAvailableQualityLevels() || []
          : [];
      const validLevels = available.filter((q) => q && q !== 'auto' && q !== 'default');

      // YouTube orders getAvailableQualityLevels() from HIGHEST to LOWEST available quality for this video.
      // When preferHighestAvailable is true (default), return validLevels[0] (the absolute highest quality of the video).
      if (validLevels.length > 0 && (preferHighestAvailable || !requestedCode || requestedCode === 'default' || requestedCode === 'auto')) {
        return validLevels[0];
      }

      const effectiveCode =
        !requestedCode || requestedCode === 'default' || requestedCode === 'auto'
          ? 'hd1080'
          : requestedCode;

      if (validLevels.length === 0) return effectiveCode;
      if (validLevels.includes(effectiveCode)) return effectiveCode;

      const reqIdx = rankOrder.indexOf(effectiveCode);
      if (reqIdx === -1) return validLevels[0];

      let bestMatch = validLevels[0];
      let smallestDist = Infinity;
      for (const lvl of validLevels) {
        const idx = rankOrder.indexOf(lvl);
        if (idx !== -1) {
          const dist = Math.abs(idx - reqIdx);
          if (dist < smallestDist) {
            smallestDist = dist;
            bestMatch = lvl;
          }
        }
      }
      return bestMatch;
    } catch {
      return requestedCode && requestedCode !== 'default' && requestedCode !== 'auto' ? requestedCode : 'hd1080';
    }
  };

  const enforceYouTubeHighestOrSelectedQuality = (player: any, flushIfDowngraded = false) => {
    if (!player) return;
    try {
      const available: string[] =
        typeof player.getAvailableQualityLevels === 'function' ? player.getAvailableQualityLevels() || [] : [];
      const validLevels = available.filter((q) => q && q !== 'auto' && q !== 'default');
      const isAutoMaxMode = !userManuallySelectedQualityRef.current || selectedQualityIdRef.current === 'auto';

      const dims = getYouTubeVirtualDimensions(selectedQualityIdRef.current);
      if (typeof player.setSize === 'function') {
        try {
          player.setSize(dims.width, dims.height);
        } catch {}
      }

      if (validLevels.length === 0) {
        const fallbackCode =
          PLATFORM_QUALITIES.find((opt) => opt.id === selectedQualityIdRef.current)?.ytQualityCode || 'hd1080';
        const effectiveFallback = fallbackCode === 'default' ? 'highres' : fallbackCode;
        player.setPlaybackQualityRange?.(effectiveFallback, isAutoMaxMode ? 'highres' : effectiveFallback);
        player.setPlaybackQuality?.(effectiveFallback);
        return;
      }

      const chosenOpt = PLATFORM_QUALITIES.find((opt) => opt.id === selectedQualityIdRef.current);
      const targetQ = isAutoMaxMode
        ? validLevels[0] // Pick #1 highest quality available in Auto mode
        : resolveAvailableYouTubeQuality(player, chosenOpt?.ytQualityCode || 'hd1080', false);

      player.setPlaybackQualityRange?.(targetQ, isAutoMaxMode ? 'highres' : targetQ);
      player.setPlaybackQuality?.(targetQ);
      hasLockedInitialMaxQualityRef.current = true;
    } catch {}
  };

  // Built-in AdBlocker State (منع الإعلانات والنوافذ المنبثقة داخل المشغل)
  const [adBlockEnabled, setAdBlockEnabled] = useState<boolean>(true);
  const [blockedAdsCount, setBlockedAdsCount] = useState<number>(0);

  // Toast feedback & gesture animations
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<{ side: 'left' | 'right'; text: string } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  const showToastFeedback = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // =========================================================================
  // NETWORK INTERRUPTION & WEAK INTERNET PROTECTION (شاشة سوداء لحماية الرابط عند ضعف أو انقطاع النت)
  // =========================================================================
  const [isNetworkWeakOrOffline, setIsNetworkWeakOrOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const isNetworkWeakRef = useRef<boolean>(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ytBufferingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrubbingRef = useRef<boolean>(false);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const seekDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeekTargetRef = useRef<{ time: number; timestamp: number } | null>(null);
  const shouldResumeAfterSeekRef = useRef<boolean>(false);

  const triggerNetworkBlackout = () => {
    isNetworkWeakRef.current = true;
    setIsNetworkWeakOrOffline(true);
    setError(null);
    setLoading(false);

    // Immediately pause any underlying video/iframe so no error screen or video URL can appear
    if (videoRef.current && !videoRef.current.paused) {
      try {
        videoRef.current.pause();
      } catch {}
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {}
    }
    try {
      const iframe = ytMountRef.current?.querySelector('iframe');
      if (iframe && (iframe as any).contentWindow) {
        (iframe as any).contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
      }
    } catch {}
    setIsPlaying(false);
  };

  const clearNetworkBlackoutAndResume = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      triggerNetworkBlackout();
      return;
    }

    // Verify real connectivity with a fast lightweight ping before removing the black screen
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      await fetch(`/manifest.webmanifest?_netcheck=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        triggerNetworkBlackout();
        return;
      }
    }

    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    if (ytBufferingTimerRef.current) {
      clearTimeout(ytBufferingTimerRef.current);
      ytBufferingTimerRef.current = null;
    }

    isNetworkWeakRef.current = false;
    setIsNetworkWeakOrOffline(false);
    setError(null);
  };

  useEffect(() => {
    const handleOffline = () => {
      triggerNetworkBlackout();
    };

    const handleOnline = () => {
      // Automatically clear blackout once stable connection returns
      clearNetworkBlackoutAndResume();
    };

    const conn = typeof navigator !== 'undefined' ? (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection : null;
    const handleConnectionChange = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        triggerNetworkBlackout();
        return;
      }
      if (conn) {
        // Detect severe connection drop that causes video to stall
        if (
          conn.downlink === 0 ||
          conn.effectiveType === 'slow-2g' ||
          (typeof conn.downlink === 'number' && conn.downlink < 0.15) ||
          (typeof conn.rtt === 'number' && conn.rtt > 3000)
        ) {
          triggerNetworkBlackout();
        }
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    if (conn && typeof conn.addEventListener === 'function') {
      conn.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (conn && typeof conn.removeEventListener === 'function') {
        conn.removeEventListener('change', handleConnectionChange);
      }
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      if (ytBufferingTimerRef.current) clearTimeout(ytBufferingTimerRef.current);
    };
  }, []);

  // Use AVCaption's own native embedded player directly inside the platform
  useEffect(() => {
    if (!isAvcaption) {
      setAvcaptionStreamUrl(null);
      return;
    }

    const avTarget = getAvcaptionEmbedUrl(effectiveRawUrl, useMirror) || effectiveRawUrl;
    setAvcaptionStreamUrl(null);
    setEmbedUrl(avTarget);
    setPlayerMode('embed');
    setLoading(false);
    setError(null);
  }, [isAvcaption, effectiveRawUrl, useMirror]);

  // Listen to real-time playback events from AVCaption Clean Control Bridge
  useEffect(() => {
    if (!isAvcaption) return;

    const handleBridgeMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.source !== 'QAE_AVCAPTION_BRIDGE') return;

      if (msg.type === 'ready' || msg.type === 'durationchange') {
        setLoading(false);
        if (typeof msg.duration === 'number' && msg.duration > 0) {
          setDuration(msg.duration);
        }
      } else if (msg.type === 'timeupdate') {
        if (typeof msg.currentTime === 'number') {
          setCurrentTime(msg.currentTime);
        }
        if (typeof msg.duration === 'number' && msg.duration > 0) {
          setDuration(msg.duration);
        }
        if (typeof msg.paused === 'boolean') {
          setIsPlaying(!msg.paused);
        }
        if (typeof msg.currentTime === 'number' && msg.currentTime > 1 && Math.abs(msg.currentTime - lastSavedTimeRef.current) >= 3) {
          lastSavedTimeRef.current = msg.currentTime;
          saveVideoProgress(videoTrackingId, msg.currentTime, msg.duration || duration || 0, currentUser?.id, !!(msg.duration && msg.currentTime >= msg.duration * 0.92));
        }
      } else if (msg.type === 'play') {
        setIsPlaying(true);
        setLoading(false);
      } else if (msg.type === 'pause') {
        setIsPlaying(false);
      } else if (msg.type === 'ended') {
        setIsPlaying(false);
        saveVideoProgress(videoTrackingId, duration || currentTime, duration || currentTime, currentUser?.id, true);
        onEnded?.();
      } else if (msg.type === 'ad_blocked') {
        setBlockedAdsCount((c) => c + (Number(msg.count) || 1));
      }
    };

    window.addEventListener('message', handleBridgeMessage);
    return () => window.removeEventListener('message', handleBridgeMessage);
  }, [isAvcaption, videoTrackingId, duration, currentTime, currentUser?.id, onEnded]);

  // Helper to send command to AVCaption Clean Bridge Iframe
  const sendAvcaptionCommand = (command: string, value?: any) => {
    const win = avcaptionIframeRef.current?.contentWindow;
    if (win) {
      try {
        win.postMessage({ target: 'QAE_AVCAPTION_PLAYER', command, value }, '*');
      } catch {}
    }
  };

  // Sync mode when URL changes
  useEffect(() => {
    if (isVcdn) {
      const isEmbedStream = Boolean(
        vcdnStreamUrl && (vcdnStreamUrl.includes('embed.vcdn.me') || vcdnStreamUrl.includes('/embed/'))
      );
      const isRealHls = Boolean(
        !isEmbedStream && vcdnStreamUrl && (vcdnStreamUrl.includes('.m3u8') || vcdnStreamUrl.includes('/hls/'))
      );
      if (isEmbedStream && vcdnStreamUrl) {
        setEmbedUrl(vcdnStreamUrl);
        setPlayerMode('embed');
      } else {
        setPlayerMode(isRealHls ? 'hls' : 'direct');
      }
      return;
    } else if (isStreamtape || isPixeldrain) {
      setPlayerMode('direct');
    } else if (ytId) {
      setYtSilentDirectUrl(null);
      setPlayerMode('youtube');
    } else if (isAvcaption) {
      setPlayerMode('embed');
    } else if (isExternalEmbed) {
      setPlayerMode('embed');
    } else if (isHls) {
      setPlayerMode('hls');
    } else if (isDirectFile) {
      setPlayerMode('direct');
    } else if (effectiveRawUrl.startsWith('http://') || effectiveRawUrl.startsWith('https://')) {
      setPlayerMode('embed');
    } else {
      setPlayerMode('direct');
    }
    setEmbedUrl(resolveEmbedUrl(useMirror));
  }, [effectiveRawUrl, useMirror, ytId, gDriveId, vimeoId, isTeraBox, isAvcaption, avcaptionStreamUrl, isStreamtape, isPixeldrain, isHls, isVcdn, vcdnStreamUrl, isDirectFile, isExternalEmbed]);

  // Completely silent same-origin background stream fallback (Zero UI notifications or buttons)
  const activateSilentStreamFallback = () => {
    if (!ytId) return;
    isNetworkWeakRef.current = false;
    setIsNetworkWeakOrOffline(false);
    setError(null);
    setYtSilentDirectUrl(`/api/video/yt-silent-stream/${encodeURIComponent(ytId)}`);
    setPlayerMode('direct');
  };

  // Anti-tamper & contextmenu prevention
  useEffect(() => {
    const container = containerRef.current;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerProtectionAlert();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 's' || e.key === 'S' || e.key === 'p' || e.key === 'P')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j'))
      ) {
        if (container && (container.contains(document.activeElement) || container.matches(':hover'))) {
          e.preventDefault();
          e.stopPropagation();
          triggerProtectionAlert();
          return false;
        }
      }
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    if (container) {
      container.addEventListener('contextmenu', handleContextMenu, { capture: true });
      container.addEventListener('dragstart', handleDragStart, { capture: true });
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu, { capture: true });
        container.removeEventListener('dragstart', handleDragStart, { capture: true });
      }
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Close quality & speed dropdowns when clicking outside
  useEffect(() => {
    if (!showQualityMenu && !showSpeedMenu) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('.quality-speed-menu-container')) {
        setShowQualityMenu(false);
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showQualityMenu, showSpeedMenu]);

  // Student phone + first name for dynamic anti-leaking watermark (e.g. "01040672314 - حسام")
  const studentPhoneOnly = currentUser?.phone || '01040672314';
  const studentFirstName = currentUser?.name ? currentUser.name.trim().split(/\s+/)[0] : 'حسام';
  const watermarkNodeRef = useRef<HTMLDivElement>(null);
  const watermarkCanvasRef = useRef<HTMLCanvasElement>(null);
  const [watermarkRebuildSeed, setWatermarkRebuildSeed] = useState<number>(0);
  const [isWatermarkHiddenPhase, setIsWatermarkHiddenPhase] = useState<boolean>(false);
  const isWatermarkHiddenPhaseRef = useRef<boolean>(false);

  // Stay fixed in each spot for ~5 seconds, then fade out and reappear in a new random spot.
  // When the video is paused (!isPlaying), keep the number fixed in its current spot and visible.
  useEffect(() => {
    if (!isPlaying) {
      isWatermarkHiddenPhaseRef.current = false;
      setIsWatermarkHiddenPhase(false);
      return;
    }

    let fadeTimeout: ReturnType<typeof setTimeout> | null = null;
    let restoreGuardTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      // Fade out briefly before jumping to the new random position
      isWatermarkHiddenPhaseRef.current = true;
      setIsWatermarkHiddenPhase(true);

      fadeTimeout = setTimeout(() => {
        const top = Math.floor(Math.random() * 68) + 12;
        const left = Math.floor(Math.random() * 64) + 12;
        setWatermarkPos({ top, left });
        setIsWatermarkHiddenPhase(false);

        // Keep guard flag active until CSS opacity transition (350ms) finishes completely
        restoreGuardTimeout = setTimeout(() => {
          isWatermarkHiddenPhaseRef.current = false;
        }, 500);
      }, 400);
    }, 5400);

    return () => {
      clearInterval(interval);
      if (fadeTimeout) clearTimeout(fadeTimeout);
      if (restoreGuardTimeout) clearTimeout(restoreGuardTimeout);
    };
  }, [isPlaying]);

  // Render "01040672314 - حسام" onto HTML5 Canvas (without any box around it, matching reference look)
  useEffect(() => {
    const canvas = watermarkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const text = `${String(studentPhoneOnly)} - ${studentFirstName}`;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const width = Math.max(160, text.length * 9.5 + 24);
    const height = 28;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    ctx.font = '700 13px Cairo, Tajawal, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(225, 29, 72, 0.68)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 2;
    ctx.fillText(text, width / 2, height / 2 + 0.5);
  }, [studentPhoneOnly, studentFirstName, watermarkRebuildSeed, watermarkPos]);

  // Active Anti-Tamper Watermark Watchdog:
  // Detects any attempt in DevTools to remove, hide (display:none, visibility:hidden, opacity:0,
  // transform:scale(0), clip-path, width/height:0, or off-screen positioning) the watermark node or canvas.
  // Immediately pauses video playback, triggers the security alert, and rebuilds the watermark DOM node.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isRecovering = false;
    const enforceWatermarkIntegrity = () => {
      if (isRecovering || isWatermarkHiddenPhaseRef.current) return;
      const host = containerRef.current;
      const wm = watermarkNodeRef.current;
      const canvas = watermarkCanvasRef.current;
      if (!host) return;

      let tampered = false;
      if (!wm || !canvas || !host.contains(wm) || !wm.contains(canvas)) {
        tampered = true;
      } else {
        const style = window.getComputedStyle(wm);
        const canvasStyle = window.getComputedStyle(canvas);
        const wmOpacity = parseFloat(style.opacity || '1');
        const canvasOpacity = parseFloat(canvasStyle.opacity || '1');
        const wmRect = wm.getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();

        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.visibility === 'collapse' ||
          canvasStyle.display === 'none' ||
          canvasStyle.visibility === 'hidden' ||
          canvasStyle.visibility === 'collapse' ||
          wmOpacity < 0.25 ||
          canvasOpacity < 0.25 ||
          (style.clipPath && style.clipPath !== 'none') ||
          (canvasStyle.clipPath && canvasStyle.clipPath !== 'none') ||
          style.transform.includes('0, 0') ||
          canvasStyle.transform.includes('0, 0') ||
          canvas.width < 40 ||
          canvas.height < 10 ||
          (hostRect.width > 100 &&
            (wmRect.width < 30 ||
              wmRect.height < 10 ||
              wmRect.right < hostRect.left + 10 ||
              wmRect.left > hostRect.right - 10 ||
              wmRect.bottom < hostRect.top + 10 ||
              wmRect.top > hostRect.bottom - 10))
        ) {
          tampered = true;
        }
      }

      if (tampered) {
        isRecovering = true;
        setWatermarkRebuildSeed((s) => s + 1);
        setTimeout(() => {
          isRecovering = false;
        }, 250);
      }
    };

    const observer = new MutationObserver(() => {
      enforceWatermarkIntegrity();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'id', 'width', 'height'],
    });

    const checkInterval = setInterval(enforceWatermarkIntegrity, 350);

    return () => {
      observer.disconnect();
      clearInterval(checkInterval);
    };
  }, [watermarkRebuildSeed]);

  // =========================================================================
  // YOUTUBE WHITE-LABEL ENTERPRISE PLAYER ENGINE
  // Zero YouTube branding, unmanaged DOM node to prevent React conflicts,
  // 300% vertical overscan cropping, and instant click-to-play with sound.
  // =========================================================================
  useEffect(() => {
    if (!ytId || playerMode !== 'youtube') return;

    let isMounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    ytReadyRef.current = false;
    hasLockedInitialMaxQualityRef.current = false;
    setIsPlaying(false);
    setLoading(true);
    setError(null);

    const initYT = () => {
      if (!window.YT || !window.YT.Player) return false;
      const mountContainer = ytMountRef.current;
      if (!mountContainer) return false;

      try {
        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.destroy(); } catch {}
          ytPlayerRef.current = null;
        }

        // Create a fresh unmanaged DOM child at 1:1 native resolution (zero CSS scale blur)
        mountContainer.innerHTML = '';
        const playerHost = document.createElement('div');
        playerHost.style.width = '100%';
        playerHost.style.height = '100%';
        mountContainer.appendChild(playerHost);

        ytPlayerRef.current = new window.YT.Player(playerHost, {
          width: '100%',
          height: '100%',
          videoId: ytId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            cc_load_policy: 0,
            vq: 'highres',
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              ytReadyRef.current = true;
              setLoading(false);
              setError(null);
              try {
                // Force 1080p virtual viewport so YouTube never caps resolution on mobile/tablet screens
                enforceYouTubeHighestOrSelectedQuality(event.target, false);
                const dur = event.target.getDuration();
                if (dur && dur > 0) setDuration(dur);
                event.target.setVolume(volume * 100);
                if (isMuted) event.target.mute();
                else event.target.unMute();

                // Resume from saved progress if available
                if (initialResumeTimeRef.current > 5 && !hasSeekedRef.current) {
                  hasSeekedRef.current = true;
                  event.target.seekTo(initialResumeTimeRef.current, true);
                  setCurrentTime(initialResumeTimeRef.current);
                }

                // If user already clicked Play while player was initializing, start immediately
                if (pendingPlayRef.current) {
                  pendingPlayRef.current = false;
                  event.target.playVideo();
                }
              } catch {}
            },
            onPlaybackQualityChange: (event: any) => {
              if (!isMounted) return;
              enforceYouTubeHighestOrSelectedQuality(event.target, false);
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              // Re-enforce highest available quality whenever YouTube buffers (3), plays (1), or cues (5)
              if (event.data === 1 || event.data === 3 || event.data === 5) {
                enforceYouTubeHighestOrSelectedQuality(event.target, event.data === 1 && !hasLockedInitialMaxQualityRef.current);
              }
              // 1: PLAYING, 2: PAUSED, 3: BUFFERING, 0: ENDED, 5: CUED
              if (event.data === 1) {
                if (ytBufferingTimerRef.current) {
                  clearTimeout(ytBufferingTimerRef.current);
                  ytBufferingTimerRef.current = null;
                }
                setIsPlaying(true);
                setLoading(false);
                try {
                  const dur = event.target.getDuration();
                  if (dur && dur > 0) setDuration(dur);
                } catch {}
              } else if (event.data === 2) {
                if (ytBufferingTimerRef.current) {
                  clearTimeout(ytBufferingTimerRef.current);
                  ytBufferingTimerRef.current = null;
                }
                setIsPlaying(false);
                setLoading(false);
              } else if (event.data === 3) {
                setLoading(true);
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                  triggerNetworkBlackout();
                  return;
                }
                if (ytBufferingTimerRef.current) clearTimeout(ytBufferingTimerRef.current);
                ytBufferingTimerRef.current = setTimeout(async () => {
                  if (!isMounted) return;
                  if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    triggerNetworkBlackout();
                    return;
                  }
                  const conn = (navigator as any).connection;
                  if (conn && (conn.downlink < 0.4 || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || conn.rtt > 1800)) {
                    triggerNetworkBlackout();
                    return;
                  }
                  try {
                    const controller = new AbortController();
                    const tid = setTimeout(() => controller.abort(), 1600);
                    const start = performance.now();
                    await fetch(`/manifest.json?_ping=${Date.now()}`, {
                      method: 'HEAD',
                      cache: 'no-store',
                      signal: controller.signal,
                    });
                    clearTimeout(tid);
                    if (performance.now() - start > 1400) {
                      triggerNetworkBlackout();
                    }
                  } catch {
                    triggerNetworkBlackout();
                  }
                }, 1800);
              } else if (event.data === 5) {
                setLoading(false);
              } else if (event.data === 0) {
                if (ytBufferingTimerRef.current) {
                  clearTimeout(ytBufferingTimerRef.current);
                  ytBufferingTimerRef.current = null;
                }
                setIsPlaying(false);
                setLoading(false);
                saveVideoProgress(videoTrackingId, duration || currentTime, duration || currentTime, currentUser?.id, true);
                onEnded?.();
              }
            },
            onError: (errEvent: any) => {
              console.warn('Cloud Stream Player notice:', errEvent);
              if (!isMounted) return;
              setLoading(false);
              const errCode = Number(errEvent?.data);
              if (errCode === 100 || errCode === 101 || errCode === 150) {
                activateSilentStreamFallback();
              }
            },
          },
        });
        return true;
      } catch (err) {
        console.warn('Cloud Stream player init notice:', err);
        setLoading(false);
        return false;
      }
    };

    if (!window.YT || !window.YT.Player) {
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => {
          if (isMounted && typeof navigator !== 'undefined' && navigator.onLine) {
            activateSilentStreamFallback();
          }
        };
        document.head.appendChild(tag);
      }
    }

    if (!initYT()) {
      pollTimer = setInterval(() => {
        if (window.YT && window.YT.Player) {
          if (initYT() && pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        }
      }, 40);
    }

    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 1200);

    const silentBlockedTimer = setTimeout(() => {
      if (isMounted && !ytReadyRef.current && (!window.YT || !window.YT.Player) && typeof navigator !== 'undefined' && navigator.onLine) {
        activateSilentStreamFallback();
      }
    }, 15000);

    if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
    ytIntervalRef.current = setInterval(() => {
      if (ytPlayerRef.current && ytReadyRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          if (!hasLockedInitialMaxQualityRef.current) {
            enforceYouTubeHighestOrSelectedQuality(ytPlayerRef.current, true);
          }
          const time = ytPlayerRef.current.getCurrentTime();
          const dur = ytPlayerRef.current.getDuration();
          if (typeof time === 'number' && !isNaN(time)) {
            setCurrentTime(time);
            if (time > 1 && Math.abs(time - lastSavedTimeRef.current) >= 3) {
              lastSavedTimeRef.current = time;
              saveVideoProgress(videoTrackingId, time, dur || duration || 0, currentUser?.id, !!(dur && time >= dur * 0.92));
            }
          }
          if (typeof dur === 'number' && dur > 0 && !isNaN(dur)) setDuration(dur);
        } catch {}
      }
    }, 250);

    return () => {
      isMounted = false;
      ytReadyRef.current = false;
      clearTimeout(fallbackTimer);
      clearTimeout(silentBlockedTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (ytIntervalRef.current) {
        clearInterval(ytIntervalRef.current);
        ytIntervalRef.current = null;
      }
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch {}
        ytPlayerRef.current = null;
      }
      if (ytMountRef.current) {
        ytMountRef.current.innerHTML = '';
      }
    };
  }, [ytId, playerMode, videoId]);

  // HTML5 Video Playback Engine (for MP4, WebM, Wasabi S3, Degoo, HLS, and silent streams)
  useEffect(() => {
    if (playerMode === 'embed' || playerMode === 'youtube' || playerMode === 'avcaption') {
      if (playerMode === 'embed' || playerMode === 'avcaption') {
        setLoading(false);
        setError(null);
      }
      return;
    }

    const activePlayableSource =
      ytId && ytSilentDirectUrl
        ? ytSilentDirectUrl
        : isVcdn
        ? (vcdnStreamUrl || (vcdnVideoId ? `/api/vcdn/stream/${encodeURIComponent(vcdnVideoId)}` : ''))
        : isStreamtape || isPixeldrain
        ? platformSecure.streamUrl
        : isAvcaption && avcaptionStreamUrl
        ? avcaptionStreamUrl
        : effectiveRawUrl;
    if (!activePlayableSource) {
      if (isVcdn && (vcdnLoading || vcdnStatus === 'processing')) {
        setLoading(true);
        return;
      }
      setLoading(false);
      setError('لم يتم تحديد رابط فيديو صالح لهذا الدرس.');
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    setLoading(true);
    setError(null);

    // Destroy previous HLS instance
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    const isM3u8Stream = Boolean(
      activePlayableSource &&
      (activePlayableSource.includes('.m3u8') ||
        activePlayableSource.includes('/api/github-hls/') ||
        activePlayableSource.includes('/hls/') ||
        activePlayableSource.includes('/avcaption-hls')) &&
      !activePlayableSource.includes('.mp4') &&
      !activePlayableSource.includes('/api/vcdn/stream/') &&
      !activePlayableSource.includes('/api/video/stream/')
    );

    if (isM3u8Stream && Hls.isSupported() && activePlayableSource) {
      let hlsNetworkRetried = false;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        autoStartLoad: true,
        startFragPrefetch: true,
        startLevel: 0,
        capLevelToPlayerSize: false,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 1,
        maxFragLookUpTolerance: 0.25,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 12,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        backBufferLength: 30,
        fragLoadingTimeOut: 120000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        manifestLoadingTimeOut: 30000,
        manifestLoadingMaxRetry: 4,
        levelLoadingTimeOut: 30000,
        levelLoadingMaxRetry: 4,
        xhrSetup: (xhr, url) => {
          if (
            adBlockEnabled &&
            /doubleclick|googlesyndication|adserver|preroll|midroll|vast|vmap|popads|exoclick|propellerads|adnxs/i.test(url)
          ) {
            setBlockedAdsCount((c) => c + 1);
            xhr.abort();
            return;
          }
          if (url && url.includes('/api/github-hls/')) {
            try {
              xhr.setRequestHeader('X-Qalb-Key-Shield', 'qalb-aes128-guard-v2');
              xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            } catch {}
          }
        },
      });
      hlsRef.current = hls;
      hls.loadSource(activePlayableSource);
      hls.attachMedia(videoEl);

      // Resolves MPEG-TS audio/video PTS offset gaps when seeking forward into unbuffered segments
      const nudgeOverBufferGapIfNeeded = () => {
        try {
          const buffered = videoEl.buffered;
          if (!buffered || buffered.length === 0) return;
          const cur = videoEl.currentTime || 0;

          // Check if currentTime is already comfortably inside a buffered range
          for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);
            if (cur >= start && cur <= end - 0.1) {
              // If stuck right at the leading edge of a newly loaded forward segment (keyframe PTS ~40-150ms after audio PTS)
              if (
                (videoEl.seeking || videoEl.readyState < 3) &&
                cur - start < 0.08 &&
                end - start > 0.35 &&
                lastSeekTargetRef.current &&
                Date.now() - lastSeekTargetRef.current.timestamp < 5000
              ) {
                videoEl.currentTime = Math.min(end - 0.1, start + 0.12);
              }
              if (shouldResumeAfterSeekRef.current && videoEl.paused && videoEl.readyState >= 2) {
                shouldResumeAfterSeekRef.current = false;
                videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
              }
              return;
            }
          }

          // Current time is in an unbuffered gap; find the closest forward buffered range within 3.0s
          let nearestAheadStart: number | null = null;
          let nearestAheadEnd: number | null = null;
          for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);
            const gap = start - cur;
            if (gap > 0 && gap <= 3.0 && end > start + 0.2) {
              if (nearestAheadStart === null || start < nearestAheadStart) {
                nearestAheadStart = start;
                nearestAheadEnd = end;
              }
            }
          }

          if (nearestAheadStart !== null && nearestAheadEnd !== null) {
            const safeJump = Math.min(nearestAheadEnd - 0.05, nearestAheadStart + 0.08);
            videoEl.currentTime = safeJump;
            if (shouldResumeAfterSeekRef.current && videoEl.paused) {
              shouldResumeAfterSeekRef.current = false;
              videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          }
        } catch {}
      };

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setLoading(false);
        setError(null);
        if (data && data.levels && data.levels.length > 0) {
          const levels: QualityLevel[] = data.levels.map((lvl, idx) => ({
            id: idx,
            height: lvl.height || 0,
            bitrate: lvl.bitrate,
            label: lvl.height ? `${lvl.height}p` : `جودة ${idx + 1}`,
          }));
          levels.sort((a, b) => (b.height - a.height) || ((b.bitrate || 0) - (a.bitrate || 0)));
          setQualityLevels(levels);
          const highestLevelId = levels[0].id;
          setCurrentQuality(highestLevelId);
        }
        videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setLoading(false);
        nudgeOverBufferGapIfNeeded();
      });

      hls.on(Hls.Events.BUFFER_APPENDED, () => {
        if (videoEl.seeking || videoEl.readyState < 3) {
          nudgeOverBufferGapIfNeeded();
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        // Recover immediately from non-fatal seek/stall buffer holes on forward seek
        if (
          !data.fatal &&
          (data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE ||
            data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
            data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL)
        ) {
          nudgeOverBufferGapIfNeeded();
          try {
            hls.startLoad();
          } catch {}
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            triggerNetworkBlackout();
            return;
          }
          if (data.fatal) {
            if (!hlsNetworkRetried) {
              hlsNetworkRetried = true;
              try {
                hls.startLoad();
                return;
              } catch {}
            }
            setLoading(false);
            setError('تعذر تحميل مقطع البث المشفر. اضغط إعادة المحاولة.');
            return;
          }
        }
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (!hlsNetworkRetried) {
                hlsNetworkRetried = true;
                hls.startLoad();
              } else {
                setLoading(false);
                setError('تعذر تحميل دفق الفيديو حالياً. اضغط إعادة المحاولة.');
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              console.warn('[HLS manifest error, fallback to direct MP4 video playback]:', data);
              try { hls.destroy(); } catch {}
              hlsRef.current = null;
              if (isAvcaption) {
                const avTarget = getAvcaptionEmbedUrl(effectiveRawUrl, useMirror) || effectiveRawUrl;
                setEmbedUrl(`/api/video/avcaption-clean-embed?url=${encodeURIComponent(avTarget)}`);
                setPlayerMode('avcaption');
                setLoading(false);
                break;
              }
              // Fallback to direct HTML5 video element
              videoEl.src = activePlayableSource;
              videoEl.preload = 'auto';
              videoEl.load();
              break;
          }
        }
      });
    } else if (isM3u8Stream && activePlayableSource) {
      // Native HLS playback (e.g. Safari on iOS / iPadOS / macOS)
      videoEl.src = activePlayableSource;
      videoEl.preload = 'auto';
      videoEl.load();
    } else {
      // Direct MP4 / WebM / Streamtape Encrypted Stream / Local VCDN Stream / Degoo Stream / AVCaption Direct Stream
      const degooHash = extractDegooShareHash(effectiveRawUrl);
      const playableSrc = isVcdn
        ? (vcdnStreamUrl || (vcdnVideoId ? `/api/vcdn/stream/${encodeURIComponent(vcdnVideoId)}` : activePlayableSource))
        : isStreamtape || isPixeldrain
        ? platformSecure.streamUrl
        : isAvcaption && avcaptionStreamUrl
        ? avcaptionStreamUrl
        : degooHash
        ? `/api/video/stream/degoo_${degooHash}`
        : activePlayableSource.startsWith('http') && !isDropbox
        ? platformSecure.streamUrl
        : playableDirectUrl;
      videoEl.src = playableSrc;
      videoEl.preload = 'auto';
      videoEl.load();
    }

    const fallbackReadyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    let hasAutoStarted = false;
    let streamtapeRetried = false;
    let pixeldrainRetried = false;
    let vcdnDirectRetried = false;

    const handleLoadedMetadata = () => {
      setDuration(videoEl.duration || 0);
      setLoading(false);
      setError(null);

      // Auto-start playback once when user opens video
      if (!hasAutoStarted) {
        hasAutoStarted = true;
        videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
      }

      if (!isHls && videoEl.videoHeight) {
        const height = videoEl.videoHeight;
        const label = height >= 1080 ? '1080p (Full HD)' : height >= 720 ? '720p (HD)' : height >= 480 ? '480p (SD)' : `${height}p`;
        setQualityLevels([{
          id: 0,
          height: height,
          label: label,
        }]);
        setCurrentQuality(0);
      }
    };

    const handleCanPlay = () => {
      if (videoEl.duration && videoEl.duration > 0) {
        setDuration(videoEl.duration);
      }
      setLoading(false);
      setError(null);
      if (shouldResumeAfterSeekRef.current && videoEl.paused) {
        shouldResumeAfterSeekRef.current = false;
        videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };

    const handleSeeked = () => {
      setLoading(false);
      pendingSeekTimeRef.current = null;
      if (shouldResumeAfterSeekRef.current && videoEl.paused) {
        shouldResumeAfterSeekRef.current = false;
        videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };

    const handleTime = () => {
      const cur = videoEl.currentTime || 0;
      const dur = videoEl.duration || duration || 0;

      // Do not overwrite the scrubber UI position with stale pre-seek time while user is dragging or while forward segment is still seeking
      if (isScrubbingRef.current) {
        return;
      }
      if (
        lastSeekTargetRef.current &&
        Date.now() - lastSeekTargetRef.current.timestamp < 1200 &&
        (videoEl.seeking || Math.abs(cur - lastSeekTargetRef.current.time) > 2.5)
      ) {
        return;
      }

      setCurrentTime(cur);
      if (dur > 0 && dur !== duration) {
        setDuration(dur);
      }
      if (cur > 1 && Math.abs(cur - lastSavedTimeRef.current) >= 3) {
        lastSavedTimeRef.current = cur;
        saveVideoProgress(videoTrackingId, cur, dur, currentUser?.id, !!(dur && cur >= dur * 0.92));
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      saveVideoProgress(videoTrackingId, videoEl.duration || currentTime, videoEl.duration || currentTime, currentUser?.id, true);
      onEnded?.();
    };

    const handleWaitingOrStalled = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        triggerNetworkBlackout();
        return;
      }
      // If waiting after a forward seek in HLS, ensure Hls.js is actively loading and nudge over any small MPEG-TS PTS gap
      if (hlsRef.current) {
        try {
          hlsRef.current.startLoad();
        } catch {}
      }
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          triggerNetworkBlackout();
          return;
        }
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 3500);
          await fetch(`/manifest.webmanifest?_ping=${Date.now()}`, {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal,
          });
          clearTimeout(tid);
        } catch {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            triggerNetworkBlackout();
          }
        }
      }, 3000);
    };

    const handlePlayingClearStall = () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      shouldResumeAfterSeekRef.current = false;
      setLoading(false);
    };

    const handleErr = () => {
      console.warn('[Video Player Error] Direct playback error for:', effectiveRawUrl);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        triggerNetworkBlackout();
        return;
      }
      if (isVcdn && vcdnVideoId && !vcdnDirectRetried) {
        vcdnDirectRetried = true;
        const freshUrl = `/api/vcdn/stream/${encodeURIComponent(vcdnVideoId)}?retry=${Date.now()}`;
        videoEl.src = freshUrl;
        videoEl.load();
        videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
        return;
      }
      if (isPixeldrain && !pixeldrainRetried) {
        pixeldrainRetried = true;
        const freshUrl = `${platformSecure.streamUrl}${platformSecure.streamUrl.includes('?') ? '&' : '?'}retry=${Date.now()}`;
        videoEl.src = freshUrl;
        videoEl.load();
        return;
      }
      if (isStreamtape && !streamtapeRetried) {
        streamtapeRetried = true;
        const freshUrl = `${platformSecure.streamUrl}${platformSecure.streamUrl.includes('?') ? '&' : '?'}retry=${Date.now()}`;
        videoEl.src = freshUrl;
        videoEl.load();
        return;
      }
      setLoading(false);
      setError('تعذر تحميل دفق الفيديو حالياً. اضغط إعادة المحاولة.');
    };

    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoEl.addEventListener('canplay', handleCanPlay);
    videoEl.addEventListener('seeked', handleSeeked);
    videoEl.addEventListener('playing', handlePlayingClearStall);
    videoEl.addEventListener('waiting', handleWaitingOrStalled);
    videoEl.addEventListener('stalled', handleWaitingOrStalled);
    videoEl.addEventListener('timeupdate', handleTime);
    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);
    videoEl.addEventListener('ended', handleEnded);
    videoEl.addEventListener('error', handleErr);

    return () => {
      clearTimeout(fallbackReadyTimer);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.removeEventListener('canplay', handleCanPlay);
      videoEl.removeEventListener('seeked', handleSeeked);
      videoEl.removeEventListener('playing', handlePlayingClearStall);
      videoEl.removeEventListener('waiting', handleWaitingOrStalled);
      videoEl.removeEventListener('stalled', handleWaitingOrStalled);
      videoEl.removeEventListener('timeupdate', handleTime);
      videoEl.removeEventListener('play', handlePlay);
      videoEl.removeEventListener('pause', handlePause);
      videoEl.removeEventListener('ended', handleEnded);
      videoEl.removeEventListener('error', handleErr);
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
    };
  }, [effectiveRawUrl, playerMode, isHls, isTeraBox, isAvcaption, avcaptionStreamUrl, isStreamtape, isPixeldrain, isVcdn, vcdnStreamUrl]);

  // Fullscreen and Landscape Orientation Management
  const enterLandscapeFullscreen = async () => {
    const container = containerRef.current as (HTMLDivElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    }) | null;
    if (!container) return;

    let nativeSuccess = false;

    // 1. Try HTML5 Fullscreen API on container
    try {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
        nativeSuccess = true;
      } else if (container.webkitRequestFullscreen) {
        await container.webkitRequestFullscreen();
        nativeSuccess = true;
      } else if (container.mozRequestFullScreen) {
        await container.mozRequestFullScreen();
        nativeSuccess = true;
      } else if (container.msRequestFullscreen) {
        await container.msRequestFullscreen();
        nativeSuccess = true;
      }
    } catch (err) {
      console.debug('Standard Fullscreen request not granted or in iframe:', err);
    }

    // 2. iOS Safari fallback for native video element
    if (!nativeSuccess && videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
      try {
        (videoRef.current as any).webkitEnterFullscreen();
        nativeSuccess = true;
      } catch {}
    }

    // 3. Lock orientation to landscape on mobile devices
    try {
      const orientation = window.screen?.orientation || (window.screen as any)?.mozOrientation || (window.screen as any)?.msOrientation;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape').catch(() => {
          return orientation.lock('landscape-primary').catch(() => {});
        });
      }
    } catch (e) {
      console.debug('Screen orientation lock not supported or denied:', e);
    }

    // If native fullscreen was blocked (e.g. preview iframe sandbox), use CSS pseudo-fullscreen
    if (!nativeSuccess && !document.fullscreenElement) {
      setIsPseudoLandscape(true);
    }

    setIsFullscreen(true);
    showToastFeedback('وضع العرض الأفقي ملء الشاشة 📱↔️');
  };

  const exitLandscapeFullscreen = async () => {
    try {
      const orientation = window.screen?.orientation;
      if (orientation && typeof orientation.unlock === 'function') {
        orientation.unlock();
      }
    } catch {}

    try {
      const doc = document as any;
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch {}

    setIsFullscreen(false);
    setIsPseudoLandscape(false);
  };

  const toggleFullscreenLandscape = () => {
    if (isFullscreen || isPseudoLandscape) {
      exitLandscapeFullscreen();
    } else {
      enterLandscapeFullscreen();
    }
  };

  // Helper to send command to YouTube via Player API and postMessage fallback
  const sendYouTubeCommand = (func: string, args: any[] = []) => {
    if (ytPlayerRef.current && typeof ytPlayerRef.current[func] === 'function') {
      try {
        ytPlayerRef.current[func](...args);
      } catch {}
    }
    const iframe = ytMountRef.current?.querySelector('iframe');
    if (iframe && (iframe as any).contentWindow) {
      try {
        (iframe as any).contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      } catch {}
    }
  };

  // Video Controls Handlers
  const togglePlay = (forcePlayState?: boolean) => {
    const nextPlaying = forcePlayState !== undefined ? forcePlayState : !isPlaying;

    if (playerMode === 'youtube') {
      if (nextPlaying) {
        setLoading(true);
        if (ytReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
          try {
            ytPlayerRef.current.playVideo();
          } catch {}
        } else {
          pendingPlayRef.current = true;
        }
        sendYouTubeCommand('playVideo');
        setIsPlaying(true);
        setTimeout(() => setLoading(false), 450);
      } else {
        pendingPlayRef.current = false;
        sendYouTubeCommand('pauseVideo');
        setIsPlaying(false);
      }
      if (nextPlaying && autoLandscapeOnPlay && !isFullscreen && !isPseudoLandscape) {
        enterLandscapeFullscreen();
      }
      return;
    }

    if (playerMode === 'avcaption') {
      setIsPlaying(nextPlaying);
      sendAvcaptionCommand(nextPlaying ? 'play' : 'pause');
      if (nextPlaying && autoLandscapeOnPlay && !isFullscreen && !isPseudoLandscape) {
        enterLandscapeFullscreen();
      }
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    // Determine target play state from actual video element paused status
    const targetPlaying = forcePlayState !== undefined ? forcePlayState : videoEl.paused;

    if (targetPlaying) {
      if ((!videoEl.src || videoEl.src === window.location.href) && playableSrc) {
        videoEl.src = playableSrc;
        videoEl.load();
      }
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setError(null);
            if (autoLandscapeOnPlay && !isFullscreen && !isPseudoLandscape) {
              enterLandscapeFullscreen();
            }
          })
          .catch((err: any) => {
            console.warn('[Video Play Notice]:', err?.message || err);
            // If browser policy prevented sound on initial user tap, play muted
            if (err?.name === 'NotAllowedError') {
              videoEl.muted = true;
              setIsMuted(true);
              videoEl
                .play()
                .then(() => {
                  setIsPlaying(true);
                  setError(null);
                })
                .catch(() => {});
            }
          });
      }
    } else {
      videoEl.pause();
      setIsPlaying(false);
    }
  };

  const applyVideoSeek = (targetTime: number) => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const maxDur = videoEl.duration || duration || 0;
    const clampedTarget = maxDur > 0 ? Math.max(0, Math.min(maxDur - 0.15, targetTime)) : Math.max(0, targetTime);

    lastSeekTargetRef.current = { time: clampedTarget, timestamp: Date.now() };
    shouldResumeAfterSeekRef.current = isPlaying || !videoEl.paused;

    try {
      videoEl.currentTime = clampedTarget;
    } catch {}

    if (hlsRef.current) {
      try {
        hlsRef.current.startLoad(clampedTarget);
      } catch {}
    }

    // Post-seek verification: if the target segment is already buffered or finishes buffering with a small PTS offset, nudge & play
    setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;
      try {
        const buffered = v.buffered;
        const cur = v.currentTime || 0;
        if (buffered && buffered.length > 0) {
          let isInside = false;
          for (let i = 0; i < buffered.length; i++) {
            if (cur >= buffered.start(i) && cur <= buffered.end(i) - 0.08) {
              isInside = true;
              break;
            }
          }
          if (!isInside) {
            for (let i = 0; i < buffered.length; i++) {
              const gap = buffered.start(i) - cur;
              if (gap > 0 && gap <= 3.0 && buffered.end(i) > buffered.start(i) + 0.2) {
                v.currentTime = buffered.start(i) + 0.08;
                break;
              }
            }
          }
        }
        if (shouldResumeAfterSeekRef.current && v.paused && v.readyState >= 2) {
          shouldResumeAfterSeekRef.current = false;
          v.play().then(() => setIsPlaying(true)).catch(() => {});
        }
      } catch {}
    }, 280);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    pendingSeekTimeRef.current = newTime;

    if (playerMode === 'youtube') {
      sendYouTubeCommand('seekTo', [newTime, true]);
      return;
    }

    if (playerMode === 'avcaption') {
      sendAvcaptionCommand('seek', newTime);
      return;
    }

    isScrubbingRef.current = true;
    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
    }
    seekDebounceTimerRef.current = setTimeout(() => {
      isScrubbingRef.current = false;
      applyVideoSeek(newTime);
    }, 110);
  };

  const handleSeekCommit = () => {
    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
      seekDebounceTimerRef.current = null;
    }
    isScrubbingRef.current = false;
    if (pendingSeekTimeRef.current !== null && playerMode !== 'youtube' && playerMode !== 'avcaption') {
      const target = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = null;
      applyVideoSeek(target);
    }
  };

  const skipSeconds = (seconds: number) => {
    if (playerMode === 'youtube') {
      const target = Math.max(0, Math.min(duration || 1000, currentTime + seconds));
      setCurrentTime(target);
      sendYouTubeCommand('seekTo', [target, true]);
      return;
    }

    if (playerMode === 'avcaption') {
      const target = Math.max(0, Math.min(duration || 3600, currentTime + seconds));
      setCurrentTime(target);
      sendAvcaptionCommand('skip', seconds);
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;
    const baseTime =
      pendingSeekTimeRef.current !== null
        ? pendingSeekTimeRef.current
        : lastSeekTargetRef.current && Date.now() - lastSeekTargetRef.current.timestamp < 900
        ? lastSeekTargetRef.current.time
        : videoEl.currentTime || currentTime || 0;
    const maxDur = videoEl.duration || duration || 0;
    const target = maxDur > 0 ? Math.max(0, Math.min(maxDur - 0.15, baseTime + seconds)) : Math.max(0, baseTime + seconds);
    pendingSeekTimeRef.current = target;
    setCurrentTime(target);
    applyVideoSeek(target);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    const muted = val === 0;
    setIsMuted(muted);

    if (playerMode === 'youtube') {
      sendYouTubeCommand('setVolume', [val * 100]);
      if (muted) sendYouTubeCommand('mute');
      else sendYouTubeCommand('unMute');
      return;
    }

    if (playerMode === 'avcaption') {
      sendAvcaptionCommand('volume', val);
      sendAvcaptionCommand('mute', muted);
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.volume = val;
    videoEl.muted = muted;
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (playerMode === 'youtube') {
      if (nextMuted) sendYouTubeCommand('mute');
      else {
        sendYouTubeCommand('unMute');
        sendYouTubeCommand('setVolume', [volume * 100]);
      }
      return;
    }

    if (playerMode === 'avcaption') {
      sendAvcaptionCommand('mute', nextMuted);
      if (!nextMuted) sendAvcaptionCommand('volume', volume);
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.muted = nextMuted;
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);

    if (playerMode === 'youtube') {
      sendYouTubeCommand('setPlaybackRate', [speed]);
      return;
    }

    if (playerMode === 'avcaption') {
      sendAvcaptionCommand('speed', speed);
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;
    videoEl.playbackRate = speed;
  };

  const handleQualitySelect = (option: VideoQualityOption) => {
    setSelectedQualityId(option.id);
    selectedQualityIdRef.current = option.id;
    userManuallySelectedQualityRef.current = option.id !== 'auto';
    hasLockedInitialMaxQualityRef.current = false;
    setShowQualityMenu(false);

    // 1. If YouTube mode: resize internal ABR viewport, lock playback quality range, and reload stream at current timestamp with target suggestedQuality
    if (playerMode === 'youtube' && ytId) {
      const preferMax = option.id === 'auto';
      const rawCode = option.ytQualityCode && option.ytQualityCode !== 'default' ? option.ytQualityCode : 'hd1080';
      const player = ytPlayerRef.current;
      const targetQ = resolveAvailableYouTubeQuality(player, rawCode, preferMax);
      const dims = getYouTubeVirtualDimensions(option.id);

      sendYouTubeCommand('setSize', [dims.width, dims.height]);
      sendYouTubeCommand('setPlaybackQualityRange', [targetQ, preferMax ? 'highres' : targetQ]);
      sendYouTubeCommand('setPlaybackQuality', [targetQ]);

      if (player) {
        try {
          player.setSize?.(dims.width, dims.height);
          player.setPlaybackQualityRange?.(targetQ, preferMax ? 'highres' : targetQ);
          player.setPlaybackQuality?.(targetQ);
          const curTime =
            typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : currentTime;
          const currentActualQ =
            typeof player.getPlaybackQuality === 'function' ? player.getPlaybackQuality() : '';
          if (currentActualQ !== targetQ && typeof player.loadVideoById === 'function') {
            player.loadVideoById({
              videoId: ytId,
              startSeconds: Math.max(0, Number(curTime) || 0),
              suggestedQuality: targetQ,
            });
          } else if (typeof curTime === 'number' && curTime >= 0) {
            player.seekTo?.(curTime, true);
          }
        } catch {}
      }
    }

    // 1b. If using silent YouTube direct stream fallback: switch stream resolution parameter directly
    if (playerMode === 'direct' && ytId && ytSilentDirectUrl) {
      const targetHeight = option.height || 720;
      const nextUrl = `/api/video/yt-silent-stream/${encodeURIComponent(ytId)}?q=${targetHeight}`;
      if (nextUrl !== ytSilentDirectUrl) {
        const savedTime = videoRef.current?.currentTime || currentTime;
        const wasPlaying = videoRef.current ? !videoRef.current.paused : isPlaying;
        setYtSilentDirectUrl(nextUrl);
        setTimeout(() => {
          if (videoRef.current) {
            if (savedTime > 0) videoRef.current.currentTime = savedTime;
            if (wasPlaying) videoRef.current.play().catch(() => {});
          }
        }, 120);
      }
    }

    // 2. If AVCaption mode:
    if (playerMode === 'avcaption') {
      sendAvcaptionCommand('quality', option.height || option.id);
    }

    // 3. If HLS mode: switch HLS level immediately (loadLevel, nextLevel & currentLevel)
    if (hlsRef.current) {
      if (option.id === 'auto') {
        hlsRef.current.currentLevel = -1;
        hlsRef.current.nextLevel = -1;
        hlsRef.current.loadLevel = -1;
        setCurrentQuality(-1);
      } else if (option.height && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
        let bestIdx = 0;
        let smallestDiff = Infinity;
        hlsRef.current.levels.forEach((lvl, idx) => {
          const diff = Math.abs((lvl.height || 720) - (option.height || 720));
          if (diff < smallestDiff) {
            smallestDiff = diff;
            bestIdx = idx;
          }
        });
        hlsRef.current.loadLevel = bestIdx;
        hlsRef.current.nextLevel = bestIdx;
        hlsRef.current.currentLevel = bestIdx;
        setCurrentQuality(bestIdx);
      }
    }

    // 4. Preserve playback continuity on HTML5 video element
    const videoEl = videoRef.current;
    if (videoEl && playerMode !== 'youtube' && !ytSilentDirectUrl) {
      const savedTime = videoEl.currentTime;
      const wasPlaying = !videoEl.paused;
      if (!hlsRef.current && savedTime > 0) {
        videoEl.currentTime = savedTime;
      }
      if (wasPlaying) {
        videoEl.play().catch(() => {});
      }
    }

    showToastFeedback(`تم تطبيق الجودة: ${option.label} ✅`);
  };

  const isPlayingRef = useRef<boolean>(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const lastTouchTimeRef = useRef<number>(0);

  const scheduleControlsAutoHide = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      const actuallyPlaying =
        isPlayingRef.current || (videoRef.current ? !videoRef.current.paused && !videoRef.current.ended : false);
      if (actuallyPlaying && !isScrubbingRef.current) {
        setIsControlsVisible(false);
        setShowSpeedMenu(false);
        setShowQualityMenu(false);
      }
    }, 5000);
  };

  // Automatically start the 5-second auto-hide countdown whenever the video starts playing or controls become visible
  useEffect(() => {
    if (isPlaying && isControlsVisible && !showQualityMenu && !showSpeedMenu) {
      scheduleControlsAutoHide();
    }
    return () => {
      if (controlsTimeoutRef.current && !isPlaying) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, isControlsVisible, showQualityMenu, showSpeedMenu]);

  // Double tap gesture on mobile: -10s left, +10s right; Single tap: show controls (and auto-hide after 5s) or toggle hide
  const handleTouchScreenTap = (e: React.TouchEvent<HTMLDivElement>) => {
    const now = Date.now();
    lastTouchTimeRef.current = now;
    const touch = e.touches[0];
    if (!touch) return;
    const clientX = touch.clientX;
    const rect = containerRef.current?.getBoundingClientRect();

    if (rect && now - lastTapRef.current.time < 320) {
      // Double tap recognized
      const relativeX = clientX - rect.left;
      const width = rect.width;

      if (relativeX < width * 0.35) {
        skipSeconds(-10);
        setDoubleTapFeedback({ side: 'left', text: '-10 ثوانٍ' });
        setTimeout(() => setDoubleTapFeedback(null), 750);
        lastTapRef.current = { time: 0, x: 0 };
        setIsControlsVisible(true);
        scheduleControlsAutoHide();
        return;
      } else if (relativeX > width * 0.65) {
        skipSeconds(10);
        setDoubleTapFeedback({ side: 'right', text: '+10 ثوانٍ' });
        setTimeout(() => setDoubleTapFeedback(null), 750);
        lastTapRef.current = { time: 0, x: 0 };
        setIsControlsVisible(true);
        scheduleControlsAutoHide();
        return;
      }
    }

    lastTapRef.current = { time: now, x: clientX };
    setIsControlsVisible((prev) => {
      const next = !prev;
      if (next) {
        scheduleControlsAutoHide();
      } else if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      return next;
    });
  };

  const handleMouseMove = () => {
    // Ignore synthetic mousemove events fired immediately after a mobile touch tap
    if (Date.now() - lastTouchTimeRef.current < 800) {
      return;
    }
    setIsControlsVisible(true);
    scheduleControlsAutoHide();
  };

  const studentIdentifier = currentUser?.phone
    ? `طالب: ${currentUser.name || 'طالب المنصة'} - ${currentUser.phone}`
    : currentUser?.email
    ? `طالب: ${currentUser.name || 'طالب المنصة'} - ${currentUser.email}`
    : videoId
    ? `طالب منصة المتفلسفة  - ID: ${videoId}`
    : 'منصة المتفلسفة  - محتوى محمي';

  const retryPlayback = () => {
    setLoading(true);
    setError(null);
    if (ytId) {
      setPlayerMode('youtube');
      return;
    }
    if (playerMode === 'embed') {
      setEmbedUrl(resolveEmbedUrl(useMirror));
      setTimeout(() => setLoading(false), 800);
    } else {
      setPlayerMode(isHls ? 'hls' : 'direct');
      const videoEl = videoRef.current;
      if (videoEl && !isHls) {
        const degooHash = extractDegooShareHash(effectiveRawUrl);
        const playableSrc = isVcdn
          ? (vcdnStreamUrl || (vcdnVideoId ? `/api/vcdn/stream/${encodeURIComponent(vcdnVideoId)}` : effectiveRawUrl))
          : isStreamtape || isPixeldrain
          ? platformSecure.streamUrl
          : isAvcaption && avcaptionStreamUrl
          ? avcaptionStreamUrl
          : degooHash
          ? `/api/video/stream/degoo_${degooHash}`
          : effectiveRawUrl.startsWith('http') && !isDropbox
          ? platformSecure.streamUrl
          : playableDirectUrl;
        videoEl.src = playableSrc;
        videoEl.load();
        videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const isMobileLandscapeMode = isFullscreen || isPseudoLandscape;
  const currentQualityOption = PLATFORM_QUALITIES.find((q) => q.id === selectedQualityId) || PLATFORM_QUALITIES[0];

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchScreenTap}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerProtectionAlert();
        return false;
      }}
      className={`relative w-full max-w-full bg-slate-950 select-none group transition-all duration-300 overflow-hidden ${
        isMobileLandscapeMode
          ? 'fixed inset-0 z-[999999] w-screen h-screen max-w-none rounded-none border-0 flex flex-col justify-center items-center'
          : 'aspect-video rounded-2xl border border-slate-800 shadow-2xl'
      }`}
    >
      {/* Clean Video Stage: No top bar, no lecture title, and no landscape mode buttons at the top */}

      {/* Double tap gesture visual feedback (rewind/forward 10s) */}
      {doubleTapFeedback && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center w-24 h-24 rounded-full bg-black/80 backdrop-blur-md text-white border border-white/20 animate-in fade-in zoom-in-75 pointer-events-none shadow-2xl ${
            doubleTapFeedback.side === 'left' ? 'left-8 sm:left-16' : 'right-8 sm:right-16'
          }`}
        >
          {doubleTapFeedback.side === 'left' ? (
            <RotateCcw className="w-8 h-8 text-amber-400 animate-spin" />
          ) : (
            <RotateCw className="w-8 h-8 text-indigo-400 animate-spin" />
          )}
          <span className="text-xs font-black mt-1 font-mono">{doubleTapFeedback.text}</span>
        </div>
      )}


      {/* Loading state indicator */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs text-slate-200 p-6 pointer-events-none">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-300 animate-pulse text-center max-w-md">
            يتم الآن تجهيز مشغل الفيديو بأعلى جودة وحماية...
          </p>
        </div>
      )}

      {/* VCDN Processing State Presentation */}
      {isVcdn && vcdnStatus === 'processing' && !vcdnStreamUrl && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 text-slate-200 p-6 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <h4 className="text-sm font-bold text-white">الفيديو قيد التجهيز والبث (Processing) ⏳</h4>
          <p className="text-xs text-slate-300 max-w-md leading-relaxed">
            يتم تجهيز بث الفيديو وتشفيره لحماية المحتوى وضمان التشغيل بدون تقطيع.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={async () => {
                if (vcdnVideoId) {
                  await fetch(`/api/vcdn/videos/${encodeURIComponent(vcdnVideoId)}/mark-ready`, { method: 'POST' }).catch(() => {});
                }
                setVcdnStatus('ready');
                retryPlayback();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>تأكيد الجاهزية والتشغيل فوراً ⚡</span>
            </button>
            <button
              onClick={() => retryPlayback()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث الحالة 🔄</span>
            </button>
          </div>
        </div>
      )}

      {/* Subscription blocked state presentation (video-box video-wrapper matching user script) */}
      {authBlockedMessage && (
        <div className="video-box absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/95 text-slate-200 p-6 text-center">
          <div id="video-wrapper" className="max-w-md w-full flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
              <Lock className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white mb-2">محتوى مخصص للمشتركين</h4>
            <div className="error-msg w-full p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs sm:text-sm leading-relaxed mb-4">
              {authBlockedMessage}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = document.getElementById('subscriptions-section') || document.getElementById('courses-section');
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    window.location.hash = '#subscription';
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>تفعيل الاشتراك الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error state presentation */}
      {error && !loading && !authBlockedMessage && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 text-slate-200 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">تعذر تشغيل الفيديو</h4>
          <p className="text-xs text-slate-400 max-w-md mb-4">{error}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={retryPlayback}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>
            {isTeraBox && playerMode !== 'embed' && (
              <button
                onClick={() => setPlayerMode('embed')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>التبديل إلى المشغل المدمج</span>
              </button>
            )}
            {ytId && playerMode !== 'embed' && (
              <button
                onClick={() => setPlayerMode('embed')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>المشغل المدمج المحمي</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Right-click / long-press is blocked silently without any popup message */}

      {/* SOLID BLACK SCREEN OVERLAY ON INTERNET DISCONNECTION OR WEAKNESS (تظهر فوراً قبل ظهور رابط الفيديو) */}
      {isNetworkWeakOrOffline && (
        <div
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          }}
          className="absolute inset-0 z-[999998] bg-black flex flex-col items-center justify-center p-6 text-center select-none"
        >
          <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_30px_rgba(244,63,94,0.25)]">
            <WifiOff className="w-8 h-8 animate-pulse" />
          </div>
          <p className="text-white text-base sm:text-xl font-black tracking-wide max-w-lg leading-relaxed mb-5">
            في مشكلة في النت يا بطل اتاكد من سرعة النت
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearNetworkBlackoutAndResume();
            }}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة المحاولة واستئناف الفيديو</span>
          </button>
        </div>
      )}

      {/* Self-healing Canvas-rendered anti-tamper watermark (--phone) with NO background box */}
      <div
        key={`wm_guard_${watermarkRebuildSeed}`}
        ref={watermarkNodeRef}
        style={{
          top: `${watermarkPos.top}%`,
          left: `${watermarkPos.left}%`,
          opacity: isWatermarkHiddenPhase ? 0 : 0.85,
          transition: 'opacity 0.35s ease-in-out',
        }}
        dir="ltr"
        className="absolute z-[9999999] pointer-events-none select-none flex items-center justify-center"
      >
        <canvas ref={watermarkCanvasRef} className="block pointer-events-none select-none" />
      </div>

      {/* ========================================================================= */}
      {/* 1. ENTERPRISE WHITE-LABEL CLOUD STREAM PLAYER (Zero YouTube Identity)     */}
      {/* ========================================================================= */}
      {(playerMode === 'youtube' && ytId) || (playerMode === 'avcaption' && isAvcaption) ? (
        <div className="relative w-full h-full aspect-video bg-black flex items-center justify-center overflow-hidden group/yt">
          {/* 300% Vertical Overscan Stage: Pushes YouTube top title bar, share buttons & bottom logo completely outside the visible frame */}
          {playerMode === 'youtube' && ytId ? (
            <div
              ref={ytMountRef}
              className="absolute inset-x-0 -top-[100%] w-full h-[300%] pointer-events-none select-none [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!max-w-none [&_iframe]:!border-0 [&_iframe]:!pointer-events-none"
            />
          ) : (
            <div
              style={{ filter: qualityVisualFilter }}
              className="w-full h-full pointer-events-none scale-[1.01] transform transition-[filter] duration-300 [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!max-w-full"
            >
              <iframe
                ref={avcaptionIframeRef}
                key={`${embedUrl}_avcaption_controlled`}
                src={embedUrl}
                className="w-full h-full aspect-video border-0 bg-black pointer-events-none"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-forms"
                referrerPolicy="no-referrer"
                title="مشغل منصة المتفلسفة  الخاص - بدون إعلانات"
                onLoad={() => setLoading(false)}
              />
            </div>
          )}

          {/* Full-Stage Interactive Shield: Captures all clicks/taps/right-clicks so the underlying iframe is 100% untouchable */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (showQualityMenu || showSpeedMenu) {
                setShowQualityMenu(false);
                setShowSpeedMenu(false);
                return;
              }
              // Ignore synthetic click right after mobile touch (already handled by handleTouchScreenTap)
              if (Date.now() - lastTouchTimeRef.current < 800) {
                return;
              }
              setIsControlsVisible((prev) => {
                const next = !prev;
                if (next) scheduleControlsAutoHide();
                return next;
              });
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              toggleFullscreenLandscape();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              triggerProtectionAlert();
            }}
            className="absolute inset-0 z-20 cursor-pointer select-none bg-transparent"
          />

          {/* Platform Paused / Start / End Cover Shield: Hides YouTube pause recommendations & end-screen suggestions */}
          {(!isPlaying || (duration > 0 && currentTime >= duration - 1.2)) && !error && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                togglePlay(true);
                setIsControlsVisible(true);
                scheduleControlsAutoHide();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerProtectionAlert();
              }}
              className="absolute inset-0 z-25 cursor-pointer select-none overflow-hidden bg-black/55 backdrop-blur-xs transition-all duration-200"
            />
          )}

          {/* CENTER FLOATING TRANSPORT CONTROLS (3 Circular Buttons: « -10s | Play/Pause | » +10s) */}
          {!loading && !error && (
            <div
              dir="ltr"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={`absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center gap-10 sm:gap-20 md:gap-28 pointer-events-none transition-opacity duration-200 ${
                isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Left Circle: Rewind 10s («) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  skipSeconds(-10);
                  setIsControlsVisible(true);
                  scheduleControlsAutoHide();
                }}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/45 hover:bg-black/65 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-[2px] shadow-lg ${
                  isControlsVisible || !isPlaying ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                title="إرجاع 10 ثوانٍ"
              >
                <ChevronsLeft className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
              </button>

              {/* Center Circle: Play / Pause (|| or ▶) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                  setIsControlsVisible(true);
                  scheduleControlsAutoHide();
                }}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/45 hover:bg-black/65 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-[2px] shadow-lg ${
                  isControlsVisible || !isPlaying ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                ) : (
                  <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-0.5" />
                )}
              </button>

              {/* Right Circle: Forward 10s (») */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  skipSeconds(10);
                  setIsControlsVisible(true);
                  scheduleControlsAutoHide();
                }}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/45 hover:bg-black/65 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-[2px] shadow-lg ${
                  isControlsVisible || !isPlaying ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                title="تقديم 10 ثوانٍ"
              >
                <ChevronsRight className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
              </button>
            </div>
          )}

          {/* BOTTOM CONTROL BAR (Blue Progress Scrubber + Timestamp Left + Settings Gear & Fullscreen Right) */}
          <div
            dir="ltr"
            onTouchStart={(e) => {
              e.stopPropagation();
              scheduleControlsAutoHide();
            }}
            onClick={(e) => {
              e.stopPropagation();
              scheduleControlsAutoHide();
            }}
            className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-6 pb-2.5 px-3 sm:px-5 z-30 transition-opacity duration-200 flex flex-col gap-2 max-w-full overflow-visible ${
              isControlsVisible || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Blue Scrubber / Progress Bar with White Circular Thumb */}
            <div className="relative flex items-center w-full h-4 group/scrub" dir="ltr">
              <div className="w-full h-1 group-hover/scrub:h-1.5 bg-white/35 rounded-full overflow-hidden relative transition-all pointer-events-none">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(0, ((currentTime || 0) / (duration || 100)) * 100))}%` }}
                />
              </div>
              <input
                type="range"
                dir="ltr"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.75)] pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform group-hover/scrub:scale-125"
                style={{ left: `${Math.min(100, Math.max(0, ((currentTime || 0) / (duration || 100)) * 100))}%` }}
              />
            </div>

            {/* Bottom Controls Row: Left = Time (19:45 / 01:35:51), Right = Settings Gear + Fullscreen Frame */}
            <div dir="ltr" className="flex items-center justify-between text-white">
              {/* Left: Timestamp */}
              <div className="text-xs sm:text-sm font-mono tabular-nums font-semibold text-white select-none whitespace-nowrap tracking-tight">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1 text-white/90">/</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Right: Settings Gear + Fullscreen Frame */}
              <div className="flex items-center gap-3.5 sm:gap-4 relative">
                {/* Unified Settings Gear Button (Quality + Speed) */}
                <div className="relative quality-speed-menu-container">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (showQualityMenu || showSpeedMenu) {
                        setShowQualityMenu(false);
                        setShowSpeedMenu(false);
                      } else {
                        setShowQualityMenu(true);
                      }
                    }}
                    className="p-1 text-white hover:text-white/80 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                    title="الإعدادات (الجودة وسرعة التشغيل)"
                  >
                    <Settings
                      className={`w-5 h-5 sm:w-5.5 sm:h-5.5 transition-transform duration-200 ${
                        showQualityMenu || showSpeedMenu ? 'rotate-45' : ''
                      }`}
                    />
                  </button>

                  {(showQualityMenu || showSpeedMenu) && (
                    <div
                      dir="rtl"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-full mb-3 right-0 bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-2 shadow-2xl flex flex-col gap-1.5 z-50 min-w-[210px] max-w-[85vw] max-h-[230px] overflow-y-auto overscroll-contain text-right pointer-events-auto"
                    >
                      {/* Tabs inside Settings Popover: Quality vs Speed */}
                      <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 sticky top-0 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowQualityMenu(true);
                            setShowSpeedMenu(false);
                          }}
                          className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                            showQualityMenu && !showSpeedMenu
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Sliders className="w-3 h-3" />
                          <span>الجودة ({currentQualityOption.shortLabel})</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSpeedMenu(true);
                            setShowQualityMenu(false);
                          }}
                          className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                            showSpeedMenu
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Gauge className="w-3 h-3" />
                          <span>السرعة ({playbackSpeed}x)</span>
                        </button>
                      </div>

                      {!showSpeedMenu ? (
                        <div className="flex flex-col gap-0.5">
                          {PLATFORM_QUALITIES.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQualitySelect(opt);
                              }}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-right text-xs font-bold transition-colors cursor-pointer ${
                                selectedQualityId === opt.id
                                  ? 'bg-white/15 text-white'
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono">{opt.label}</span>
                                {opt.badge && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-bold">
                                    {opt.badge}
                                  </span>
                                )}
                              </div>
                              {selectedQualityId === opt.id && <Check className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                changeSpeed(s);
                              }}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-right text-xs font-bold transition-colors cursor-pointer ${
                                playbackSpeed === s
                                  ? 'bg-white/15 text-white'
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span className="font-mono">{s === 1 ? '1x (عادي)' : `${s}x`}</span>
                              {playbackSpeed === s && <Check className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fullscreen Frame Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreenLandscape();
                  }}
                  className="p-1 text-white hover:text-white/80 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                  title={isMobileLandscapeMode ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
                >
                  {isMobileLandscapeMode ? (
                    <Minimize className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  ) : (
                    <Maximize className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : playerMode === 'embed' && embedUrl ? (
        /* ========================================================================= */
        /* 2. PROTECTED EMBED (AVCaption, TeraBox, Drive, Vimeo, or Fallback YouTube) */
        /* ========================================================================= */
        <div className="relative w-full h-full aspect-video bg-black flex items-center justify-center overflow-hidden [&_iframe]:!w-full [&_iframe]:!h-full [&_iframe]:!max-w-full">
          <iframe
            key={embedUrl}
            src={embedUrl}
            className="w-full h-full max-w-full aspect-video border-0 bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups"
            referrerPolicy={isAvcaption ? 'origin-when-cross-origin' : isDood ? 'origin' : 'no-referrer'}
            title="مشغل منصة المتفلسفة  الخاص"
            onLoad={() => setLoading(false)}
          />
          {/* Floating Fullscreen & Mirror Buttons */}
          <div className="absolute bottom-2.5 right-2.5 z-30 flex items-center gap-2">
            {isDood && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextMirror = !useMirror;
                  setUseMirror(nextMirror);
                  setEmbedUrl(resolveEmbedUrl(nextMirror));
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-950/90 hover:bg-indigo-700 text-indigo-200 hover:text-white border border-indigo-500/30 shadow-xl backdrop-blur-md transition-all cursor-pointer active:scale-95 text-[11px] font-bold"
                title="التبديل إلى سيرفر بديل لـ DoodStream"
              >
                <span>تبديل السيرفر 🔄</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreenLandscape();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-indigo-600 text-white border border-white/20 shadow-xl backdrop-blur-md transition-all cursor-pointer active:scale-95 text-[11px] font-bold"
              title={isMobileLandscapeMode ? 'الخروج من الشاشة الكاملة' : 'تكبير ملء الشاشة (مع حفظ العلامة المائية)'}
            >
            {isMobileLandscapeMode ? (
              <>
                <Minimize className="w-4 h-4 text-amber-300" />
                <span>تصغير الشاشة</span>
              </>
            ) : (
              <>
                <Maximize className="w-4 h-4 text-indigo-300" />
                <span>ملء الشاشة</span>
              </>
            )}
            </button>
          </div>

          {/* If YouTube in embed mode: apply the same blur and no-touch shields across ALL videos */}
          {ytId && (
            <>
              {/* Bottom Right Blur & No-Touch shield (YouTube logo) */}
              <div
                className="absolute bottom-0 right-0 w-32 sm:w-44 h-11 sm:h-14 z-20 backdrop-blur-md bg-black/80 rounded-tl-2xl pointer-events-auto select-none cursor-default flex items-center justify-center border-t border-l border-white/10 shadow-lg"
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); triggerProtectionAlert(); }}
              >
                <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>المتفلسفة </span>
                </span>
              </div>

              {/* Bottom Left Blur & No-Touch shield (Channel avatar / suggestions) */}
              <div
                className="absolute bottom-0 left-0 w-24 sm:w-36 h-11 sm:h-14 z-20 backdrop-blur-md bg-black/80 rounded-tr-2xl pointer-events-auto select-none cursor-default flex items-center justify-center border-t border-r border-white/10 shadow-lg"
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); triggerProtectionAlert(); }}
              >
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>محمي</span>
                </span>
              </div>
            </>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 3. NATIVE HTML5 PLAYER (MP4, WebM, Wasabi, Degoo, HLS) */
        /* ========================================================================= */
        <div className="relative w-full h-full aspect-video bg-black flex items-center justify-center group/player overflow-hidden">
          <video
            ref={videoRef}
            src={playerMode === 'direct' ? playableSrc : undefined}
            style={getHtml5QualityStyle(selectedQualityId)}
            className="w-full h-full max-w-full aspect-video bg-black cursor-pointer object-contain transition-[filter] duration-300"
            preload="auto"
            playsInline
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            onClick={() => {
              if (showQualityMenu || showSpeedMenu) {
                setShowQualityMenu(false);
                setShowSpeedMenu(false);
                return;
              }
              // Ignore synthetic click right after mobile touch (already handled by handleTouchScreenTap)
              if (Date.now() - lastTouchTimeRef.current < 800) {
                return;
              }
              setIsControlsVisible((prev) => {
                const next = !prev;
                if (next) scheduleControlsAutoHide();
                return next;
              });
            }}
            onDoubleClick={toggleFullscreenLandscape}
          />

          {/* CENTER FLOATING TRANSPORT CONTROLS (3 Circular Buttons: « -10s | Play/Pause | » +10s) */}
          {!loading && !error && (
            <div
              dir="ltr"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className={`absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center gap-10 sm:gap-20 md:gap-28 pointer-events-none transition-opacity duration-200 ${
                isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Left Circle: Rewind 10s («) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  skipSeconds(-10);
                  setIsControlsVisible(true);
                  scheduleControlsAutoHide();
                }}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/45 hover:bg-black/65 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-[2px] shadow-lg ${
                  isControlsVisible || !isPlaying ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                title="إرجاع 10 ثوانٍ"
              >
                <ChevronsLeft className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
              </button>

              {/* Center Circle: Play / Pause (|| or ▶) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                  setIsControlsVisible(true);
                  scheduleControlsAutoHide();
                }}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/45 hover:bg-black/65 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-[2px] shadow-lg ${
                  isControlsVisible || !isPlaying ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                ) : (
                  <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-0.5" />
                )}
              </button>

              {/* Right Circle: Forward 10s (») */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  skipSeconds(10);
                  setIsControlsVisible(true);
                  scheduleControlsAutoHide();
                }}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/45 hover:bg-black/65 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-[2px] shadow-lg ${
                  isControlsVisible || !isPlaying ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
                title="تقديم 10 ثوانٍ"
              >
                <ChevronsRight className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
              </button>
            </div>
          )}

          {/* BOTTOM CONTROL BAR (Blue Progress Scrubber + Timestamp Left + Settings Gear & Fullscreen Right) */}
          <div
            dir="ltr"
            onTouchStart={(e) => {
              e.stopPropagation();
              scheduleControlsAutoHide();
            }}
            onClick={(e) => {
              e.stopPropagation();
              scheduleControlsAutoHide();
            }}
            className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-6 pb-2.5 px-3 sm:px-5 z-30 transition-opacity duration-200 flex flex-col gap-2 max-w-full overflow-visible ${
              isControlsVisible || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Blue Scrubber / Progress Bar with White Circular Thumb */}
            <div className="relative flex items-center w-full h-4 group/scrub" dir="ltr">
              <div className="w-full h-1 group-hover/scrub:h-1.5 bg-white/35 rounded-full overflow-hidden relative transition-all pointer-events-none">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(0, ((currentTime || 0) / (duration || 100)) * 100))}%` }}
                />
              </div>
              <input
                type="range"
                dir="ltr"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                onMouseUp={handleSeekCommit}
                onTouchEnd={handleSeekCommit}
                onPointerUp={handleSeekCommit}
                onKeyUp={handleSeekCommit}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.75)] pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform group-hover/scrub:scale-125"
                style={{ left: `${Math.min(100, Math.max(0, ((currentTime || 0) / (duration || 100)) * 100))}%` }}
              />
            </div>

            {/* Bottom Controls Row: Left = Time (19:45 / 01:35:51), Right = Settings Gear + Fullscreen Frame */}
            <div dir="ltr" className="flex items-center justify-between text-white">
              {/* Left: Timestamp */}
              <div className="text-xs sm:text-sm font-mono tabular-nums font-semibold text-white select-none whitespace-nowrap tracking-tight">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1 text-white/90">/</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Right: Settings Gear + Fullscreen Frame */}
              <div className="flex items-center gap-3.5 sm:gap-4 relative">
                {/* Unified Settings Gear Button (Quality + Speed) */}
                <div className="relative quality-speed-menu-container">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (showQualityMenu || showSpeedMenu) {
                        setShowQualityMenu(false);
                        setShowSpeedMenu(false);
                      } else {
                        setShowQualityMenu(true);
                      }
                    }}
                    className="p-1 text-white hover:text-white/80 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                    title="الإعدادات (الجودة وسرعة التشغيل)"
                  >
                    <Settings
                      className={`w-5 h-5 sm:w-5.5 sm:h-5.5 transition-transform duration-200 ${
                        showQualityMenu || showSpeedMenu ? 'rotate-45' : ''
                      }`}
                    />
                  </button>

                  {(showQualityMenu || showSpeedMenu) && (
                    <div
                      dir="rtl"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-full mb-3 right-0 bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-2 shadow-2xl flex flex-col gap-1.5 z-50 min-w-[210px] max-w-[85vw] max-h-[230px] overflow-y-auto overscroll-contain text-right pointer-events-auto"
                    >
                      {/* Tabs inside Settings Popover: Quality vs Speed */}
                      <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 sticky top-0 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowQualityMenu(true);
                            setShowSpeedMenu(false);
                          }}
                          className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                            showQualityMenu && !showSpeedMenu
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Sliders className="w-3 h-3" />
                          <span>الجودة ({currentQualityOption.shortLabel})</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSpeedMenu(true);
                            setShowQualityMenu(false);
                          }}
                          className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                            showSpeedMenu
                              ? 'bg-red-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Gauge className="w-3 h-3" />
                          <span>السرعة ({playbackSpeed}x)</span>
                        </button>
                      </div>

                      {!showSpeedMenu ? (
                        <div className="flex flex-col gap-0.5">
                          {PLATFORM_QUALITIES.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQualitySelect(opt);
                              }}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-right text-xs font-bold transition-colors cursor-pointer ${
                                selectedQualityId === opt.id
                                  ? 'bg-white/15 text-white'
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono">{opt.label}</span>
                                {opt.badge && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-bold">
                                    {opt.badge}
                                  </span>
                                )}
                              </div>
                              {selectedQualityId === opt.id && <Check className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                changeSpeed(s);
                              }}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-right text-xs font-bold transition-colors cursor-pointer ${
                                playbackSpeed === s
                                  ? 'bg-white/15 text-white'
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span className="font-mono">{s === 1 ? '1x (عادي)' : `${s}x`}</span>
                              {playbackSpeed === s && <Check className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Fullscreen Frame Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreenLandscape();
                  }}
                  className="p-1 text-white hover:text-white/80 transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                  title={isMobileLandscapeMode ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
                >
                  {isMobileLandscapeMode ? (
                    <Minimize className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  ) : (
                    <Maximize className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecureVideoPlayer;
