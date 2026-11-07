/**
 * Device Fingerprint & Hardware Identity Utility
 * Manages persistent Device ID and hardware fingerprint for account security and anti-sharing protection.
 */

// Simple string hash function (djb2 / murmur-style)
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Generate an offscreen canvas fingerprint hash
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'nocanvas';

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('QalbAlElm,🔒2026', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('QalbAlElm,🔒2026', 4, 17);

    return hashString(canvas.toDataURL());
  } catch {
    return 'canvase_err';
  }
}

// Detect human-readable Device & Operating System
export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'جهاز غير معروف';

  const ua = navigator.userAgent || '';
  let os = 'جهاز غير معروف';
  let browser = 'متصفح';

  // OS detection
  if (/iPad|iPhone|iPod/.test(ua)) {
    os = 'iPhone / iPad (iOS)';
  } else if (/Android/.test(ua)) {
    os = 'هاتف / تابلت Android';
  } else if (/Windows NT 10.0|Windows NT 11.0/.test(ua)) {
    os = 'كمبيوتر Windows';
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'كمبيوتر Apple Mac';
  } else if (/CrOS/.test(ua)) {
    os = 'جهاز Chromebook';
  } else if (/Linux/.test(ua)) {
    os = 'نظام Linux';
  }

  // Browser detection
  if (/Edg\//.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome\//.test(ua) && !/SamsungBrowser/.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox\//.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/SamsungBrowser\//.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/OPR\//.test(ua) || /Opera\//.test(ua)) {
    browser = 'Opera';
  }

  return `${os} - ${browser}`;
}

const DEVICE_STORAGE_KEY = 'qalb_alelm_hardware_device_id';

// Read device ID from document.cookie
function getCookieDeviceId(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + DEVICE_STORAGE_KEY + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

// Write device ID to document.cookie (1-year persistence)
function setCookieDeviceId(id: string) {
  try {
    if (typeof document === 'undefined') return;
    const maxAge = 365 * 24 * 60 * 60; // 1 year
    document.cookie = `${DEVICE_STORAGE_KEY}=${encodeURIComponent(id)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {}
}

/**
 * Returns a persistent, unique device identifier based on storage + hardware fingerprint
 */
export async function getOrCreateDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'server_device';

  // 1. Try reading existing stored device ID from localStorage, sessionStorage, or persistent cookie
  let storedId: string | null = null;
  try {
    storedId =
      localStorage.getItem(DEVICE_STORAGE_KEY) ||
      sessionStorage.getItem(DEVICE_STORAGE_KEY) ||
      getCookieDeviceId();
  } catch {}

  // 2. Generate hardware signature components
  const screenPart = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`;
  const tz = Intl?.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '';
  const lang = navigator.language || '';
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const canvasHash = getCanvasFingerprint();
  const rawSignature = `${screenPart}|${tz}|${lang}|${hardwareConcurrency}|${canvasHash}`;
  const hardwareHash = hashString(rawSignature);

  if (storedId && storedId.startsWith('dev_')) {
    // Keep storages in sync in case one was cleared
    try {
      localStorage.setItem(DEVICE_STORAGE_KEY, storedId);
      sessionStorage.setItem(DEVICE_STORAGE_KEY, storedId);
      setCookieDeviceId(storedId);
    } catch {}
    return storedId;
  }

  // Generate new device ID composed of hardware hash + high-entropy random key
  const randomEntropy = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const newDeviceId = `dev_${hardwareHash}_${randomEntropy}`;

  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, newDeviceId);
    sessionStorage.setItem(DEVICE_STORAGE_KEY, newDeviceId);
    setCookieDeviceId(newDeviceId);
  } catch {}

  return newDeviceId;
}

/**
 * Returns complete device payload for authentication requests
 */
export async function getDeviceInfoPayload(): Promise<{ deviceId: string; deviceName: string; fingerprintHash?: string }> {
  const deviceId = await getOrCreateDeviceId();
  const deviceName = getDeviceName();
  const canvasHash = getCanvasFingerprint();
  return { deviceId, deviceName, fingerprintHash: canvasHash };
}

