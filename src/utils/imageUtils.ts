/**
 * High-performance browser image compression and safe storage utilities.
 * Prevents localStorage quota exceeded errors and Firestore 1MB document payload limits.
 */

export async function compressImageFile(
  file: File,
  maxDimension: number = 1000,
  quality: number = 0.75
): Promise<string> {
  // If not an image or SVG/GIF, fallback to direct FileReader
  if (!file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('gif')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const resultStr = typeof e.target?.result === 'string' ? e.target.result : '';
      if (!resultStr) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(resultStr);
            return;
          }

          // Render with white background to prevent black background on transparent PNG conversion
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to efficient JPEG
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (err) {
          console.warn('Canvas compression fallback to raw data URL:', err);
          resolve(resultStr);
        }
      };

      img.onerror = () => {
        resolve(resultStr);
      };

      img.src = resultStr;
    };

    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export async function compressBase64Image(
  dataUrl: string,
  maxDimension: number = 1000,
  quality: number = 0.75
): Promise<string> {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image') || dataUrl.length < 80000) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Safely saves data to localStorage, catching QuotaExceededError
 * and cleaning expired or transient keys if necessary.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    const isQuotaError =
      e &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.code === 22 ||
        e.code === 1014 ||
        String(e.message || '').includes('quota'));

    if (isQuotaError) {
      console.warn(`⚠️ [LocalStorage] مساحة التخزين ممتلئة عند حفظ ${key}. جاري تنظيف الملفات المؤقتة القديمة...`);
      try {
        // Clean non-essential cached keys
        const nonEssentialKeys = [
          'qalb_alam_cached_logs',
          'qalb_alam_temp_draft',
          'qalb_alam_notifications_cache',
          'qalb_alam_exams_store',
        ];
        nonEssentialKeys.forEach((k) => {
          if (k !== key) {
            try { localStorage.removeItem(k); } catch {}
          }
        });

        // Retry saving
        localStorage.setItem(key, value);
        console.log(`✅ [LocalStorage] تم حفظ ${key} بنجاح بعد تنظيف التخزين المؤقت.`);
        return true;
      } catch (retryErr) {
        console.warn(`⚠️ [LocalStorage] تعذر الحفظ محلياً حتى بعد التنظيف (${key}) - سيتم الاعتماد على المزامنة السحابية وقاعدة البيانات.`);
        return false;
      }
    }

    console.warn(`LocalStorage write error for ${key}:`, e);
    return false;
  }
}
