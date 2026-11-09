import {
  PlatformSettings,
  Course,
  Competition,
  User,
  CourseAccessCode,
  StudentExamSubmission,
  PlatformNotification,
  CourseExam,
  CourseLesson,
  LessonVideo,
  LessonPdf,
  WalletRechargeCode,
  WalletTransaction
} from '../types';
import { db, auth } from '../auth';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocFromCache,
  onSnapshot,
  collection,
  getDocs,
  getDocsFromCache,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { safeSetLocalStorage } from '../utils/imageUtils';
import {
  setSecureCache,
  getSecureCache,
  removeSecureCache,
  sanitizeCoursesForClientCache,
  sanitizeUsersForClientCache,
  sanitizeExamForStudentCache,
} from '../utils/secureStorage';
import { DEFAULT_COURSES } from './defaultCourses';

export const INITIAL_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: 'المتفلسفة ',
  heroTitle: 'منصة المتفلسفة  لدفعة 2027',
  heroSubtitle: 'المنصة المتكاملة لتقديم الكورسات، الامتحانات الإلكترونية، والمسابقات الرسمية لدفعة 2027 تحت إشراف إدارة المنصة.',
  supervisorName: 'أ/ سوزان كريم الخولى',
  supervisorTitle: 'معلمة الفلسفة والمنطق والمشرف العام',
  heroBannerImage: '/logo.png',
  announcementText: '',
  contactPhone: '+201040672314',
  supportWhatsapp: '+201040672314',
  homeSections: [
    { id: 'hero', visible: true, label: 'الواجهة الترحيبية الرئيسية (Hero Banner)' },
    { id: 'stats', visible: false, label: 'شريط الإحصائيات السريعة للمنصة' },
    { id: 'teachers', visible: true, label: 'قسم نخبة المعلمين المعتمدين' },
    { id: 'courses', visible: true, label: 'قسم استكشف الكورسات والمواد الدراسية' },
    { id: 'competitions', visible: false, label: 'قسم المسابقات المجانية ولوحة الشرف' },
    { id: 'features', visible: true, label: 'قسم لماذا تختار المنصة؟ (المميزات)' },
  ],
};

export const INITIAL_STUDENTS: User[] = [
  {
    id: 'teacher-1791139743075',
    name: 'أ/ سوزان كريم الخولى',
    role: 'teacher',
    phone: '01040672314',
    parentPhone: '',
    status: 'active',
    registeredAt: '2026-09-20',
    bio: 'خبيرة وموجهة الفلسفة والمنطق وعلم النفس والاجتماع للمرحلة الثانوية',
    subject: 'الفلسفة والمنطق وعلم النفس والاجتماع',
    schoolYear: 'جميع المراحل الدراسية',
    enrolledCourseIds: [],
  } as unknown as User,
];
export const INITIAL_COMPETITIONS: Competition[] = [];
export const INITIAL_ACCESS_CODES: CourseAccessCode[] = [];
export const INITIAL_SUBMISSIONS: StudentExamSubmission[] = [];
export const INITIAL_NOTIFICATIONS: PlatformNotification[] = [
  {
    id: 'notif-welcome-2027',
    title: 'مرحباً بكم في منصة المتفلسفة  لدفعة 2027 🎓',
    message: 'نرحب بجميع الطلاب وأولياء الأمور في انطلاق المنصة التعليمية لدفعة 2027 تحت إشراف إدارة المنصة. تابعوا جدول الكورسات والامتحانات الدورية والمسابقات.',
    senderName: 'إدارة المنصة',
    timestamp: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    priority: 'urgent',
    target: 'all',
    read: false,
  },
  {
    id: 'notif-system-tracking',
    title: 'تنبيه: الكورسات والامتحانات التتابعية مفعلة ⚡',
    message: 'تذكر أن كل درس يتبعه امتحان إلكتروني لا يمكن فتح الدرس التالي إلا بعد اجتيازه. يتم تسجيل أوقات الدخول والخروج بالثانية ومشاركتها مع ولي الأمر تلقائياً.',
    senderName: 'كنترول المنصة',
    timestamp: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    priority: 'normal',
    target: 'students',
    read: false,
  },
];

export const INITIAL_COURSES: Course[] = DEFAULT_COURSES;

export const STORAGE_KEYS = {
  CURRENT_USER: 'qalb_alam_current_user_live',
  USERS: 'al_motafalsifa_users_list_live',
  COURSES: 'qalb_alam_courses_list_live',
  COMPETITIONS: 'qalb_alam_competitions_list_live',
  PLATFORM_SETTINGS: 'qalb_alam_settings_live',
  ACCESS_CODES: 'qalb_alam_access_codes_live',
  SUBMISSIONS: 'qalb_alam_exam_submissions_live',
  NOTIFICATIONS: 'qalb_alam_notifications_live',
  EXAMS_STORE: 'qalb_alam_all_exams_store_live',
  BOOK_EXAMS: 'qalb_alam_book_exams_cache_live',
  WALLET_CODES: 'qalb_alam_wallet_codes_live',
};

try {
  const legacyKeys = ['qalb_alam_current_user_v3','qalb_alam_users_list_v3','qalb_alam_courses_list_v3','qalb_alam_competitions_list_v3','qalb_alam_access_codes_v3','qalb_alam_exam_submissions_v3','qalb_alam_courses_list','qalb_alam_competitions_list','qalb_alam_users_list','qalb_alam_submissions','qalb_alam_current_user'];
  legacyKeys.forEach((k) => localStorage.removeItem(k));
} catch (e) {}

// === FIREBASE HELPERS & REALTIME CLOUD SYNC ===

export interface CloudSyncState {
  status: 'connecting' | 'connected' | 'error' | 'offline';
  lastSyncTime: string | null;
  errorDetails: string | null;
}

let currentCloudStatus: CloudSyncState = {
  status: 'connecting',
  lastSyncTime: null,
  errorDetails: null,
};

export function getCloudSyncStatus(): CloudSyncState {
  return currentCloudStatus;
}

export function notifyCloudStatus(status: 'connecting' | 'connected' | 'error' | 'offline', errorDetails: string | null = null) {
  currentCloudStatus = {
    status,
    lastSyncTime: status === 'connected' ? new Date().toLocaleTimeString('ar-EG') : currentCloudStatus.lastSyncTime,
    errorDetails,
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('qalb_alam_cloud_status', { detail: currentCloudStatus }));
  }
}

/**
 * Sanitizes object by removing any undefined properties which crash Firestore setDoc
 */
function sanitizeForFirestore(data: any): any {
  if (data === undefined) return null;
  return JSON.parse(JSON.stringify(data));
}

function unwrapRestValue(val: any): any {
  if (!val) return null;
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("booleanValue" in val) return val.booleanValue;
  if ("nullValue" in val) return null;
  if ("mapValue" in val) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = unwrapRestValue(v);
    }
    return res;
  }
  if ("arrayValue" in val) {
    return (val.arrayValue.values || []).map(unwrapRestValue);
  }
  return null;
}

export function wrapRestValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(wrapRestValue) } };
  if (typeof val === "object") {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = wrapRestValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

const writeDebounceTimers = new Map<string, any>();

/**
 * Maximum number of students per sharded document in `al_motafalsifa_data/users_chunk_{i}`.
 * Strictly capped at 500 students per chunk so no document ever approaches Firestore's 1MB limit,
 * allowing 2,000+ to 50,000+ students without ever hitting the 1MB ceiling.
 */
export const MAX_USERS_PER_CHUNK = 500;

/**
 * Splits a list of users into chunks of max 500 students and writes:
 * 1. Individual documents `users/{uid}` for updated records
 * 2. Sharded chunk documents `al_motafalsifa_data/users_chunk_1`, `users_chunk_2`, ...
 * 3. A lightweight manifest `al_motafalsifa_data/users` containing `totalChunks`, `totalUsers`, and up to the first 500 records for backward compatibility.
 */
export async function saveShardedUsersToFirestore(users: User[]): Promise<boolean> {
  // Only Admin or Teacher is allowed to write to the sharded users manifest (`al_motafalsifa_data/users`).
  // Students write exclusively to their own isolated document `users/{uid}` as enforced by firestore.rules.
  const activeUser = getCurrentUser();
  if (activeUser && activeUser.role !== 'admin' && activeUser.role !== 'teacher') {
    return true;
  }

  const rawSanitizedUsers = sanitizeForFirestore(users) || [];
  const sanitizedUsers = rawSanitizedUsers.map((u: any) => {
    if (!u || typeof u !== 'object') return u;
    const copy = { ...u };
    delete copy.password;
    return copy;
  });
  const totalUsers = sanitizedUsers.length;
  const chunks: User[][] = [];

  for (let i = 0; i < totalUsers; i += MAX_USERS_PER_CHUNK) {
    chunks.push(sanitizedUsers.slice(i, i + MAX_USERS_PER_CHUNK));
  }
  if (chunks.length === 0) {
    chunks.push([]);
  }

  const totalChunks = chunks.length;
  const nowIso = new Date().toISOString();
  const apiKey = "AIzaSyDdwnLfJbsQ8hbXP-CzocjaejmvYC4FOh4";
  const projectId = "alesraa-academy";

  let idToken: string | undefined;
  try {
    idToken = await auth.currentUser?.getIdToken();
  } catch {}

  const restHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) {
    restHeaders["Authorization"] = `Bearer ${idToken}`;
  }

  let anySuccess = false;

  // 1. Write each chunk `users_chunk_1`, `users_chunk_2`, ... (Max 500 students per document)
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkDocName = `users_chunk_${idx + 1}`;
    const chunkData = chunks[idx];

    try {
      await setDoc(doc(db, "al_motafalsifa_data", chunkDocName), {
        chunkIndex: idx + 1,
        totalChunks,
        count: chunkData.length,
        data: chunkData,
        updatedAt: nowIso,
      });
      anySuccess = true;
    } catch {
      if (idToken) {
        try {
          const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/al_motafalsifa_data/${chunkDocName}?key=${apiKey}`;
          const res = await fetch(restUrl, {
            method: "PATCH",
            headers: restHeaders,
            body: JSON.stringify({
              fields: {
                chunkIndex: { integerValue: String(idx + 1) },
                totalChunks: { integerValue: String(totalChunks) },
                count: { integerValue: String(chunkData.length) },
                data: wrapRestValue(chunkData),
                updatedAt: { stringValue: nowIso },
              },
            }),
          });
          if (res.ok) anySuccess = true;
        } catch {}
      }
    }
  }

  // 2. Write the primary manifest `al_motafalsifa_data/users` (stores chunk metadata + first chunk only so it NEVER exceeds 1MB)
  const firstChunk = chunks[0] || [];
  try {
    await setDoc(doc(db, "al_motafalsifa_data", "users"), {
      isSharded: true,
      maxPerChunk: MAX_USERS_PER_CHUNK,
      totalChunks,
      totalUsers,
      chunkKeys: chunks.map((_, i) => `users_chunk_${i + 1}`),
      data: firstChunk,
      updatedAt: nowIso,
    });
    anySuccess = true;
  } catch {
    if (idToken) {
      try {
        const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/al_motafalsifa_data/users?key=${apiKey}`;
        const res = await fetch(restUrl, {
          method: "PATCH",
          headers: restHeaders,
          body: JSON.stringify({
            fields: {
              isSharded: { booleanValue: true },
              maxPerChunk: { integerValue: String(MAX_USERS_PER_CHUNK) },
              totalChunks: { integerValue: String(totalChunks) },
              totalUsers: { integerValue: String(totalUsers) },
              chunkKeys: wrapRestValue(chunks.map((_, i) => `users_chunk_${i + 1}`)),
              data: wrapRestValue(firstChunk),
              updatedAt: { stringValue: nowIso },
            },
          }),
        });
        if (res.ok) anySuccess = true;
      } catch {}
    }
  }

  if (anySuccess) {
    notifyCloudStatus('connected', null);
  }
  return anySuccess;
}

