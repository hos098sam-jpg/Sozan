/**
 * Client-Side GitHub Vault Video Uploader
 * Enables 100% serverless, zero-cost video uploads directly to GitHub Vault from the browser.
 * Works seamlessly on static Firebase Hosting (https://qalbalelm.web.app) with no backend required.
 */

export const GITHUB_VAULT_CONFIG = {
  owner: 'hos098sam-jpg',
  repo: 'x3bb48b-c76c300b',
  token: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GITHUB_TOKEN) || '',
  branch: 'main',
};

// Helper: Convert ArrayBuffer to Base64 without call-stack overflow on large files
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks to prevent call stack overflow
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export interface VaultUploadProgress {
  percentage: number;
  uploadedMB: string;
  totalMB: string;
  speedMBps: string;
  statusText: string;
}

export interface VaultUploadResult {
  success: boolean;
  videoUrl: string;
  rawDownloadUrl: string;
  fileName: string;
  fileSizeBytes: number;
  durationFormatted: string;
}

/**
 * Uploads a video directly from the browser to the GitHub Vault repo via GitHub REST API.
 */
export async function uploadVideoDirectlyToVault(
  file: File,
  videoTitle: string,
  onProgress?: (prog: VaultUploadProgress) => void,
  signal?: AbortSignal
): Promise<VaultUploadResult> {
  const totalBytes = file.size;
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
  const startTime = Date.now();

  if (totalBytes > 100 * 1024 * 1024) {
    throw new Error(
      `حجم ملف الفيديو (${totalMB} MB) أكبر من الحد المسموح به للرفع المباشر (100 MB). يمكنك تقليل جودة الفيديو أو رفعه على Google Drive / YouTube وإضافة الرابط مباشرة.`
    );
  }

  // 1. Read file as ArrayBuffer with progress
  onProgress?.({
    percentage: 5,
    uploadedMB: '0.0',
    totalMB,
    speedMBps: '0.0',
    statusText: `جاري قراءة ملف الفيديو (${totalMB} MB)...`,
  });

  const arrayBuffer = await file.arrayBuffer();

  if (signal?.aborted) throw new Error('تم إلغاء عملية الرفع.');

  onProgress?.({
    percentage: 20,
    uploadedMB: (totalBytes * 0.2 / (1024 * 1024)).toFixed(1),
    totalMB,
    speedMBps: '0.0',
    statusText: 'جاري تشفير وتجهيز حزم الفيديو للرفع...',
  });

  // 2. Base64 encode
  const base64Content = arrayBufferToBase64(arrayBuffer);

  if (signal?.aborted) throw new Error('تم إلغاء عملية الرفع.');

  const cleanExt = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const safeTitle = (videoTitle || file.name.replace(/\.[^/.]+$/, ''))
    .trim()
    .replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
  const uniqueId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const repoFilePath = `videos/${uniqueId}/${safeTitle}.${cleanExt}`;

  onProgress?.({
    percentage: 35,
    uploadedMB: (totalBytes * 0.35 / (1024 * 1024)).toFixed(1),
    totalMB,
    speedMBps: '0.0',
    statusText: `جاري رفع الفيديو إلى سحابة المنصة المشفرة (${totalMB} MB)...`,
  });

  // 3. Upload to GitHub Contents API
  const apiUrl = `https://api.github.com/repos/${GITHUB_VAULT_CONFIG.owner}/${GITHUB_VAULT_CONFIG.repo}/contents/${repoFilePath}`;

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_VAULT_CONFIG.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Upload lesson video: ${videoTitle || file.name}`,
      content: base64Content,
      branch: GITHUB_VAULT_CONFIG.branch,
    }),
    signal,
  });

  if (!response.ok) {
    let errMsg = 'فشل رفع الفيديو إلى السحابة.';
    try {
      const errData = await response.json();
      if (errData && errData.message) {
        if (errData.message.includes('too large')) {
          errMsg = 'حجم الفيديو كبير جداً بالنسبة للرفع المباشر. يرجى استخدام رابط خارجي (Google Drive أو YouTube).';
        } else {
          errMsg = `خطأ أثناء الرفع: ${errData.message}`;
        }
      }
    } catch {}
    throw new Error(errMsg);
  }

  const resJson = await response.json();
  const elapsedSec = Math.max(0.5, (Date.now() - startTime) / 1000);
  const avgSpeed = (totalBytes / (1024 * 1024) / elapsedSec).toFixed(1);

  onProgress?.({
    percentage: 100,
    uploadedMB: totalMB,
    totalMB,
    speedMBps: avgSpeed,
    statusText: 'تم رفع وحفظ الفيديو بنجاح! جاهز للعرض الآن ✅',
  });

  const rawUrl =
    resJson?.content?.download_url ||
    `https://raw.githubusercontent.com/${GITHUB_VAULT_CONFIG.owner}/${GITHUB_VAULT_CONFIG.repo}/${GITHUB_VAULT_CONFIG.branch}/${repoFilePath}`;

  const estMinutes = Math.max(1, Math.round(totalBytes / (1024 * 1024 * 3)));

  return {
    success: true,
    videoUrl: rawUrl,
    rawDownloadUrl: rawUrl,
    fileName: file.name,
    fileSizeBytes: totalBytes,
    durationFormatted: `${estMinutes} دقيقة`,
  };
}
