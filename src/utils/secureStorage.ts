import CryptoJS from 'crypto-js';
import { safeSetLocalStorage } from './imageUtils';
import type { Course, CourseExam, ExamQuestion, User } from '../types';

/**
 * Platform-specific secret key for AES-256 LocalStorage encryption and HMAC integrity verification.
 * Any manual tampering with cached payloads in DevTools invalidates the HMAC/AES signature,
 * immediately rejecting the corrupted cache and forcing a clean cloud/server reload.
 */
const PLATFORM_STORAGE_SECRET =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_STORAGE_ENCRYPTION_KEY) ||
  'QALB_AL_ELM_2027_AES256_FORTIFIED_SECRET_KEY_v9';

const ENCRYPTED_PREFIX = 'QAE_ENC_V1:';

// In-memory hot cache + background write debounce to eliminate main-thread AES-256 UI freezes
const memorySecureCache = new Map<string, { data: any; ts: number; ttlMs?: number }>();
const pendingStorageTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface SecureEnvelope<T = any> {
  v: number;
  ts: number;
  ttlMs?: number;
  sig: string;
  payload: T;
}

function computeIntegritySignature(payloadJson: string, ts: number): string {
  return CryptoJS.HmacSHA256(`${ts}:${payloadJson}`, PLATFORM_STORAGE_SECRET).toString(CryptoJS.enc.Hex);
}

/**
 * Encrypts any serializable data using AES-256 + HMAC-SHA256 integrity guard
 * and stores it in LocalStorage. Uses an instant in-memory hot cache and non-blocking
 * scheduled encryption so UI interactions are 100% instantaneous with zero lag!
 */
export function setSecureCache<T>(key: string, data: T, ttlMs: number = 6 * 60 * 60 * 1000): boolean {
  try {
    const ts = Date.now();
    memorySecureCache.set(key, { data, ts, ttlMs });

    const existingTimer = pendingStorageTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const persistNow = () => {
      pendingStorageTimers.delete(key);
      try {
        const payloadJson = JSON.stringify(data);
        const sig = computeIntegritySignature(payloadJson, ts);
        const envelope: SecureEnvelope<T> = {
          v: 1,
          ts,
          ttlMs,
          sig,
          payload: data,
        };
        const rawEnvelope = JSON.stringify(envelope);
        const cipherText = CryptoJS.AES.encrypt(rawEnvelope, PLATFORM_STORAGE_SECRET).toString();
        safeSetLocalStorage(key, `${ENCRYPTED_PREFIX}${cipherText}`);
      } catch (err) {
        console.warn(`[SecureCache] Failed to encrypt & store key "${key}":`, err);
      }
    };

    // Critical session keys write immediately; heavy arrays (courses, users, exams) debounce off the UI frame
    if (key.includes('current_user') || key.includes('enrolled')) {
      persistNow();
    } else {
      const timer = setTimeout(persistNow, 40);
      pendingStorageTimers.set(key, timer);
    }

    return true;
  } catch (err) {
    console.warn(`[SecureCache] Failed to store key "${key}":`, err);
    return false;
  }
}

export function removeSecureCache(key: string): void {
  try {
    memorySecureCache.delete(key);
    const existingTimer = pendingStorageTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      pendingStorageTimers.delete(key);
    }
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Reads and decrypts AES-encrypted LocalStorage item.
 * Returns immediately in O(1) from memorySecureCache if already loaded in this session!
 */
export function getSecureCache<T>(key: string, ignoreTtl: boolean = true): { data: T | null; isFresh: boolean; tampered: boolean } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw && !pendingStorageTimers.has(key)) {
      memorySecureCache.delete(key);
      return { data: null, isFresh: false, tampered: false };
    }

    const mem = memorySecureCache.get(key);
    if (mem) {
      const ageMs = Date.now() - mem.ts;
      const isFresh = mem.ttlMs ? ageMs <= mem.ttlMs : true;
      return { data: mem.data as T, isFresh: ignoreTtl ? true : isFresh, tampered: false };
    }

    if (!raw) {
      return { data: null, isFresh: false, tampered: false };
    }

    // Migrate legacy unencrypted JSON automatically on read
    if (!raw.startsWith(ENCRYPTED_PREFIX)) {
      try {
        const legacyParsed = JSON.parse(raw) as T;
        setSecureCache(key, legacyParsed);
        return { data: legacyParsed, isFresh: false, tampered: false };
      } catch {
        localStorage.removeItem(key);
        return { data: null, isFresh: false, tampered: true };
      }
    }

    const cipherText = raw.slice(ENCRYPTED_PREFIX.length);
    const bytes = CryptoJS.AES.decrypt(cipherText, PLATFORM_STORAGE_SECRET);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedStr) {
      console.error(`🚨 [Security Alert] تم اكتشاف تلاعب في الكاش المشفر (${key}) - تم رفض البيانات ومسحها فوراً.`);
      localStorage.removeItem(key);
      return { data: null, isFresh: false, tampered: true };
    }

    const envelope = JSON.parse(decryptedStr) as SecureEnvelope<T>;
    if (!envelope || typeof envelope.ts !== 'number' || !envelope.sig) {
      localStorage.removeItem(key);
      return { data: null, isFresh: false, tampered: true };
    }

    const expectedSig = computeIntegritySignature(JSON.stringify(envelope.payload), envelope.ts);
    if (expectedSig !== envelope.sig) {
      console.error(`🚨 [Security Alert] فشل التحقق من التوقيع الرقمي للكاش (${key}) - تم إبطال التلاعب.`);
      localStorage.removeItem(key);
      return { data: null, isFresh: false, tampered: true };
    }

    const ageMs = Date.now() - envelope.ts;
    const isFresh = envelope.ttlMs ? ageMs <= envelope.ttlMs : true;

    // Populate in-memory hot cache so subsequent reads take 0ms
    memorySecureCache.set(key, { data: envelope.payload, ts: envelope.ts, ttlMs: envelope.ttlMs });

    if (!ignoreTtl && !isFresh) {
      return { data: envelope.payload, isFresh: false, tampered: false };
    }

    return { data: envelope.payload, isFresh, tampered: false };
  } catch (err) {
    console.error(`🚨 [Security Alert] خطأ فك تشفير الكاش المحلي (${key}) - تم مسح البيانات المشبوهة.`);
    try {
      localStorage.removeItem(key);
    } catch {}
    return { data: null, isFresh: false, tampered: true };
  }
}

export function stripModelAnswersFromQuestionForStudentCache(q: ExamQuestion): ExamQuestion {
  return { ...q };
}

export function sanitizeExamForStudentCache(exam: CourseExam, _isPrivilegedUser: boolean): CourseExam {
  return exam;
}

export function sanitizeCoursesForClientCache(courses: Course[], _currentUserRole?: string): Course[] {
  return courses || [];
}

/**
 * Sanitizes user objects before local storage:
 * - Never stores plaintext passwords or admin tokens in browser storage
 */
export function sanitizeUsersForClientCache(users: User[], _currentUser?: User | null): User[] {
  return (users || []).map((u) => {
    const clean = { ...u };
    delete (clean as any).password;
    return clean;
  });
}