/**
 * Loads all sharded user chunks (`users_chunk_1`, `users_chunk_2`, ...) from Firestore
 * and merges them seamlessly.
 */
export async function loadShardedUsersFromFirestore(): Promise<User[]> {
  // Only Admin or Teacher should load the full sharded users list (`al_motafalsifa_data/users`).
  // Students load their own isolated document `users/{uid}` in loadAllFromFirebase.
  const activeUser = getCurrentUser();
  if (activeUser && activeUser.role !== 'admin' && activeUser.role !== 'teacher') {
    return [];
  }

  const userMap = new Map<string, User>();
  const apiKey = "AIzaSyDdwnLfJbsQ8hbXP-CzocjaejmvYC4FOh4";
  const projectId = "alesraa-academy";

  let idToken: string | undefined;
  try {
    idToken = await auth.currentUser?.getIdToken();
  } catch {}
  const restHeaders: Record<string, string> = {};
  if (idToken) {
    restHeaders["Authorization"] = `Bearer ${idToken}`;
  }

  let totalChunks = 1;

  // 1. Read manifest / first chunk from `al_motafalsifa_data/users`
  try {
    let snap: any = null;
    try {
      snap = await getDocFromCache(doc(db, "al_motafalsifa_data", "users"));
    } catch {}
    if (!snap || !snap.exists()) {
      snap = await Promise.race([
        getDoc(doc(db, "al_motafalsifa_data", "users")),
        new Promise<null>((r) => setTimeout(() => r(null), 2000)),
      ]);
    }
    if (snap && typeof snap.exists === 'function' && snap.exists()) {
      const docData = snap.data();
      if (typeof docData?.totalChunks === 'number' && docData.totalChunks > 1) {
        totalChunks = docData.totalChunks;
      }
      if (Array.isArray(docData?.data)) {
        docData.data.forEach((u: User) => {
          if (u?.id) userMap.set(u.id, u);
        });
      }
    } else if (idToken) {
      const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/al_motafalsifa_data/users?key=${apiKey}`;
      const res = await fetch(restUrl, { headers: restHeaders });
      if (res.ok) {
        const json = await res.json();
        const tc = Number(json?.fields?.totalChunks?.integerValue || 1);
        if (tc > 1) totalChunks = tc;
        const firstData = unwrapRestValue(json?.fields?.data);
        if (Array.isArray(firstData)) {
          firstData.forEach((u: User) => {
            if (u?.id) userMap.set(u.id, u);
          });
        }
      }
    }
  } catch {}

  // 2. Read all sharded chunk documents `users_chunk_1` .. `users_chunk_N`
  const chunkPromises: Promise<void>[] = [];
  for (let idx = 1; idx <= Math.max(totalChunks, 4); idx++) {
    const chunkDocName = `users_chunk_${idx}`;
    chunkPromises.push(
      (async () => {
        try {
          let cSnap: any = null;
          try {
            cSnap = await getDocFromCache(doc(db, "al_motafalsifa_data", chunkDocName));
          } catch {}
          if (!cSnap || !cSnap.exists()) {
            cSnap = await Promise.race([
              getDoc(doc(db, "al_motafalsifa_data", chunkDocName)),
              new Promise<null>((r) => setTimeout(() => r(null), 2000)),
            ]);
          }
          if (cSnap && typeof cSnap.exists === 'function' && cSnap.exists()) {
            const arr = cSnap.data()?.data;
            if (Array.isArray(arr)) {
              arr.forEach((u: User) => {
                if (u?.id) userMap.set(u.id, u);
              });
            }
            return;
          }
        } catch {}

        if (idToken) {
          try {
            const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/al_motafalsifa_data/${chunkDocName}?key=${apiKey}`;
            const res = await fetch(restUrl, { headers: restHeaders });
            if (res.ok) {
              const json = await res.json();
              const arr = unwrapRestValue(json?.fields?.data);
              if (Array.isArray(arr)) {
                arr.forEach((u: User) => {
                  if (u?.id) userMap.set(u.id, u);
                });
              }
            }
          } catch {}
        }
      })()
    );
  }

  await Promise.all(chunkPromises);
  return Array.from(userMap.values());
}

