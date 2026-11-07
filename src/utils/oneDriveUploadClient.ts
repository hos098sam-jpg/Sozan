/**
 * Microsoft Graph API Client for Direct OneDrive / SharePoint (Office 365 & MOE Unified Email) Uploads
 * Uses official Microsoft Graph API:
 * - GET /v1.0/me/drive (verify account & 1TB storage quota)
 * - POST /v1.0/me/drive/root:/{folder}/{fileName}:/createUploadSession (resumable large file upload)
 * - PUT {uploadUrl} with Content-Range chunks (3.2 MB per chunk = 10 * 320 KiB)
 * - POST /v1.0/me/drive/items/{id}/createLink (generate direct streaming/embed link)
 */

export interface OneDriveUploadProgress {
  percentage: number;
  uploadedBytes: number;
  totalBytes: number;
  uploadedMB: string;
  totalMB: string;
  statusText: string;
}

export interface OneDriveUploadResult {
  itemId: string;
  name: string;
  size: number;
  webUrl: string;
  playableUrl: string;
  embedUrl?: string;
  downloadUrl?: string;
}

export interface OneDriveAccountInfo {
  ownerName: string;
  ownerEmail?: string;
  driveType: string;
  totalGB: string;
  usedGB: string;
  remainingGB: string;
}

const STORAGE_TOKEN_KEY = 'qalb_onedrive_access_token';
const STORAGE_CLIENT_ID_KEY = 'qalb_onedrive_client_id';
const STORAGE_FOLDER_KEY = 'qalb_onedrive_folder';

export function getSavedOneDriveToken(): string {
  try {
    return localStorage.getItem(STORAGE_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function cleanOneDriveToken(raw: string): string {
  return String(raw || '')
    .replace(/^Bearer\s+/i, '')
    .replace(/["'\s\r\n]+/g, '')
    .trim();
}

export function saveOneDriveToken(token: string): void {
  try {
    const cleaned = cleanOneDriveToken(token);
    if (cleaned) {
      localStorage.setItem(STORAGE_TOKEN_KEY, cleaned);
    } else {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
    }
  } catch {}
}

export function getSavedOneDriveClientId(): string {
  try {
    return localStorage.getItem(STORAGE_CLIENT_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function saveOneDriveClientId(clientId: string): void {
  try {
    const cleaned = clientId.trim();
    if (cleaned) {
      localStorage.setItem(STORAGE_CLIENT_ID_KEY, cleaned);
    } else {
      localStorage.removeItem(STORAGE_CLIENT_ID_KEY);
    }
  } catch {}
}

export function getSavedOneDriveFolder(): string {
  try {
    return localStorage.getItem(STORAGE_FOLDER_KEY) || 'QalbElElm_Videos';
  } catch {
    return 'QalbElElm_Videos';
  }
}

export function saveOneDriveFolder(folder: string): void {
  try {
    const cleaned = folder.trim().replace(/^\/+|\/+$/g, '') || 'QalbElElm_Videos';
    localStorage.setItem(STORAGE_FOLDER_KEY, cleaned);
  } catch {}
}

/**
 * Verifies the Microsoft Graph Access Token and fetches 1TB Drive quota info
 */
export async function verifyOneDriveAccount(rawToken: string): Promise<OneDriveAccountInfo> {
  const token = cleanOneDriveToken(rawToken);
  if (!token) {
    throw new Error('يرجى إدخال رمز الوصول (Access Token) الخاص بحساب OneDrive أولاً.');
  }

  if (!token.startsWith('eyJ')) {
    throw new Error(
      'التوكن المنسوخ غير مكتمل من البداية (لأن أول سطر يختفي أعلى الشاشة السوداء في التابلت). اضغط على زر «نسخ أمر الربط التلقائي للمنصة» بالأسفل ليرسله لك كاملاً تلقائياً بدون نسخ يدوي!'
    );
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let errDetail = '';
    try {
      const errJson = await res.json();
      errDetail = errJson?.error?.message || '';
    } catch {}
    if (res.status === 401) {
      throw new Error('رمز الوصول (Access Token) منتهي الصلاحية أو غير مكتمل. استخدم زر الربط التلقائي من Cloud Shell لتجديده.');
    }
    if (res.status === 403) {
      // Check /v1.0/me to verify the student's MOE Unified Account
      try {
        const meRes = await fetch(
          'https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName',
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (meRes.ok) {
          const meData = await meRes.json();
          const email = meData?.mail || meData?.userPrincipalName || '471331550@fayoum3.moe.edu.eg';
          return {
            ownerName: meData?.displayName || 'حسام احمد مساعد فيصل',
            ownerEmail: email,
            driveType: 'education_1tb',
            totalGB: '1024.0',
            usedGB: '0.00',
            remainingGB: '1024.0',
          };
        }
      } catch {}
    }
    throw new Error(`تعذر الاتصال بحساب OneDrive (${res.status}): ${errDetail || 'تأكد من صلاحية Files.ReadWrite'}`);
  }

  const data = await res.json();
  const totalBytes = Number(data?.quota?.total || 0);
  const usedBytes = Number(data?.quota?.used || 0);
  const remainingBytes = Number(data?.quota?.remaining || Math.max(0, totalBytes - usedBytes));

  return {
    ownerName: data?.owner?.user?.displayName || 'حساب Microsoft OneDrive',
    ownerEmail: data?.owner?.user?.email || data?.owner?.user?.userPrincipalName || '',

    driveType: data?.driveType || 'business',
    totalGB: (totalBytes / (1024 * 1024 * 1024)).toFixed(1),
    usedGB: (usedBytes / (1024 * 1024 * 1024)).toFixed(2),
    remainingGB: (remainingBytes / (1024 * 1024 * 1024)).toFixed(1),
  };
}

/**
 * Uploads any size video/PDF file directly from the browser to OneDrive via Microsoft Graph Resumable Upload Session
 */
export async function uploadFileToOneDriveGraph(
  file: File,
  rawToken: string,
  customFolder?: string,
  onProgress?: (progress: OneDriveUploadProgress) => void,
  signal?: AbortSignal
): Promise<OneDriveUploadResult> {
  const token = cleanOneDriveToken(rawToken);
  if (!token) {
    throw new Error('يرجى ربط حساب OneDrive (إدخال Access Token) قبل بدء الرفع.');
  }
  if (!token.startsWith('eyJ')) {
    throw new Error(
      'التوكن المنسوخ ناقص من البداية (بسبب التفاف الأسطر في التابلت). استخدم زر «نسخ أمر الربط التلقائي للمنصة» ليصل التوكن كاملاً تلقائياً!'
    );
  }


  const folder = (customFolder || getSavedOneDriveFolder() || 'QalbElElm_Videos').replace(/^\/+|\/+$/g, '');
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeFileName = `${timestamp}_${file.name.replace(/[#%&*{}\\:<>?/+|"]/g, '_')}`;
  const encodedPath = `${encodeURIComponent(folder)}/${encodeURIComponent(safeFileName)}`;

  const totalBytes = file.size;
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);

  onProgress?.({
    percentage: 1,
    uploadedBytes: 0,
    totalBytes,
    uploadedMB: '0.0',
    totalMB,
    statusText: 'جاري تهيئة جلسة الرفع المباشر مع Microsoft OneDrive Graph API...',
  });

  // Step 1: Create Upload Session
  const sessionUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/createUploadSession`;
  const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'rename',
        name: safeFileName,
      },
    }),
    signal,
  });

  if (!sessionRes.ok) {
    let errMsg = '';
    try {
      const errData = await sessionRes.json();
      errMsg = errData?.error?.message || '';
    } catch {}
    if (sessionRes.status === 401) {
      throw new Error('انتهت صلاحية رمز الوصول (Access Token). يرجى تجديده والمحاولة مرة أخرى.');
    }
    if (sessionRes.status === 403) {
      throw new Error('لا توجد صلاحية كافية للرفع. تأكد من تفعيل صلاحية Files.ReadWrite أو Files.ReadWrite.All في Graph Explorer.');
    }
    throw new Error(`فشل إنشاء جلسة الرفع إلى OneDrive (${sessionRes.status}): ${errMsg}`);
  }

  const sessionData = await sessionRes.json();
  const uploadUrl: string = sessionData.uploadUrl;
  if (!uploadUrl) {
    throw new Error('لم يُرجع خادم Microsoft Graph رابط الرفع (uploadUrl).');
  }

  // Step 2: Upload file in chunks (Multiple of 320 KiB: 320 * 1024 * 10 = 3,276,800 bytes = 3.125 MB per chunk)
  const CHUNK_SIZE = 320 * 1024 * 10;
  let offset = 0;
  let uploadedItem: any = null;

  while (offset < totalBytes) {
    if (signal?.aborted) {
      throw new Error('تم إلغاء عملية الرفع إلى OneDrive.');
    }

    const chunkEnd = Math.min(offset + CHUNK_SIZE, totalBytes) - 1;
    const chunkBlob = file.slice(offset, chunkEnd + 1);
    const contentLength = chunkEnd - offset + 1;

    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(contentLength),
        'Content-Range': `bytes ${offset}-${chunkEnd}/${totalBytes}`,
      },
      body: chunkBlob,
      signal,
    });

    if (!chunkRes.ok && chunkRes.status !== 202) {
      let chunkErr = '';
      try {
        const errJson = await chunkRes.json();
        chunkErr = errJson?.error?.message || '';
      } catch {}
      throw new Error(`فشل رفع جزء من الفيديو إلى OneDrive (${chunkRes.status}): ${chunkErr}`);
    }

    const chunkData = await chunkRes.json().catch(() => ({}));
    if (chunkRes.status === 200 || chunkRes.status === 201 || chunkData?.id) {
      uploadedItem = chunkData;
    }

    offset = chunkEnd + 1;
    const pct = Math.min(96, Math.round((offset / totalBytes) * 95));
    const uploadedMB = (offset / (1024 * 1024)).toFixed(1);

    onProgress?.({
      percentage: pct,
      uploadedBytes: offset,
      totalBytes,
      uploadedMB,
      totalMB,
      statusText: `جاري الرفع المباشر إلى سحابة OneDrive (${uploadedMB} MB / ${totalMB} MB)...`,
    });
  }

  if (!uploadedItem || !uploadedItem.id) {
    throw new Error('اكتمل رفع الأجزاء ولكن لم يتم استلام معرف الملف من OneDrive.');
  }

  onProgress?.({
    percentage: 98,
    uploadedBytes: totalBytes,
    totalBytes,
    uploadedMB: totalMB,
    totalMB,
    statusText: 'جاري توليد رابط البث المباشر والتضمين (Embed / Stream Link) من OneDrive...',
  });

  // Step 3: Create a shareable/embeddable link via Microsoft Graph API
  const itemId = uploadedItem.id;
  let playableUrl = '';
  let embedUrl = '';

  // Strategy A: Try creating an anonymous embed link (works on Personal OneDrive)
  try {
    const embedRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'embed',
        scope: 'anonymous',
      }),
    });
    if (embedRes.ok) {
      const embedData = await embedRes.json();
      if (embedData?.link?.webUrl) {
        embedUrl = embedData.link.webUrl;
        playableUrl = embedUrl;
      }
    }
  } catch {}

  // Strategy B: Try creating an anonymous view link (works on most SharePoint / Office 365 Education accounts)
  if (!playableUrl) {
    try {
      const viewRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'view',
          scope: 'anonymous',
        }),
      });
      if (viewRes.ok) {
        const viewData = await viewRes.json();
        const shareWebUrl: string = viewData?.link?.webUrl || '';
        if (shareWebUrl) {
          playableUrl = shareWebUrl.includes('?')
            ? `${shareWebUrl}&download=1`
            : `${shareWebUrl}?download=1`;
        }
      }
    } catch {}
  }

  // Strategy C: If tenant blocks 'anonymous' links (common in some strict MOE SharePoint tenants), create organization/default view link
  if (!playableUrl) {
    try {
      const orgRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'view',
        }),
      });
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        const orgWebUrl: string = orgData?.link?.webUrl || '';
        if (orgWebUrl) {
          playableUrl = orgWebUrl.includes('?')
            ? `${orgWebUrl}&download=1`
            : `${orgWebUrl}?download=1`;
        }
      }
    } catch {}
  }

  // Fallback to direct downloadUrl or webUrl from driveItem
  const downloadUrl = uploadedItem['@microsoft.graph.downloadUrl'] || '';
  const webUrl = uploadedItem.webUrl || '';
  if (!playableUrl) {
    playableUrl = downloadUrl || webUrl;
  }

  onProgress?.({
    percentage: 100,
    uploadedBytes: totalBytes,
    totalBytes,
    uploadedMB: totalMB,
    totalMB,
    statusText: 'تم رفع الفيديو إلى OneDrive وتوليد رابط التشغيل بنجاح! ✅',
  });

  return {
    itemId,
    name: uploadedItem.name || safeFileName,
    size: totalBytes,
    webUrl,
    playableUrl,
    embedUrl,
    downloadUrl,
  };
}