export async function saveToFirebase(collectionName: string, data: any): Promise<boolean> {
  return new Promise((resolve) => {
    if (writeDebounceTimers.has(collectionName)) {
      clearTimeout(writeDebounceTimers.get(collectionName));
    }

    const timer = setTimeout(async () => {
      writeDebounceTimers.delete(collectionName);
      const sanitized = sanitizeForFirestore(data);

      let idToken: string | undefined;
      try {
        idToken = await auth.currentUser?.getIdToken();
      } catch {}
      const apiHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) {
        apiHeaders['Authorization'] = `Bearer ${idToken}`;
      }

      // Special handling for `users`: Automatically shard into 500-user chunks (`users_chunk_1`, `users_chunk_2`, ...)
      // so the aggregated document NEVER exceeds Firestore's 1MB limit even with 2,000+ students.
      if (collectionName === "users" && Array.isArray(sanitized)) {
        const shardOk = await saveShardedUsersToFirestore(sanitized);
        fetch('/api/users/save', {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({ users: sanitized }),
        }).catch(() => {});
        resolve(shardOk);
        return;
      }

      let isSuccess = false;

      // 1. Attempt Firestore Client SDK write
      try {
        await setDoc(doc(db, "al_motafalsifa_data", collectionName), {
          data: sanitized,
          updatedAt: new Date().toISOString(),
        });
        console.log(`☁️ [Firebase Firestore] تم الحفظ بنجاح في السحابة: ${collectionName}`);
        notifyCloudStatus('connected', null);
        isSuccess = true;
      } catch (e: any) {
        // 2. Fallback to Firestore REST API using the web API key
        try {
          const apiKey = "AIzaSyDdwnLfJbsQ8hbXP-CzocjaejmvYC4FOh4";
          const projectId = "alesraa-academy";
          const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/al_motafalsifa_data/${collectionName}?key=${apiKey}`;
          const res = await fetch(restUrl, {
            method: "PATCH",
            headers: apiHeaders,
            body: JSON.stringify({
              fields: {
                data: wrapRestValue(sanitized),
                updatedAt: { stringValue: new Date().toISOString() },
              },
            }),
          });
          if (res.ok) {
            console.log(`☁️ [Firebase REST] تم الحفظ بنجاح عبر السحابة: ${collectionName}`);
            notifyCloudStatus('connected', null);
            isSuccess = true;
          }
        } catch {}
      }

      // If courses, also broadcast to backend server API
      if (collectionName === "courses" && Array.isArray(sanitized)) {
        syncCoursesToServer(sanitized).catch(() => {});
      }

      resolve(isSuccess);
    }, 250);

    writeDebounceTimers.set(collectionName, timer);
  });
}

export async function loadFromFirebase(collectionName: string, preferCacheFirst: boolean = true): Promise<any | null> {
  const activeUser = getCurrentUser();
  const isPrivileged =
    Boolean(auth.currentUser) &&
    (activeUser?.role === 'admin' ||
      activeUser?.role === 'teacher' ||
      auth.currentUser?.email === 'hos098sam@gmail.com');

  if (collectionName === "users") {
    if (!isPrivileged) return null;
    const sharded = await loadShardedUsersFromFirestore();
    if (sharded.length > 0) return sharded;
  }

  // Protected admin/teacher documents in al_motafalsifa_data should not be queried by unauthenticated or student clients
  const protectedCollections = ['users', 'accessCodes', 'submissions', 'exams', 'support_chats'];
  if (protectedCollections.includes(collectionName) && !isPrivileged) {
    return null;
  }

  // 1. Cache-First strategy via Firestore Offline Persistence Cache (for non-courses collections)
  if (preferCacheFirst && collectionName !== "courses") {
    try {
      const cachedSnap = await getDocFromCache(doc(db, "al_motafalsifa_data", collectionName));
      if (cachedSnap && cachedSnap.exists()) {
        const cachedData = cachedSnap.data()?.data;
        if (cachedData) {
          notifyCloudStatus('connected', null);
          return cachedData;
        }
      }
    } catch {
      // Cache miss -> proceed to network
    }
  }

  try {
    notifyCloudStatus('connecting');
    const firestorePromise = getDoc(doc(db, "al_motafalsifa_data", collectionName));
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const snap: any = await Promise.race([firestorePromise, timeoutPromise]);

    if (snap && typeof snap.exists === 'function') {
      if (snap.exists()) {
        console.log(`☁️ [Firebase Firestore] تم تحميل المستند من السحابة: ${collectionName}`);
        notifyCloudStatus('connected', null);
        return snap.data().data;
      } else {
        console.log(`ℹ️ [Firebase Firestore] المستند ${collectionName} غير موجود في السحابة حالياً.`);
        notifyCloudStatus('connected', null);
        return null;
      }
    }
  } catch (e: any) {
    // Continue to REST fallback
  }

  // Attempt REST fallback using web API key (guarantees connectivity in iframe / school tablet networks)
  try {
    const apiKey = "AIzaSyDdwnLfJbsQ8hbXP-CzocjaejmvYC4FOh4";
    const projectId = "alesraa-academy";
    const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/al_motafalsifa_data/${collectionName}?key=${apiKey}`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 2500);
    const res = await fetch(restUrl, { signal: controller?.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const json = await res.json();
      const rawData = json?.fields?.data;
      if (rawData) {
        const unwrapped = unwrapRestValue(rawData);
        console.log(`☁️ [Firebase REST] تم تحميل المستند بنجاح عبر السحابة: ${collectionName}`);
        notifyCloudStatus('connected', null);
        return unwrapped;
      }
    }
  } catch {
    // Ignore rest error
  }

  // In offline or restricted network, gracefully return cached local data without throwing red errors
  console.warn(`[Firebase Firestore] العمل بالبيانات المحلية لـ ${collectionName} (وضع تابلت أوفلاين سريع).`);
  return null;
}

// === DELETED ENTITY TRACKERS (PREVENTS ACCIDENTAL RESURRECTION) ===

export const PERMANENT_DEMO_COURSE_IDS = [
  'course-1821013405232',
  'course-sec2-chemistry',
  'course-sec3-mastery',
  'course-integrated-physics',
  'course-exams-chemistry',
];

export function getDeletedCourseIds(): string[] {
  try {
    const saved = localStorage.getItem('qalb_alam_deleted_course_ids');
    const custom = saved ? JSON.parse(saved) : [];
    return Array.from(new Set([...PERMANENT_DEMO_COURSE_IDS, ...(Array.isArray(custom) ? custom : [])]));
  } catch {}
  return [...PERMANENT_DEMO_COURSE_IDS];
}

export function getDeletedExamIds(): string[] {
  try {
    const saved = localStorage.getItem('qalb_alam_deleted_exam_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function getDeletedNotificationIds(): string[] {
  try {
    const saved = localStorage.getItem('qalb_alam_deleted_notification_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function getDeletedCouponIds(): string[] {
  try {
    const saved = localStorage.getItem('qalb_alam_deleted_coupon_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function syncDeletedIds(courses?: string[], users?: string[], exams?: string[], notifications?: string[], coupons?: string[], videos?: string[]) {
  try {
    if (Array.isArray(courses) && courses.length > 0) {
      const currentC = getDeletedCourseIds();
      const mergedC = Array.from(new Set([...currentC, ...courses.filter(Boolean)]));
      localStorage.setItem('qalb_alam_deleted_course_ids', JSON.stringify(mergedC));
    }
    if (Array.isArray(users) && users.length > 0) {
      const currentU = getDeletedUserIds();
      const mergedU = Array.from(new Set([...currentU, ...users.filter(Boolean)]));
      localStorage.setItem('qalb_alam_deleted_user_ids', JSON.stringify(mergedU));
    }
    if (Array.isArray(exams) && exams.length > 0) {
      const currentE = getDeletedExamIds();
      const mergedE = Array.from(new Set([...currentE, ...exams.filter(Boolean)]));
      localStorage.setItem('qalb_alam_deleted_exam_ids', JSON.stringify(mergedE));
    }
    if (Array.isArray(notifications) && notifications.length > 0) {
      const currentN = getDeletedNotificationIds();
      const mergedN = Array.from(new Set([...currentN, ...notifications.filter(Boolean)]));
      localStorage.setItem('qalb_alam_deleted_notification_ids', JSON.stringify(mergedN));
    }
    if (Array.isArray(coupons) && coupons.length > 0) {
      const currentCP = getDeletedCouponIds();
      const mergedCP = Array.from(new Set([...currentCP, ...coupons.filter(Boolean)]));
      localStorage.setItem('qalb_alam_deleted_coupon_ids', JSON.stringify(mergedCP));
    }
    if (Array.isArray(videos) && videos.length > 0) {
      const currentV = getDeletedVideoIds();
      const mergedV = Array.from(new Set([...currentV, ...videos.filter(Boolean)]));
      localStorage.setItem('qalb_alam_deleted_video_ids', JSON.stringify(mergedV));
    }
  } catch {}
}

export function getDeletedVideoIds(): string[] {
  try {
    const saved = localStorage.getItem('qalb_alam_deleted_video_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function addDeletedVideoId(id: string) {
  if (!id) return;
  const current = getDeletedVideoIds();
  if (!current.includes(id)) {
    current.push(id);
    try {
      localStorage.setItem('qalb_alam_deleted_video_ids', JSON.stringify(current));
    } catch {}
  }
  fetch('/api/deleted-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'videos', id }),
  }).catch(() => {});
  saveToFirebase("deleted_ids", {
    courses: getDeletedCourseIds(),
    users: getDeletedUserIds(),
    exams: getDeletedExamIds(),
    notifications: getDeletedNotificationIds(),
    coupons: getDeletedCouponIds(),
    videos: getDeletedVideoIds(),
  }).catch(() => {});
}

export async function fetchServerDeletedIds(): Promise<{ courses: string[]; users: string[]; exams: string[]; notifications: string[]; coupons: string[] }> {
  try {
    const res = await fetch('/api/deleted-ids');
    if (res.ok) {
      const data = await res.json();
      syncDeletedIds(data.courses, data.users, data.exams, data.notifications, data.coupons);
    }
  } catch {}
  return {
    courses: getDeletedCourseIds(),
    users: getDeletedUserIds(),
    exams: getDeletedExamIds(),
    notifications: getDeletedNotificationIds(),
    coupons: getDeletedCouponIds(),
  };
}

// Auto-sync deleted IDs on startup
if (typeof window !== 'undefined') {
  fetchServerDeletedIds().catch(() => {});
}

export function addDeletedCourseId(id: string) {
  if (!id) return;
  const current = getDeletedCourseIds();
  if (!current.includes(id)) {
    current.push(id);
    try {
      localStorage.setItem('qalb_alam_deleted_course_ids', JSON.stringify(current));
    } catch {}
  }
  fetch('/api/deleted-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'courses', id }),
  }).catch(() => {});
  saveToFirebase("deleted_ids", { courses: getDeletedCourseIds(), users: getDeletedUserIds(), exams: getDeletedExamIds() }).catch(() => {});
}

export function getDeletedUserIds(): string[] {
  try {
    const saved = localStorage.getItem('qalb_alam_deleted_user_ids');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export function addDeletedUserId(id: string) {
  if (!id) return;
  const current = getDeletedUserIds();
  if (!current.includes(id)) {
    current.push(id);
    try {
      localStorage.setItem('qalb_alam_deleted_user_ids', JSON.stringify(current));
    } catch {}
  }
  fetch('/api/deleted-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'users', id }),
  }).catch(() => {});
  saveToFirebase("deleted_ids", { courses: getDeletedCourseIds(), users: getDeletedUserIds(), exams: getDeletedExamIds() }).catch(() => {});
}

export function addDeletedExamId(id: string) {
  if (!id) return;
  const current = getDeletedExamIds();
  if (!current.includes(id)) {
    current.push(id);
    try {
      localStorage.setItem('qalb_alam_deleted_exam_ids', JSON.stringify(current));
    } catch {}
  }
  fetch('/api/deleted-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'exams', id }),
  }).catch(() => {});
  saveToFirebase("deleted_ids", { courses: getDeletedCourseIds(), users: getDeletedUserIds(), exams: getDeletedExamIds(), notifications: getDeletedNotificationIds(), coupons: getDeletedCouponIds() }).catch(() => {});
}

export function addDeletedNotificationId(id: string) {
  if (!id) return;
  const current = getDeletedNotificationIds();
  if (!current.includes(id)) {
    current.push(id);
    try {
      localStorage.setItem('qalb_alam_deleted_notification_ids', JSON.stringify(current));
    } catch {}
  }
  fetch('/api/deleted-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'notifications', id }),
  }).catch(() => {});
  saveToFirebase("deleted_ids", { courses: getDeletedCourseIds(), users: getDeletedUserIds(), exams: getDeletedExamIds(), notifications: getDeletedNotificationIds(), coupons: getDeletedCouponIds() }).catch(() => {});
}

export function addDeletedCouponId(code: string) {
  if (!code) return;
  const current = getDeletedCouponIds();
  const cleanCode = code.trim().toUpperCase();
  if (!current.includes(cleanCode)) {
    current.push(cleanCode);
    try {
      localStorage.setItem('qalb_alam_deleted_coupon_ids', JSON.stringify(current));
    } catch {}
  }
  fetch('/api/deleted-ids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'coupons', id: cleanCode }),
  }).catch(() => {});
  saveToFirebase("deleted_ids", { courses: getDeletedCourseIds(), users: getDeletedUserIds(), exams: getDeletedExamIds(), notifications: getDeletedNotificationIds(), coupons: getDeletedCouponIds() }).catch(() => {});
}

// === LOADERS & SAVERS ===

export function getSavedPlatformSettings(): PlatformSettings {
  try {
    const cached = getSecureCache<PlatformSettings>(STORAGE_KEYS.PLATFORM_SETTINGS);
    if (cached.data && cached.data.platformName) return cached.data;
  } catch (e) {}
  return INITIAL_PLATFORM_SETTINGS;
}

export function savePlatformSettings(settings: PlatformSettings) {
  setSecureCache(STORAGE_KEYS.PLATFORM_SETTINGS, settings);
  saveToFirebase("settings", settings);
  fetch('/api/settings/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  }).catch(() => {});
}

export function isDemoOrDeletedUser(u: any): boolean {
  if (!u) return true;
  const deletedIds = getDeletedUserIds();
  if (deletedIds.includes(u.id) || (u.phone && deletedIds.includes(u.phone))) {
    return true;
  }
  // Demo teacher Ahmed
  if (u.id === 'teacher-ahmed-chemistry' || u.accountNumber === '1002' || u.phone === '01011223344') {
    return true;
  }
  // Deleted or test teacher Hosam Ahmed Mosaed
  if (
    u.id === 'teacher-1822115595240' ||
    u.phone === 'teacher-4879' ||
    (u.role === 'teacher' && (u.name?.trim() === 'حسام احمد مساعد' || u.id?.includes('teacher-hosam')))
  ) {
    return true;
  }
  // Ghost / fallback test student accounts
  if (
    u.id === 'SfE3LtThTFfDbYBAQuTsdLaRXVs1' ||
    u.phone === '4879' ||
    u.email === '4879@qalb-alam.edu'
  ) {
    return true;
  }
  // Demo or fallback teacher accounts
  if (
    u.id === 'teacher-default' ||
    u.id === 'teacher-hosam-supervisor' ||
    u.id === 'teacher-supervisor' ||
    u.accountNumber === '1001' ||
    (u.role === 'teacher' && (u.accountNumber === '1001' || u.id?.includes('teacher-default')))
  ) {
    return true;
  }
  return false;
}

export function purgeDemoData() {
  try {
    const dummyCourseIds = new Set([
      'course-1821013405232',
      'course-1821013405233',
      'course-1821013405234',
      'course-1821013405235',
      'course-1821013405236',
      'course-integrated-physics',
      'course-exams-chemistry',
    ]);
    const cachedCourses = getSecureCache<Course[]>(STORAGE_KEYS.COURSES);
    if (Array.isArray(cachedCourses.data)) {
      const cleaned = cachedCourses.data.filter(
        (c: any) =>
          !dummyCourseIds.has(c.id) &&
          c.instructorId !== 'teacher-ahmed-chemistry' &&
          c.instructorId !== 'teacher-hosam-supervisor' &&
          c.instructorId !== 'teacher-default' &&
          c.instructorId !== '1001'
      );
      setSecureCache(STORAGE_KEYS.COURSES, cleaned);
    }

    const cachedUsers = getSecureCache<User[]>(STORAGE_KEYS.USERS);
    if (Array.isArray(cachedUsers.data)) {
      const cleaned = cachedUsers.data.filter((u: any) => !isDemoOrDeletedUser(u));
      setSecureCache(STORAGE_KEYS.USERS, cleaned);
      if (cleaned.length !== cachedUsers.data.length) {
        saveToFirebase("users", cleaned);
      }
    }

    const cachedCurrentUser = getSecureCache<User>(STORAGE_KEYS.CURRENT_USER);
    if (cachedCurrentUser.data && isDemoOrDeletedUser(cachedCurrentUser.data)) {
      removeSecureCache(STORAGE_KEYS.CURRENT_USER);
    }
  } catch (e) {}
}

// Automatically purge demo data on evaluation
purgeDemoData();

let pendingCoursesSyncTimer: ReturnType<typeof setTimeout> | null = null;
let latestCoursesToSync: Course[] | null = null;

export async function syncCoursesToServer(courses: Course[]): Promise<boolean> {
  latestCoursesToSync = courses;
  if (pendingCoursesSyncTimer) {
    clearTimeout(pendingCoursesSyncTimer);
  }
  return new Promise((resolve) => {
    pendingCoursesSyncTimer = setTimeout(async () => {
      pendingCoursesSyncTimer = null;
      const payload = latestCoursesToSync || courses;
      try {
        const token = await auth?.currentUser?.getIdToken?.();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/courses/save', {
          method: 'POST',
          headers,
          body: JSON.stringify({ courses: payload }),
        });
        resolve(res.ok);
      } catch (e) {
        resolve(false);
      }
    }, 150);
  });
}

export async function syncExamToServer(exam: CourseExam): Promise<boolean> {
  try {
    const token = await auth?.currentUser?.getIdToken?.();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch('/api/exams/save', {
      method: 'POST',
      headers,
      body: JSON.stringify({ exam, courseId: exam.courseId }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

function mergeLessonsList(baseLessons: CourseLesson[] = [], incLessons: CourseLesson[] = []): CourseLesson[] {
  const lessonMap = new Map<string, CourseLesson>();
  (incLessons || []).forEach((l) => { if (l?.id) lessonMap.set(l.id, l); });
  (baseLessons || []).forEach((b) => {
    if (!b?.id) return;
    const existing = lessonMap.get(b.id);
    if (!existing) {
      lessonMap.set(b.id, b);
    } else {
      // Merge videos so newly added videos are never lost
      const videoMap = new Map<string, LessonVideo>();
      (existing.videos || []).forEach((v) => { if (v?.id) videoMap.set(v.id, v); });
      (b.videos || []).forEach((v) => { if (v?.id) videoMap.set(v.id, v); }); // local additions win
      const mergedVideos = Array.from(videoMap.values()).sort((x, y) => (x.order || 0) - (y.order || 0));

      // Merge PDFs
      const pdfMap = new Map<string, LessonPdf>();
      (existing.pdfs || []).forEach((p) => { if (p?.id) pdfMap.set(p.id, p); });
      (b.pdfs || []).forEach((p) => { if (p?.id) pdfMap.set(p.id, p); });

      // Merge exams
      const examMap = new Map<string, CourseExam>();
      (existing.exams || []).forEach((e) => { if (e?.id) examMap.set(e.id, e); });
      (b.exams || []).forEach((e) => { if (e?.id) examMap.set(e.id, e); });

      lessonMap.set(b.id, {
        ...existing,
        ...b,
        videos: mergedVideos,
        pdfs: Array.from(pdfMap.values()),
        exams: Array.from(examMap.values()),
      });
    }
  });
  return Array.from(lessonMap.values()).sort((x, y) => (x.order || 0) - (y.order || 0));
}

function cleanLessonVideos(videos: LessonVideo[] = []): LessonVideo[] {
  const deletedVideos = getDeletedVideoIds();
  return (videos || [])
    .filter((v) => v && (v.id || v.url || v.vcdnVideoId) && (!v.id || !deletedVideos.includes(v.id)))
    .map((v, idx) => ({
      ...v,
      id: v.id || `vid_${Date.now()}_${idx}`,
      order: v.order || idx + 1,
    }));
}

function getSafeCourseTimestamp(iso?: string | number): number {
  if (!iso) return 0;
  const ms = typeof iso === 'number' ? iso : new Date(iso).getTime();
  // Reject future clock-skewed timestamps (e.g. 2027 container timestamps) so real saves always win
  if (!ms || Number.isNaN(ms) || ms > Date.now() + 300000) return 0;
  return ms;
}

export function mergeCourses(existingCourses: Course[], incomingCourses: Course[]): Course[] {
  const courseMap = new Map<string, Course>();
  const deletedIds = getDeletedCourseIds();

  const isDemoOrDeleted = (c: any) =>
    !c ||
    !c.id ||
    deletedIds.includes(c.id);

  // 1. Seed with existing (local/authoritative) courses
  (existingCourses || []).forEach((c) => {
    if (c?.id && !isDemoOrDeleted(c)) {
      const cleanedLessons = (c.lessons || []).map((l) => ({
        ...l,
        videos: cleanLessonVideos(l.videos),
      }));
      courseMap.set(c.id, { ...c, lessons: cleanedLessons });
    }
  });

  // 2. Process incoming courses
  (incomingCourses || []).forEach((inc) => {
    if (!inc?.id || isDemoOrDeleted(inc)) return;
    const base = courseMap.get(inc.id);
    if (!base) {
      const cleanedLessons = (inc.lessons || []).map((l) => ({
        ...l,
        videos: cleanLessonVideos(l.videos),
      }));
      courseMap.set(inc.id, { ...inc, lessons: cleanedLessons });
    } else {
      const baseRev = Number((base as any).revision || 0);
      const incRev = Number((inc as any).revision || 0);
      const baseTime = getSafeCourseTimestamp(base.updatedAt || base.createdAt);
      const incTime = getSafeCourseTimestamp(inc.updatedAt || inc.createdAt);

      const isIncomingNewer =
        incRev > baseRev || (incRev === baseRev && incTime > baseTime && incTime > 0);

      if (isIncomingNewer) {
        const mergedLessons = mergeLessonsList(base.lessons || [], inc.lessons || []).map((l) => ({
          ...l,
          videos: cleanLessonVideos(l.videos),
        }));
        courseMap.set(inc.id, {
          ...base,
          ...inc,
          lessons: mergedLessons,
        });
      } else {
        const mergedLessons = mergeLessonsList(inc.lessons || [], base.lessons || []).map((l) => ({
          ...l,
          videos: cleanLessonVideos(l.videos),
        }));
        courseMap.set(inc.id, {
          ...inc,
          ...base,
          lessons: mergedLessons,
        });
      }
    }
  });

  return Array.from(courseMap.values());
}

export function mergeUsers(existingUsers: User[], incomingUsers: User[]): User[] {
  const userMap = new Map<string, User>();
  const deletedIds = getDeletedUserIds();

  // 1. Seed with existing users
  (existingUsers || []).forEach((u) => {
    if (u && u.id && !isDemoOrDeletedUser(u) && !deletedIds.includes(u.id)) {
      userMap.set(u.id, u);
    }
  });

  // 2. Merge incoming users
  (incomingUsers || []).forEach((inc) => {
    if (!inc || !inc.id || isDemoOrDeletedUser(inc) || deletedIds.includes(inc.id)) return;
    const base = userMap.get(inc.id);
    if (!base) {
      userMap.set(inc.id, inc);
    } else {
      const mergedEnrolled = Array.from(new Set([
        ...(base.enrolledCourseIds || []),
        ...(inc.enrolledCourseIds || []),
      ]));
      const mergedExamResults = {
        ...(inc.examResults || {}),
        ...(base.examResults || {}),
      };
      const mergedCompletedVideos = {
        ...(inc.completedVideos || {}),
        ...(base.completedVideos || {}),
      };
      userMap.set(inc.id, {
        ...inc,
        ...base,
        name: base.name && base.name !== 'طالب منصة المتفلسفة ' && base.name !== 'مستخدم منصة المتفلسفة ' ? base.name : inc.name,
        enrolledCourseIds: mergedEnrolled,
        examResults: mergedExamResults,
        completedVideos: mergedCompletedVideos,
        walletBalance: typeof base.walletBalance === 'number' ? base.walletBalance : (typeof inc.walletBalance === 'number' ? inc.walletBalance : 0),
        walletTransactions: (base.walletTransactions && base.walletTransactions.length > 0) ? base.walletTransactions : (inc.walletTransactions || []),
        status: base.status === 'active' || inc.status === 'active' ? 'active' : (base.status || inc.status),
      });
    }
  });

  return Array.from(userMap.values());
}

export function getSavedExams(): CourseExam[] {
  try {
    const deletedExams = getDeletedExamIds();
    const cached = getSecureCache<CourseExam[]>(STORAGE_KEYS.EXAMS_STORE);
    if (Array.isArray(cached.data)) {
      return cached.data.filter((e) => e && e.id && !deletedExams.includes(e.id));
    }
  } catch (e) {}
  return [];
}

function normalizeCourseVideoUrls(course: Course): Course {
  if (!course || !Array.isArray(course.lessons)) return course;
  let changed = false;
  const lessons = course.lessons.map((lesson) => {
    if (!lesson || !Array.isArray(lesson.videos)) return lesson;
    let lessonChanged = false;
    const videos = lesson.videos.map((v: any) => {
      if (!v || typeof v !== 'object') return v;
      if (typeof v.url === 'string' && (!v.originalUrl || typeof v.originalUrl === 'string')) {
        return v;
      }
      lessonChanged = true;
      changed = true;
      const cleanUrl =
        typeof v.url === 'string'
          ? v.url
          : v.url && typeof v.url === 'object'
          ? String(v.url.url || v.url.playableUrl || v.url.streamUrl || '')
          : '';
      const cleanOrig =
        typeof v.originalUrl === 'string'
          ? v.originalUrl
          : v.originalUrl && typeof v.originalUrl === 'object'
          ? String(v.originalUrl.url || v.originalUrl.playableUrl || '')
          : undefined;
      return {
        ...v,
        url: cleanUrl,
        ...(cleanOrig !== undefined ? { originalUrl: cleanOrig } : {}),
      };
    });
    return lessonChanged ? { ...lesson, videos } : lesson;
  });
  return changed ? { ...course, lessons } : course;
}

export function getSavedCourses(): Course[] {
  try {
    const deletedIds = getDeletedCourseIds();
    const cached = getSecureCache<Course[]>(STORAGE_KEYS.COURSES);
    let courses: Course[] = [];
    if (Array.isArray(cached.data)) {
      courses = cached.data
        .filter((c) => c && c.id && !deletedIds.includes(c.id))
        .map(normalizeCourseVideoUrls);
    }

    if (courses.length === 0 && Array.isArray(DEFAULT_COURSES) && DEFAULT_COURSES.length > 0) {
      courses = DEFAULT_COURSES
        .filter((c) => c && c.id && !deletedIds.includes(c.id))
        .map(normalizeCourseVideoUrls);
    }

    return courses;
  } catch (e) {
    return Array.isArray(DEFAULT_COURSES) ? DEFAULT_COURSES : [];
  }
}

export function saveExamToStore(exam: CourseExam, targetCourseId?: string): { success: boolean; allExams: CourseExam[] } {
  try {
    const effectiveCourseId = targetCourseId || exam.courseId;
    const updatedExam: CourseExam = {
      ...exam,
      courseId: effectiveCourseId,
      createdAt: exam.createdAt || new Date().toISOString().split('T')[0],
    };

    // 1. Save to dedicated EXAMS_STORE in AES-encrypted LocalStorage
    const currentExams = getSavedExams();
    const existingIndex = currentExams.findIndex((e) => e.id === updatedExam.id);
    let allExams: CourseExam[];
    if (existingIndex >= 0) {
      allExams = [...currentExams];
      allExams[existingIndex] = updatedExam;
    } else {
      allExams = [updatedExam, ...currentExams];
    }
    const activeRole = getCurrentUser()?.role;
    const isPriv = activeRole === 'admin' || activeRole === 'teacher';
    setSecureCache(
      STORAGE_KEYS.EXAMS_STORE,
      allExams.map((ex) => sanitizeExamForStudentCache(ex, isPriv))
    );

    // 2. Attach exam to course in COURSES list
    const currentCourses = getSavedCourses();
    let courseFound = false;
    const updatedCourses = currentCourses.map((c) => {
      if (c.id === effectiveCourseId) {
        courseFound = true;
        const exams = c.exams || [];
        const eIdx = exams.findIndex((e) => e.id === updatedExam.id);
        const newExams = eIdx >= 0
          ? exams.map((e, i) => (i === eIdx ? updatedExam : e))
          : [...exams, updatedExam];

        let newLessons = c.lessons;
        if (Array.isArray(newLessons) && updatedExam.lessonTitle) {
          newLessons = newLessons.map((l) => {
            if (l.title === updatedExam.lessonTitle || l.id === updatedExam.lessonTitle) {
              const lExams = l.exams || [];
              const leIdx = lExams.findIndex((e) => e.id === updatedExam.id);
              return {
                ...l,
                exams: leIdx >= 0 ? lExams.map((e, i) => (i === leIdx ? updatedExam : e)) : [...lExams, updatedExam],
              };
            }
            return l;
          });
        }

        return {
          ...c,
          exams: newExams,
          lessons: newLessons,
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    });

    if (!courseFound && updatedCourses.length > 0 && effectiveCourseId) {
      const firstCourse = updatedCourses[0];
      firstCourse.exams = [...(firstCourse.exams || []), updatedExam];
      firstCourse.updatedAt = new Date().toISOString();
    }

    saveCourses(updatedCourses);

    // 3. Save to Firebase standalone document for exams
    saveToFirebase("exams", allExams).catch((err) => {
      console.warn("Firestore save standalone exam notice:", err);
    });

    // 4. Sync to Server backend
    syncExamToServer(updatedExam).catch((err) => {
      console.warn("Server sync standalone exam notice:", err);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('qalb_alam_exam_saved', { detail: updatedExam }));
    }

    return { success: true, allExams };
  } catch (e) {
    console.error("Error saving exam to store:", e);
    return { success: false, allExams: [] };
  }
}

export async function deleteExamFromStore(examId: string, courseId?: string): Promise<{ success: boolean; allExams: CourseExam[] }> {
  try {
    if (!examId) return { success: false, allExams: [] };
    addDeletedExamId(examId);

    // 1. Remove from EXAMS_STORE
    const currentExams = getSavedExams().filter((e) => e && e.id !== examId);
    setSecureCache(STORAGE_KEYS.EXAMS_STORE, currentExams);

    // 2. Remove from courses in local storage
    const currentCourses = getSavedCourses();
    const updatedCourses = currentCourses.map((c) => {
      const cExams = (c.exams || []).filter((e) => e && e.id !== examId);
      const cLessons = (c.lessons || []).map((l) => ({
        ...l,
        exams: (l.exams || []).filter((e) => e && e.id !== examId),
      }));
      return {
        ...c,
        exams: cExams,
        lessons: cLessons,
        updatedAt: new Date().toISOString(),
      };
    });
    saveCourses(updatedCourses);

    // 3. Delete from Server
    let idToken: string | undefined;
    try {
      idToken = await auth.currentUser?.getIdToken();
    } catch {}
    const headers: Record<string, string> = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    fetch(`/api/exams/${encodeURIComponent(examId)}`, {
      method: 'DELETE',
      headers,
    }).catch(() => {});

    // 4. Save updated exams to Firebase
    saveToFirebase("exams", currentExams).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('qalb_alam_exam_deleted', { detail: { examId, courseId } }));
    }

    return { success: true, allExams: currentExams };
  } catch (e) {
    console.error("Error deleting exam from store:", e);
    return { success: false, allExams: [] };
  }
}

export function saveCourses(courses: Course[]) {
  const deletedIds = getDeletedCourseIds();
  const now = new Date().toISOString();
  const cleaned = (courses || [])
    .filter((c) => c && c.id && !deletedIds.includes(c.id))
    .map((c) => ({
      ...c,
      revision: Number((c as any).revision || 1) + 1,
      updatedAt: now, // Always set to current timestamp so modifications supersede previous versions
    }));

  // Store only the active exams that currently belong to the courses
  try {
    const examMap = new Map<string, CourseExam>();

    cleaned.forEach((course) => {
      (course.exams || []).forEach((exam) => {
        if (exam?.id) {
          examMap.set(exam.id, { ...exam, courseId: course.id });
        }
      });
      (course.lessons || []).forEach((lesson) => {
        (lesson.exams || []).forEach((exam) => {
          if (exam?.id) {
            examMap.set(exam.id, { ...exam, courseId: course.id, lessonTitle: lesson.title });
          }
        });
      });
    });

    const allExams = Array.from(examMap.values());
    const activeRole = getCurrentUser()?.role;
    const isPriv = activeRole === 'admin' || activeRole === 'teacher';
    setSecureCache(
      STORAGE_KEYS.EXAMS_STORE,
      allExams.map((ex) => sanitizeExamForStudentCache(ex, isPriv))
    );
  } catch (e) {
    console.warn("Could not backup exams to EXAMS_STORE:", e);
  }

  const activeUser = getCurrentUser();
  setSecureCache(STORAGE_KEYS.COURSES, sanitizeCoursesForClientCache(cleaned, activeUser?.role));

  saveToFirebase("courses", cleaned).catch((err) => {
    console.warn("Client Firestore courses save notice:", err);
  });

  syncCoursesToServer(cleaned).catch((err) => {
    console.warn("Server API courses sync notice:", err);
  });
}

export async function deleteCourseFromServer(courseId: string): Promise<boolean> {
  addDeletedCourseId(courseId);
  try {
    const current = getSavedCourses();
    const filtered = current.filter((c) => c.id !== courseId);
    const activeUser = getCurrentUser();
    setSecureCache(STORAGE_KEYS.COURSES, sanitizeCoursesForClientCache(filtered, activeUser?.role));

    let idToken: string | undefined;
    try {
      idToken = await auth.currentUser?.getIdToken();
    } catch {}
    const headers: Record<string, string> = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

    // 1. Call server API with token
    fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
      method: 'DELETE',
      headers,
    }).catch(() => {});

    // 2. Also register with /api/deleted-ids store to prevent resurrection
    fetch('/api/deleted-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'courses', id: courseId }),
    }).catch(() => {});

    // 3. Save filtered array directly to Firebase Firestore SDK & REST
    saveToFirebase("courses", filtered).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export async function deleteUserFromServer(userId: string): Promise<boolean> {
  addDeletedUserId(userId);
  try {
    const current = getSavedUsers();
    const filtered = current.filter((u) => u.id !== userId);
    const activeUser = getCurrentUser();
    setSecureCache(STORAGE_KEYS.USERS, sanitizeUsersForClientCache(filtered, activeUser));

    let idToken: string | undefined;
    try {
      idToken = await auth.currentUser?.getIdToken();
    } catch {}
    const headers: Record<string, string> = {};
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

    // 1. Call server API with token
    fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers,
    }).catch(() => {});

    // 2. Also register with /api/deleted-ids store on server to prevent resurrection
    fetch('/api/deleted-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'users', id: userId }),
    }).catch(() => {});

    // 3. Save filtered array directly to Firebase Firestore
    saveToFirebase("users", filtered).catch(() => {});

    // 3. Delete document from users collection directly
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch {}

    return true;
  } catch {
    return false;
  }
}

export async function saveSingleUserToServer(user: User): Promise<boolean> {
  try {
    const current = getSavedUsers();
    const idx = current.findIndex((u) => u.id === user.id || (user.phone && u.phone === user.phone));
    let updated: User[];
    if (idx >= 0) {
      updated = current.map((u, i) => (i === idx ? { ...u, ...user } : u));
    } else {
      updated = [...current, user];
    }
    const activeUser = getCurrentUser();
    setSecureCache(STORAGE_KEYS.USERS, sanitizeUsersForClientCache(updated, activeUser || user));

    let idToken: string | undefined;
    try {
      idToken = await auth.currentUser?.getIdToken();
    } catch {}
    const apiHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) {
      apiHeaders['Authorization'] = `Bearer ${idToken}`;
    }

    // 1. Server API
    fetch('/api/users/save-single', {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ user }),
    }).catch(() => {});

    // 2. Client Firestore SDK (writes to isolated document `users/{uid}` without plaintext password)
    const firestoreSafeUser = { ...user };
    delete (firestoreSafeUser as any).password;
    try {
      await setDoc(doc(db, 'users', user.id), firestoreSafeUser, { merge: true });
    } catch {
      // 3. Fallback direct REST write to users/{id} with auth token
      if (idToken) {
        try {
          const apiKey = "AIzaSyDdwnLfJbsQ8hbXP-CzocjaejmvYC4FOh4";
          const projectId = "alesraa-academy";
          const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(user.id)}?key=${apiKey}`;
          const fieldsObj: Record<string, any> = {};
          for (const [k, v] of Object.entries(firestoreSafeUser)) {
            fieldsObj[k] = wrapRestValue(v);
          }
          fieldsObj['updatedAt'] = { stringValue: new Date().toISOString() };
          await fetch(restUrl, {
            method: 'PATCH',
            headers: apiHeaders,
            body: JSON.stringify({ fields: fieldsObj }),
          });
        } catch {}
      }
    }

    // 4. Update sharded users list in Firestore ONLY if Admin or Teacher
    const effectiveRole = activeUser?.role || user.role;
    if (effectiveRole === 'admin' || effectiveRole === 'teacher') {
      saveToFirebase('users', updated).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export function getSavedCompetitions(): Competition[] {
  try {
    const cached = getSecureCache<Competition[]>(STORAGE_KEYS.COMPETITIONS);
    if (Array.isArray(cached.data)) return cached.data;
  } catch (e) {}
  return INITIAL_COMPETITIONS;
}

export function saveCompetitions(competitions: Competition[]) {
  setSecureCache(STORAGE_KEYS.COMPETITIONS, competitions);
  saveToFirebase("competitions", competitions);
}

export function getSavedAccessCodes(): CourseAccessCode[] {
  try {
    const activeUser = getCurrentUser();
    if (activeUser && activeUser.role !== 'admin' && activeUser.role !== 'teacher') {
      return [];
    }
    const cached = getSecureCache<CourseAccessCode[]>(STORAGE_KEYS.ACCESS_CODES);
    if (Array.isArray(cached.data)) return cached.data;
  } catch (e) {}
  return INITIAL_ACCESS_CODES;
}

export function saveAccessCodes(codes: CourseAccessCode[]) {
  const activeUser = getCurrentUser();
  if (!activeUser || activeUser.role === 'admin' || activeUser.role === 'teacher') {
    setSecureCache(STORAGE_KEYS.ACCESS_CODES, codes);
  }
  saveToFirebase("accessCodes", codes);
}

export function getSavedWalletCodes(): WalletRechargeCode[] {
  try {
    const cached = getSecureCache<WalletRechargeCode[]>(STORAGE_KEYS.WALLET_CODES);
    if (Array.isArray(cached.data)) return cached.data;
  } catch (e) {}
  return [];
}

export function saveWalletCodes(codes: WalletRechargeCode[]) {
  setSecureCache(STORAGE_KEYS.WALLET_CODES, codes);
  saveToFirebase("wallet_codes", codes);
  (async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      await fetch('/api/wallet/codes/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({ codes }),
      });
    } catch {}
  })();
}

export async function fetchWalletCodesFromServer(): Promise<WalletRechargeCode[]> {
  try {
    const [serverRes, fbData] = await Promise.all([
      fetch('/api/wallet/codes').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      loadFromFirebase('wallet_codes', false).catch(() => null),
    ]);
    const map = new Map<string, WalletRechargeCode>();
    const local = getSavedWalletCodes();
    local.forEach((c) => {
      if (c?.code) map.set(c.code.toUpperCase(), c);
    });
    if (Array.isArray(fbData)) {
      fbData.forEach((c: WalletRechargeCode) => {
        if (c?.code) {
          const existing = map.get(c.code.toUpperCase());
          map.set(c.code.toUpperCase(), existing?.isUsed ? existing : c);
        }
      });
    }
    if (serverRes && Array.isArray(serverRes.codes)) {
      serverRes.codes.forEach((c: WalletRechargeCode) => {
        if (c?.code) {
          const existing = map.get(c.code.toUpperCase());
          map.set(c.code.toUpperCase(), existing?.isUsed ? existing : c);
        }
      });
    }
    const merged = Array.from(map.values());
    if (merged.length > 0) {
      setSecureCache(STORAGE_KEYS.WALLET_CODES, merged);
    }
    return merged;
  } catch {
    return getSavedWalletCodes();
  }
}

export async function redeemStudentWalletCode(
  rawCode: string,
  student: User
): Promise<{
  success: boolean;
  amount?: number;
  newBalance?: number;
  updatedUser?: User;
  message?: string;
  error?: string;
}> {
  const cleanCode = String(rawCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, error: 'يرجى إدخال كود شحن المحفظة.' };
  }
  if (!student || !student.id) {
    return { success: false, error: 'يرجى تسجيل الدخول بحساب الطالب أولاً.' };
  }

  // 1. Try server endpoint first
  try {
    const res = await fetch('/api/wallet/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: cleanCode,
        studentId: student.id,
        studentName: student.name,
        studentPhone: student.phone,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      const addedAmount = Number(data.amount) || 0;
      const currentBal = Number(student.walletBalance) || 0;
      const newBalance = typeof data.newBalance === 'number' ? data.newBalance : currentBal + addedAmount;
      const tx: WalletTransaction = data.transaction || {
        id: `wtx_${Date.now()}`,
        type: 'recharge_code',
        amount: addedAmount,
        balanceAfter: newBalance,
        description: `شحن المحفظة بكود شحن (${cleanCode})`,
        codeUsed: cleanCode,
        createdAt: new Date().toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      const updatedUser: User = {
        ...student,
        walletBalance: newBalance,
        walletTransactions: [tx, ...(student.walletTransactions || [])].slice(0, 50),
      };

      // Update local wallet codes cache if present
      const localCodes = getSavedWalletCodes();
      if (localCodes.some((c) => c.code.toUpperCase() === cleanCode)) {
        const nextCodes = localCodes.map((c) =>
          c.code.toUpperCase() === cleanCode
            ? {
                ...c,
                isUsed: true,
                usedByStudentId: student.id,
                usedByStudentName: student.name,
                usedByStudentPhone: student.phone,
                usedAt: tx.createdAt,
              }
            : c
        );
        setSecureCache(STORAGE_KEYS.WALLET_CODES, nextCodes);
      }

      saveCurrentUser(updatedUser);
      await saveSingleUserToServer(updatedUser);

      return {
        success: true,
        amount: addedAmount,
        newBalance,
        updatedUser,
        message: data.message || `تم شحن محفظتك بمبلغ ${addedAmount} ج.م بنجاح! 🎉`,
      };
    }

    // If server returned a definitive "already used" error, return it immediately
    if (data.error && data.error.includes('مسبقاً')) {
      return { success: false, error: data.error };
    }
  } catch {}

  // 2. Fallback: Check local / Firestore wallet_codes directly
  const allCodes = await fetchWalletCodesFromServer();
  const targetIdx = allCodes.findIndex((c) => String(c.code || '').trim().toUpperCase() === cleanCode);
  if (targetIdx === -1) {
    return { success: false, error: 'كود الشحن غير صحيح. تأكد من كتابة الكود كما استلمته من الإدارة.' };
  }
  const targetCode = allCodes[targetIdx];
  if (targetCode.isUsed) {
    return { success: false, error: 'هذا الكود تم استخدامه مسبقاً ولا يمكن شحنه مرة أخرى.' };
  }

  const addedAmount = Number(targetCode.amount) || 0;
  const nowFormatted = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const updatedCodes = allCodes.map((c, idx) =>
    idx === targetIdx
      ? {
          ...c,
          isUsed: true,
          usedByStudentId: student.id,
          usedByStudentName: student.name,
          usedByStudentPhone: student.phone,
          usedAt: nowFormatted,
        }
      : c
  );
  saveWalletCodes(updatedCodes);

  const currentBal = Number(student.walletBalance) || 0;
  const newBalance = currentBal + addedAmount;
  const tx: WalletTransaction = {
    id: `wtx_${Date.now()}`,
    type: 'recharge_code',
    amount: addedAmount,
    balanceAfter: newBalance,
    description: `شحن المحفظة بكود شحن (${cleanCode})`,
    codeUsed: cleanCode,
    createdAt: nowFormatted,
  };

  const updatedUser: User = {
    ...student,
    walletBalance: newBalance,
    walletTransactions: [tx, ...(student.walletTransactions || [])].slice(0, 50),
  };

  saveCurrentUser(updatedUser);
  await saveSingleUserToServer(updatedUser);

  return {
    success: true,
    amount: addedAmount,
    newBalance,
    updatedUser,
    message: `تم شحن محفظتك بمبلغ ${addedAmount} ج.م بنجاح! 🎉`,
  };
}

export function deduplicateSubmissions(submissions: StudentExamSubmission[]): StudentExamSubmission[] {
  if (!Array.isArray(submissions)) return [];
  const seenIds = new Set<string>();
  const result: StudentExamSubmission[] = [];

  for (const sub of submissions) {
    if (!sub) continue;
    const idKey = sub.submissionId || (sub as any).id || `${sub.examId || 'ex'}-${sub.studentId || 'st'}-${sub.submittedAt || ''}`;
    if (!seenIds.has(idKey)) {
      seenIds.add(idKey);
      result.push(sub);
    }
  }
  return result;
}

export function getSavedSubmissions(): StudentExamSubmission[] {
  try {
    const cached = getSecureCache<StudentExamSubmission[]>(STORAGE_KEYS.SUBMISSIONS);
    if (Array.isArray(cached.data)) return deduplicateSubmissions(cached.data);
  } catch (e) {}
  return deduplicateSubmissions(INITIAL_SUBMISSIONS);
}

export function saveSubmissions(submissions: StudentExamSubmission[]) {
  const deduped = deduplicateSubmissions(submissions);
  setSecureCache(STORAGE_KEYS.SUBMISSIONS, deduped);
  fetch('/api/submissions/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissions: deduped.slice(0, 50) }),
  }).catch(() => {});
  saveToFirebase("submissions", deduped);
}

export function getSavedNotifications(): PlatformNotification[] {
  try {
    const deletedIds = getDeletedNotificationIds();
    const cached = getSecureCache<PlatformNotification[]>(STORAGE_KEYS.NOTIFICATIONS);
    if (Array.isArray(cached.data)) {
      return cached.data.filter((n) => n && n.id && !deletedIds.includes(n.id));
    }
  } catch (e) {}
  const deletedIds = getDeletedNotificationIds();
  return INITIAL_NOTIFICATIONS.filter((n) => !deletedIds.includes(n.id));
}

export function saveNotifications(notifications: PlatformNotification[]) {
  const deletedIds = getDeletedNotificationIds();
  const cleaned = (notifications || []).filter((n) => n && n.id && !deletedIds.includes(n.id));
  setSecureCache(STORAGE_KEYS.NOTIFICATIONS, cleaned);
  saveToFirebase("notifications", cleaned);
  fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notifications: cleaned }),
  }).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('qalb_alam_notifications_updated', { detail: cleaned }));
  }
}

export function getSavedUsers(): User[] {
  try {
    const cached = getSecureCache<User[]>(STORAGE_KEYS.USERS);
    if (Array.isArray(cached.data) && cached.data.length > 0) {
      const filtered = cached.data.filter((u: any) => !isDemoOrDeletedUser(u));
      if (filtered.length > 0) return filtered;
    }
  } catch (e) {}
  return INITIAL_STUDENTS;
}

export function saveUsers(users: User[]) {
  const cleaned = users.filter((u) => !isDemoOrDeletedUser(u));
  const activeUser = getCurrentUser();
  setSecureCache(STORAGE_KEYS.USERS, sanitizeUsersForClientCache(cleaned, activeUser));

  // 1. Save to Firebase Firestore
  saveToFirebase("users", cleaned).catch((err) => {
    console.warn("Client Firestore users save notice:", err);
  });

  // 2. ALWAYS sync to server backend /api/users/save so server disk stays strictly in sync
  (async () => {
    try {
      let idToken: string | undefined;
      try {
        idToken = await auth.currentUser?.getIdToken();
      } catch {}
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      await fetch('/api/users/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({ users: cleaned }),
      });
    } catch (e) {
      console.warn("Server API users save notice:", e);
    }
  })();
}

export function getCurrentUser(): User | null {
  try {
    const cached = getSecureCache<User>(STORAGE_KEYS.CURRENT_USER);
    if (cached.data && cached.data.id && !isDemoOrDeletedUser(cached.data)) {
      return cached.data;
    }
    const rawBackup = localStorage.getItem('al_motafalsifa_current_user');
    if (rawBackup) {
      const parsed = JSON.parse(rawBackup);
      if (parsed && parsed.id && !isDemoOrDeletedUser(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
}

export function saveCurrentUser(user: User | null) {
  try {
    if (!user || !user.id || isDemoOrDeletedUser(user)) {
      removeSecureCache(STORAGE_KEYS.CURRENT_USER);
      localStorage.removeItem('al_motafalsifa_current_user');
    } else {
      const safeUser = { ...user };
      delete (safeUser as any).password;
      setSecureCache(STORAGE_KEYS.CURRENT_USER, safeUser);
      localStorage.setItem('al_motafalsifa_current_user', JSON.stringify(safeUser));
    }
  } catch (e) {}


// === STUDENT ENROLLED COURSES PERSISTENCE (AES-256 Encrypted) ===

export function getStudentEnrolledCourses(studentId?: string): string[] {
  if (!studentId) return [];
  try {
    const cached = getSecureCache<string[]>(`qalb_alam_enrolled_courses_${studentId}`);
    if (Array.isArray(cached.data)) {
      return cached.data.filter(Boolean);
    }
  } catch (e) {}
  return [];
}

export function saveStudentEnrolledCourses(studentId: string, courseIds: string[]) {
  if (!studentId) return;
  try {
    const uniqueList = Array.from(new Set(courseIds.filter(Boolean)));
    setSecureCache(`qalb_alam_enrolled_courses_${studentId}`, uniqueList);
  } catch (e) {}
}

export function saveStudentEnrolledCourse(studentId: string, courseId: string) {
  if (!studentId || !courseId) return;
  const current = getStudentEnrolledCourses(studentId);
  if (!current.includes(courseId)) {
    saveStudentEnrolledCourses(studentId, [...current, courseId]);
  }
}

export function removeStudentEnrolledCourse(studentId: string, courseId: string) {
  if (!studentId || !courseId) return;
  const current = getStudentEnrolledCourses(studentId);
  const updated = current.filter((id) => id !== courseId);
  saveStudentEnrolledCourses(studentId, updated);
}

// === PUSH ALL & PULL ALL UTILITIES ===

export async function forcePushAllToFirebase() {
  const currentCourses = getSavedCourses();
  const currentUsers = getSavedUsers();
  const currentCompetitions = getSavedCompetitions();
  const currentSettings = getSavedPlatformSettings();
  const currentCodes = getSavedAccessCodes();
  const currentSubmissions = getSavedSubmissions();
  const currentNotifications = getSavedNotifications();

  console.log("🚀 جاري رفع كافة البيانات المحدثة إلى سحابة Firebase...");
  notifyCloudStatus('connecting');

  const results = await Promise.all([
    saveToFirebase("courses", currentCourses),
    saveToFirebase("users", currentUsers),
    saveToFirebase("competitions", currentCompetitions),
    saveToFirebase("settings", currentSettings),
    saveToFirebase("accessCodes", currentCodes),
    saveToFirebase("submissions", currentSubmissions),
    saveToFirebase("notifications", currentNotifications),
  ]);

  const allSuccess = results.every(Boolean);
  if (allSuccess) {
    notifyCloudStatus('connected', null);
    console.log("✅ تم رفع وحفظ كل البيانات بنجاح في سحابة Firebase!");
  }
  return allSuccess;
}

// === ASYNC LOAD FROM FIREBASE WITH DEMO DATA FILTERING ===

export async function loadAllFromFirebase() {
  // Run fast server fetch and Firebase cloud fetch in PARALLEL (reduces load time by 50%+)
  let serverCourses: Course[] = [];
  let serverExams: CourseExam[] = [];
  let serverUsers: User[] = [];
  let serverSettings: PlatformSettings | null = null;

  let fbCourses: any = null;
  let fbUsers: any = null;
  let fbCompetitions: any = null;
  let fbSettings: any = null;
  let fbCodes: any = null;
  let fbSubmissions: any = null;
  let fbNotifications: any = null;
  let fbExams: any = null;

  try {
    const serverFetchPromise = Promise.race([
      fetch('/api/platform-data')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then(async (res) => {
          if (res) return res;
          return fetch('/initial_platform_data.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
        }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
    ]);

    const fbAllPromise = Promise.race([
      Promise.all([
        loadFromFirebase("courses"),
        loadFromFirebase("users"),
        loadFromFirebase("competitions"),
        loadFromFirebase("settings"),
        loadFromFirebase("accessCodes"),
        loadFromFirebase("submissions"),
        loadFromFirebase("notifications"),
        loadFromFirebase("exams"),
      ]).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500)),
    ]);

    const [sData, fbResults] = await Promise.all([serverFetchPromise, fbAllPromise]);

    if (sData) {
      if (Array.isArray(sData.courses) && sData.courses.length > 0) serverCourses = sData.courses;
      if (Array.isArray(sData.exams) && sData.exams.length > 0) serverExams = sData.exams;
      if (Array.isArray(sData.users) && sData.users.length > 0) serverUsers = sData.users;
      if (sData.settings && sData.settings.platformName) serverSettings = sData.settings;
    }

    if (Array.isArray(fbResults)) {
      [fbCourses, fbUsers, fbCompetitions, fbSettings, fbCodes, fbSubmissions, fbNotifications, fbExams] = fbResults;
    }
  } catch {}

  if (serverCourses.length === 0) {
    try {
      const scRes = await fetch('/api/courses').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (scRes && Array.isArray(scRes.courses)) serverCourses = scRes.courses;
    } catch {}
  }
  if (serverExams.length === 0) {
    try {
      const seRes = await fetch('/api/exams').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (seRes && Array.isArray(seRes.exams)) serverExams = seRes.exams;
    } catch {}
  }

  // Sanitize and combine courses from ALL sources (Firestore + Server Disk + Local Cache) so no course is ever lost
  const deletedCourseIds = getDeletedCourseIds();
  const localCourses = getSavedCourses().filter((c) => !deletedCourseIds.includes(c.id));
  const rawFbCourses = (Array.isArray(fbCourses) ? fbCourses : []).filter((c) => c && c.id && !deletedCourseIds.includes(c.id));
  const validServerCourses = (Array.isArray(serverCourses) ? serverCourses : []).filter((c) => c && c.id && !deletedCourseIds.includes(c.id));

  // Merge courses combining Cloud Firestore, Server Disk, and Local edits so redeployments never lose live courses
  const serverAndCloudCourses =
    rawFbCourses.length > 0
      ? mergeCourses(validServerCourses, rawFbCourses)
      : validServerCourses;
  let finalCourses: Course[] =
    localCourses.length > 0
      ? mergeCourses(serverAndCloudCourses, localCourses)
      : serverAndCloudCourses;

  // If cloud had fewer courses than final merged courses, push merged courses back to cloud & server
  if (finalCourses.length > rawFbCourses.length && finalCourses.length > 0) {
    saveToFirebase("courses", finalCourses).catch(() => {});
    syncCoursesToServer(finalCourses).catch(() => {});
  }

  // Merge standalone exams (from Firestore 'exams' and server '/api/exams')
  const allStandaloneExams: CourseExam[] = [];
  if (Array.isArray(fbExams)) allStandaloneExams.push(...fbExams);
  if (Array.isArray(serverExams)) allStandaloneExams.push(...serverExams);
  const localExams = getSavedExams();
  allStandaloneExams.push(...localExams);

  if (allStandaloneExams.length > 0 && finalCourses.length > 0) {
    const deletedExamIds = getDeletedExamIds();
    const examMap = new Map<string, CourseExam>();
    allStandaloneExams.forEach((e) => {
      if (e?.id && !deletedExamIds.includes(e.id) && !examMap.has(e.id)) {
        examMap.set(e.id, e);
      }
    });

    finalCourses = finalCourses.map((course) => {
      const courseExams = (course.exams || []).filter((e) => e && e.id && !deletedExamIds.includes(e.id));
      const updatedExams = courseExams.map((ce) => {
        const se = examMap.get(ce.id);
        if (se && (se.questions?.length || 0) > (ce.questions?.length || 0)) {
          return { ...ce, ...se };
        }
        return ce;
      });

      const updatedLessons = (course.lessons || []).map((l) => {
        const lExams = (l.exams || []).filter((e) => e && e.id && !deletedExamIds.includes(e.id));
        const updatedLExams = lExams.map((le) => {
          const se = examMap.get(le.id);
          if (se && (se.questions?.length || 0) > (le.questions?.length || 0)) {
            return { ...le, ...se };
          }
          return le;
        });
        return { ...l, exams: updatedLExams };
      });

      return {
        ...course,
        exams: updatedExams,
        lessons: updatedLessons,
      };
    });
  }

  const activeUser = getCurrentUser();
  const isPrivileged = activeUser?.role === 'admin' || activeUser?.role === 'teacher';

  // Persist the consolidated state to AES-encrypted local storage (stripping model answers on student devices)
  if (finalCourses.length > 0) {
    setSecureCache(STORAGE_KEYS.COURSES, sanitizeCoursesForClientCache(finalCourses, activeUser?.role));
  }

  // Sanitize Firebase users:
  // - If Admin/Teacher: fetch from 'users' collection + sharded chunks + server users
  // - If Student: ONLY fetch own users/{uid} document + public teacher profiles (protects 50,000 daily read quota & student privacy!)
  let finalUsers: User[] = [];
  try {
    const userMap = new Map<string, User>();

    if (isPrivileged && auth.currentUser) {
      // 1. Privileged Admin/Teacher: Fetch student profiles from 'users' collection
      try {
        const usersColPromise = getDocs(collection(db, 'users'));
        const timeoutColPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
        const usersColSnap: any = await Promise.race([usersColPromise, timeoutColPromise]);
        if (usersColSnap && typeof usersColSnap.forEach === 'function') {
          usersColSnap.forEach((d: any) => {
            if (d.exists()) {
              const u = { id: d.id, ...d.data() } as User;
              if (!isDemoOrDeletedUser(u)) {
                userMap.set(u.id, u);
              }
            }
          });
          console.log(`✅ [Firebase Users Collection] تم تجميع ${userMap.size} حساب من قاعدة بيانات Firestore`);
        }
      } catch (e) {
        console.warn('Direct users collection fetch notice:', e);
      }
    } else if (activeUser?.id && auth.currentUser?.uid === activeUser.id) {
      // Student: Only read their own dedicated document `users/{uid}` when authenticated as that UID
      try {
        let ownSnap: any = null;
        try {
          ownSnap = await getDocFromCache(doc(db, 'users', activeUser.id));
        } catch {}
        if (!ownSnap || !ownSnap.exists()) {
          ownSnap = await getDoc(doc(db, 'users', activeUser.id));
        }
        if (ownSnap && ownSnap.exists()) {
          const ownData = { id: ownSnap.id, ...ownSnap.data() } as User;
          userMap.set(ownData.id, ownData);
        }
      } catch {}
    }

    // Include server users if fetched
    if (serverUsers.length > 0) {
      serverUsers.forEach((u) => {
        if (u?.id && !userMap.has(u.id) && !isDemoOrDeletedUser(u)) {
          userMap.set(u.id, u);
        }
      });
    }

    // 2. Merge with sharded users if privileged or for public teachers
    if (Array.isArray(fbUsers)) {
      fbUsers.forEach((u: any) => {
        if (u?.id && !isDemoOrDeletedUser(u)) {
          if (isPrivileged || u.role === 'teacher' || (activeUser?.id && u.id === activeUser.id)) {
            if (!userMap.has(u.id)) {
              userMap.set(u.id, u);
            } else {
              const existing = userMap.get(u.id)!;
              userMap.set(u.id, {
                ...existing,
                ...u,
                activeSessionId: existing.activeSessionId || u.activeSessionId,
                lastLoginAt: existing.lastLoginAt || u.lastLoginAt,
              });
            }
          }
        }
      });
    }

    // 2.5 Merge with server users (/api/users) only if serverUsers was empty
    if (serverUsers.length === 0) {
      try {
        const serverUsersRes = await fetch('/api/users').then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (serverUsersRes && Array.isArray(serverUsersRes.users)) {
          serverUsersRes.users.forEach((u: any) => {
            if (u?.id && !isDemoOrDeletedUser(u)) {
              if (!userMap.has(u.id)) {
                userMap.set(u.id, u);
              } else {
                const existing = userMap.get(u.id)!;
                userMap.set(u.id, { ...existing, ...u });
              }
            }
          });
        }
      } catch {}
    }

    // 3. Merge with local cache
    getSavedUsers().forEach((u) => {
      if (u?.id && !isDemoOrDeletedUser(u)) {
        if (!userMap.has(u.id)) {
          userMap.set(u.id, u);
        }
      }
    });

    const currentDeletedUserIds = getDeletedUserIds();
    finalUsers = Array.from(userMap.values()).filter((u) => u && u.id && !currentDeletedUserIds.includes(u.id));
    if (isPrivileged && finalUsers.length > 0) {
      saveToFirebase("users", finalUsers);
    }
  } catch (err) {
    console.warn('Error aggregating users in loadAllFromFirebase:', err);
    finalUsers = getSavedUsers();
  }

  const finalCompetitions = fbCompetitions || getSavedCompetitions();
  const finalSettings = fbSettings || serverSettings || getSavedPlatformSettings();
  const finalCodes = isPrivileged ? (fbCodes || getSavedAccessCodes()) : [];
  const finalSubmissions = deduplicateSubmissions(fbSubmissions || getSavedSubmissions());
  const deletedNotifIds = getDeletedNotificationIds();
  const rawNotifs = Array.isArray(fbNotifications) ? fbNotifications : getSavedNotifications();
  const finalNotifications = (rawNotifs || []).filter((n: any) => n && n.id && !deletedNotifIds.includes(n.id));

  // Cache locally with AES-256 encryption (and strip model answers / admin data on student devices)
  try {
    setSecureCache(STORAGE_KEYS.COURSES, sanitizeCoursesForClientCache(finalCourses, activeUser?.role));
    setSecureCache(STORAGE_KEYS.USERS, sanitizeUsersForClientCache(finalUsers, activeUser));
    if (fbCompetitions) setSecureCache(STORAGE_KEYS.COMPETITIONS, fbCompetitions);
    if (fbSettings) setSecureCache(STORAGE_KEYS.PLATFORM_SETTINGS, fbSettings);
    if (isPrivileged && fbCodes) setSecureCache(STORAGE_KEYS.ACCESS_CODES, fbCodes);
    if (fbSubmissions) setSecureCache(STORAGE_KEYS.SUBMISSIONS, fbSubmissions);
    setSecureCache(STORAGE_KEYS.NOTIFICATIONS, finalNotifications);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('qalb_alam_notifications_updated', { detail: finalNotifications }));
    }
  } catch (e) {}

  return {
    courses: finalCourses,
    users: finalUsers,
    competitions: finalCompetitions,
    settings: finalSettings,
    accessCodes: finalCodes,
    submissions: finalSubmissions,
    notifications: finalNotifications,
  };
}

export function subscribeToFirebaseRealtime(callbacks: {
  onCourses?: (courses: Course[]) => void;
  onUsers?: (users: User[]) => void;
  onCompetitions?: (competitions: Competition[]) => void;
  onSettings?: (settings: PlatformSettings) => void;
  onNotifications?: (notifications: PlatformNotification[]) => void;
}) {
  const unsubs: (() => void)[] = [];

  try {
    if (callbacks.onCourses) {
      const unsub = onSnapshot(doc(db, "al_motafalsifa_data", "courses"), (snap) => {
        if (snap.exists()) {
          const data = snap.data()?.data;
          if (Array.isArray(data)) {
            const deletedIds = getDeletedCourseIds();
            const freshCloudCourses = data.filter(
              (c: any) =>
                c &&
                c.id &&
                !deletedIds.includes(c.id) &&
                c.id !== 'course-integrated-physics' &&
                c.id !== 'course-exams-chemistry' &&
                c.instructorId !== 'teacher-ahmed-chemistry'
            );
            const existingLocal = getSavedCourses().filter((c) => !deletedIds.includes(c.id));
            // Do not wipe existing courses if cloud snapshot is unexpectedly empty
            if (freshCloudCourses.length === 0 && existingLocal.length > 0) {
              return;
            }
            const merged = mergeCourses(existingLocal, freshCloudCourses);
            console.log("⚡ [Realtime Cloud] تحديث الكورسات لحظياً من السحابة:", merged.length);
            callbacks.onCourses!(merged);
            const activeUser = getCurrentUser();
            setSecureCache(STORAGE_KEYS.COURSES, sanitizeCoursesForClientCache(merged, activeUser?.role));
            notifyCloudStatus('connected', null);
          }
        }
      }, (err) => {
        console.warn("Firestore courses snapshot error:", err);
        // notifyCloudStatus('error', err?.message);
      });
      unsubs.push(unsub);
    }

    if (callbacks.onUsers) {
      let userSnapUnsubs: (() => void)[] = [];
      const cleanupUserSnaps = () => {
        userSnapUnsubs.forEach((u) => {
          try {
            u();
          } catch {}
        });
        userSnapUnsubs = [];
      };

      const unsubAuthForUsers = onAuthStateChanged(auth, (fbUser) => {
        cleanupUserSnaps();
        if (!fbUser) return;

        const currentActiveUser = getCurrentUser();
        const isPrivileged =
          currentActiveUser?.role === 'admin' ||
          currentActiveUser?.role === 'teacher' ||
          fbUser.email === 'hos098sam@gmail.com';

        if (isPrivileged) {
          // 1. Privileged Admin/Teacher: Real-time listener on 'users' collection
          try {
            const unsubUsersCol = onSnapshot(
              collection(db, "users"),
              (snap) => {
                const liveUsers: User[] = [];
                snap.forEach((d) => {
                  if (d.exists()) {
                    const u = { id: d.id, ...d.data() } as User;
                    if (!isDemoOrDeletedUser(u)) {
                      liveUsers.push(u);
                    }
                  }
                });
                console.log("⚡ [Realtime Users Collection] تحديث الطلاب والمستخدمين لحظياً من Firestore:", liveUsers.length);
                if (liveUsers.length > 0) {
                  callbacks.onUsers!(liveUsers);
                  setSecureCache(STORAGE_KEYS.USERS, sanitizeUsersForClientCache(liveUsers, getCurrentUser()));
                  notifyCloudStatus('connected', null);
                }
              },
              (err) => {
                console.warn("Firestore collection('users') snapshot error:", err?.message || err);
              }
            );
            userSnapUnsubs.push(unsubUsersCol);
          } catch (e) {
            console.warn("Error setting up users collection snapshot:", e);
          }

          // 2. Secondary fallback listener on al_motafalsifa_data/users
          try {
            const unsub = onSnapshot(
              doc(db, "al_motafalsifa_data", "users"),
              (snap) => {
                if (snap.exists()) {
                  const data = snap.data()?.data;
                  if (Array.isArray(data)) {
                    const cleaned = data.filter((u: any) => !isDemoOrDeletedUser(u));
                    callbacks.onUsers!(cleaned);
                    setSecureCache(STORAGE_KEYS.USERS, sanitizeUsersForClientCache(cleaned, getCurrentUser()));
                    notifyCloudStatus('connected', null);
                  }
                }
              },
              (err) => {
                console.warn("Firestore users snapshot error:", err?.message || err);
              }
            );
            userSnapUnsubs.push(unsub);
          } catch {}
        } else {
          // Student: Only subscribe to their own authenticated document `users/{fbUser.uid}` with an error handler
          try {
            const unsubOwnDoc = onSnapshot(
              doc(db, "users", fbUser.uid),
              (snap) => {
                if (snap.exists()) {
                  const ownProfile = { id: snap.id, ...snap.data() } as User;
                  const existing = getSavedUsers();
                  const merged = existing.some((u) => u.id === ownProfile.id)
                    ? existing.map((u) => (u.id === ownProfile.id ? { ...u, ...ownProfile } : u))
                    : [...existing, ownProfile];
                  callbacks.onUsers!(merged);
                  setSecureCache(STORAGE_KEYS.USERS, sanitizeUsersForClientCache(merged, ownProfile));
                  notifyCloudStatus('connected', null);
                }
              },
              (err) => {
                console.warn("Firestore own user document snapshot error:", err?.message || err);
              }
            );
            userSnapUnsubs.push(unsubOwnDoc);
          } catch {}
        }
      });

      unsubs.push(() => {
        cleanupUserSnaps();
        unsubAuthForUsers();
      });
    }

    if (callbacks.onSettings) {
      const unsub = onSnapshot(doc(db, "al_motafalsifa_data", "settings"), (snap) => {
        if (snap.exists()) {
          const data = snap.data()?.data;
          if (data && data.platformName) {
            callbacks.onSettings!(data);
            setSecureCache(STORAGE_KEYS.PLATFORM_SETTINGS, data);
          }
        }
      }, (err) => {
        console.warn("Firestore settings snapshot error:", err);
      });
      unsubs.push(unsub);
    }

    if (callbacks.onCompetitions) {
      const unsub = onSnapshot(doc(db, "al_motafalsifa_data", "competitions"), (snap) => {
        if (snap.exists()) {
          const data = snap.data()?.data;
          if (Array.isArray(data)) {
            callbacks.onCompetitions!(data);
            setSecureCache(STORAGE_KEYS.COMPETITIONS, data);
          }
        }
      }, (err) => {
        console.warn("Firestore competitions snapshot error:", err);
      });
      unsubs.push(unsub);
    }

    if (callbacks.onNotifications) {
      const unsub = onSnapshot(doc(db, "al_motafalsifa_data", "notifications"), (snap) => {
        if (snap.exists()) {
          const data = snap.data()?.data;
          if (Array.isArray(data)) {
            const deletedNotifIds = getDeletedNotificationIds();
            const cleanNotifs = data.filter((n: any) => n && n.id && !deletedNotifIds.includes(n.id));
            console.log("⚡ [Realtime Cloud] تحديث الإشعارات لحظياً من السحابة:", cleanNotifs.length);
            callbacks.onNotifications!(cleanNotifs);
            setSecureCache(STORAGE_KEYS.NOTIFICATIONS, cleanNotifs);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('qalb_alam_notifications_updated', { detail: cleanNotifs }));
            }
            notifyCloudStatus('connected', null);
          }
        }
      }, (err) => {
        console.warn("Firestore notifications snapshot error:", err);
      });
      unsubs.push(unsub);
    }
  } catch (err: any) {
    console.warn("Error setting up Firestore snapshots", err);
    // notifyCloudStatus('error', err?.message);
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

export function clearLocalCache() {
  try {
    Object.values(STORAGE_KEYS).forEach((k) => {
      if (k !== STORAGE_KEYS.CURRENT_USER) {
        removeSecureCache(k);
      }
    });
    console.log("🧹 تم مسح الكاش المحلي بنجاح.");
  } catch (e) {}
}

